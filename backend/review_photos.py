import asyncio
import json
import hashlib
import hmac
import io
import os
import re
from typing import Annotated
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Path, Query, Request, Response
from fastapi.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool

from photo_limits import PhotoSigningLimits

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = ImageOps = None

router = APIRouter()
BUCKET = "review-photos"
MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 12_000_000
MAX_RATING_ID = 2**63 - 1
KEY = re.compile(r"[1-9][0-9]{0,18}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png)")
PROOF = re.compile(r"[0-9a-f]{64}")
TTL_SECONDS = 120
SIGNING_DEADLINE_SECONDS = 8
signing_limits = PhotoSigningLimits()


def settings():
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    public_key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    validation_key = os.getenv("REVIEW_PHOTO_VALIDATION_KEY", "").encode()
    if not base or not public_key or len(validation_key) < 32 or Image is None:
        raise HTTPException(503, "Review photo validation unavailable")
    return base, public_key, validation_key


def proof_for_digest(secret: bytes, key: str, digest: bytes) -> str:
    return hmac.new(secret, b"aoun-review-photo-v1\x00" + key.encode() + b"\x00" + digest,
                    hashlib.sha256).hexdigest()


def proof_for(secret: bytes, key: str, content: bytes) -> str:
    return proof_for_digest(secret, key, hashlib.sha256(content).digest())


async def bounded_bytes(chunks, maximum=MAX_BYTES) -> bytes:
    data = bytearray()
    async for chunk in chunks:
        if len(data) + len(chunk) > maximum:
            raise HTTPException(413, "Review photo exceeds 5 MiB")
        data.extend(chunk)
    if not data:
        raise HTTPException(422, "Empty review photo")
    return bytes(data)


def sanitize(raw: bytes) -> tuple[bytes, str, str]:
    try:
        with Image.open(io.BytesIO(raw), formats=["JPEG", "PNG"]) as original:
            if (original.width * original.height > MAX_PIXELS or
                    getattr(original, "n_frames", 1) != 1):
                raise ValueError("Unsupported image dimensions or frames")
            original.load()
            kind = original.format
            oriented = ImageOps.exif_transpose(original)
            mode = "RGBA" if kind == "PNG" and (
                "A" in oriented.getbands() or "transparency" in oriented.info
            ) else "RGB"
            pixels = oriented.convert(mode)
            clean = Image.frombytes(mode, pixels.size, pixels.tobytes())
            output = io.BytesIO()
            clean.save(output, format=kind)
    except (OSError, ValueError, SyntaxError, Image.DecompressionBombError) as error:
        raise HTTPException(422, "Use a valid JPEG or PNG image") from error
    data = output.getvalue()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Prepared review photo exceeds 5 MiB")
    return (data, "image/jpeg", "jpg") if kind == "JPEG" else (data, "image/png", "png")


async def json_request(client, method, url, *, headers, **kwargs):
    async with client.stream(method, url, headers={**headers, "Accept-Encoding": "identity"},
                             **kwargs) as response:
        response.raise_for_status()
        if response.headers.get("Content-Encoding", "identity").lower() != "identity":
            raise ValueError("Unexpected upstream encoding")
        data = await bounded_bytes(response.aiter_bytes(chunk_size=64 * 1024), 64 * 1024)
    return json.loads(data)


async def owned_rating(client, base, public_key, authorization, rating_id):
    headers = {"apikey": public_key, "Authorization": authorization}
    try:
        active = await json_request(client, "POST", f"{base}/rest/v1/rpc/aoun_active",
                                    headers=headers, json={"member_role": "member"})
        if active is not True:
            raise HTTPException(403, "Active member required")
        rows = await json_request(client, "GET", f"{base}/rest/v1/ratings",
                                  headers=headers, params={"id": f"eq.{rating_id}", "select": "id,user_id"})
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403):
            raise HTTPException(403, "Active member required") from error
        raise
    if isinstance(rows, list):
        for row in rows:
            if isinstance(row, dict) and row.get("id") == rating_id and isinstance(row.get("user_id"), str):
                return row["user_id"]
    raise HTTPException(404, "Rating not found")


def require_session(authorization):
    if not authorization or not re.fullmatch(r"Bearer [\w-]+\.[\w-]+\.[\w-]+", authorization):
        raise HTTPException(401, "Member session required")


def privileged_headers():
    secret = os.getenv("SUPABASE_REVIEW_PHOTO_SECRET_KEY", "")
    if not secret:
        raise HTTPException(503, "Review photo service unavailable")
    headers = {"apikey": secret}
    if not secret.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {secret}"
    return headers


@router.post("/review-photos/{rating_id}/prepare")
async def prepare_review_photo(
    rating_id: Annotated[int, Path(ge=1, le=MAX_RATING_ID)],
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
):
    require_session(authorization)
    base, public_key, secret = settings()
    privileged_headers()  # Avoid staging uploads when post-upload verification is unavailable.
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await owned_rating(client, base, public_key, authorization, rating_id)
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, "Review photo validation unavailable") from error

    raw = await bounded_bytes(request.stream())
    data, mime, extension = await run_in_threadpool(sanitize, raw)
    key = f"{rating_id}/{uuid4()}.{extension}"
    return Response(data, media_type=mime, headers={
        "Cache-Control": "no-store", "X-Review-Photo-Key": key,
        "X-Review-Photo-Proof": proof_for(secret, key, data),
    })


async def published(client, base, public_key, rating_id, key):
    rows = await json_request(client, "GET", f"{base}/rest/v1/place_reviews",
                              headers={"apikey": public_key},
                              params={"id": f"eq.{rating_id}", "select": "id,photo_paths"})
    return isinstance(rows, list) and any(
        isinstance(row, dict) and row.get("id") == rating_id
        and isinstance(row.get("photo_paths"), list) and key in row["photo_paths"]
        for row in rows
    )


def require_rating_key(rating_id, key):
    if not KEY.fullmatch(key) or key.split("/", 1)[0] != str(rating_id):
        raise HTTPException(404, "Review photo not found")


async def verified_object(client, storage, headers, key, secret):
    path = f"{BUCKET}/{key}"
    info = await json_request(client, "GET", f"{storage}/object/info/{path}", headers=headers)
    metadata = info.get("metadata") if isinstance(info, dict) else None
    proof = metadata.get("aoun_proof") if isinstance(metadata, dict) else None
    mime = "image/jpeg" if key.endswith(".jpg") else "image/png"
    if (not isinstance(proof, str) or not PROOF.fullmatch(proof) or info.get("content_type") != mime
            or info.get("content_encoding") not in (None, "identity")):
        return None
    version = info.get("version")
    if not isinstance(version, str) or not re.fullmatch(r"[\w-]{1,80}", version):
        return None
    async with client.stream("GET", f"{storage}/object/authenticated/{path}",
                             headers={**headers, "Accept-Encoding": "identity"},
                             params={"versionId": version}) as response:
        response.raise_for_status()
        if response.headers.get("Content-Encoding", "identity").lower() != "identity":
            return None
        digest = hashlib.sha256()
        downloaded = 0
        async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
            downloaded += len(chunk)
            if downloaded > MAX_BYTES:
                raise HTTPException(413, "Review photo exceeds 5 MiB")
            digest.update(chunk)
    if not downloaded:
        return None
    return version if hmac.compare_digest(proof, proof_for_digest(secret, key, digest.digest())) else None


@router.post("/review-photos/{rating_id}/verify", status_code=204)
async def verify_review_photo(
    rating_id: Annotated[int, Path(ge=1, le=MAX_RATING_ID)],
    key: Annotated[str, Query(max_length=64)],
    authorization: Annotated[str | None, Header()] = None,
):
    require_session(authorization)
    require_rating_key(rating_id, key)
    base, public_key, secret = settings()
    headers = privileged_headers()
    try:
        async with asyncio.timeout(SIGNING_DEADLINE_SECONDS), httpx.AsyncClient(timeout=3) as client:
            owner = await owned_rating(client, base, public_key, authorization, rating_id)
            version = await verified_object(client, f"{base}/storage/v1", headers, key, secret)
            if not version:
                raise HTTPException(422, "Stored review photo did not pass validation")
            async with client.stream(
                "POST", f"{base}/rest/v1/rpc/record_review_photo_verification", headers=headers,
                json={"target_key": key, "target_rating": rating_id,
                      "reviewer": owner, "object_version": version},
            ) as result:
                result.raise_for_status()
        return Response(status_code=204)
    except (TimeoutError, httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, "Review photo verification unavailable") from error


@router.get("/review-photos/{rating_id}")
async def published_review_photo(
    rating_id: Annotated[int, Path(ge=1, le=MAX_RATING_ID)],
    key: Annotated[str, Query(max_length=64)],
    request: Request,
):
    require_rating_key(rating_id, key)
    with signing_limits.admit(request.client.host if request.client else "unknown"):
        return await sign_published_photo(rating_id, key)


async def sign_published_photo(rating_id, key):
    base, public_key, secret = settings()
    headers = privileged_headers()
    storage = f"{base}/storage/v1"
    object_path = f"{BUCKET}/{key}"
    try:
        async with asyncio.timeout(SIGNING_DEADLINE_SECONDS), httpx.AsyncClient(timeout=3) as client:
            if not await published(client, base, public_key, rating_id, key):
                raise HTTPException(404, "Review photo not found")
            version = await verified_object(client, storage, headers, key, secret)
            if not version:
                raise HTTPException(404, "Verified review photo not found")
            if not await published(client, base, public_key, rating_id, key):
                raise HTTPException(404, "Review photo not found")

            signed = await json_request(client, "POST", f"{storage}/object/sign/{object_path}",
                                        headers=headers, json={"expiresIn": TTL_SECONDS, "versionId": version})
            relative = signed.get("signedURL") if isinstance(signed, dict) else None
            if not isinstance(relative, str):
                raise HTTPException(503, "Review photo signing unavailable")
            destination = urlsplit(relative)
            if (destination.scheme or destination.netloc or destination.fragment or
                    destination.path != f"/object/sign/{object_path}" or not destination.query.startswith("token=")):
                raise HTTPException(503, "Review photo signing unavailable")
            return RedirectResponse(storage + relative, status_code=302, headers={"Cache-Control": "no-store"})
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 404:
            raise HTTPException(404, "Review photo not found") from error
        raise HTTPException(503, "Review photo signing unavailable") from error
    except (TimeoutError, httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, "Review photo signing unavailable") from error
