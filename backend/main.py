import os
from typing import Annotated
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware

from review_photos import router as review_photo_router

load_dotenv()
app = FastAPI(title="AOUN", version="0.1.0")
app.include_router(review_photo_router)

photo_web_origins = [
    origin.strip() for origin in os.getenv("REVIEW_PHOTO_WEB_ORIGINS", "").split(",")
    if origin.strip() and origin.strip() != "*"
]
if photo_web_origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=photo_web_origins, allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["X-Review-Photo-Key", "X-Review-Photo-Proof"],
    )


async def rpc(name: str, payload: dict):
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise HTTPException(503, "Database connection is not configured")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.post(
                f"{url}/rest/v1/rpc/{name}", headers={"apikey": key}, json=payload
            )
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, "Place data temporarily unavailable") from error


def resolve_photo(place: dict) -> dict:
    path = (place.get("photo_path") or "").strip()
    if path and not path.lower().startswith(("https://", "http://")):
        key = path.lstrip("/").removeprefix("place-photos/")
        base_url = os.environ["SUPABASE_URL"].rstrip("/")
        path = f"{base_url}/storage/v1/object/public/place-photos/{quote(key)}"
    return {**place, "photo_path": path or None}


@app.get("/places")
async def search(q: Annotated[str, Query(max_length=150)] = "",
                 facility: Annotated[list[int] | None, Query()] = None):
    ids = sorted(set(facility or []))
    if any(i < 1 or i > 9 for i in ids):
        raise HTTPException(422, "Facility IDs must be between 1 and 9")
    places = await rpc("search_places", {"term": q.strip(), "required_ids": ids})
    return [resolve_photo(place) for place in places]


@app.get("/places/{place_id}")
async def details(place_id: Annotated[int, Path(ge=1, le=2147483647)]):
    place = await rpc("place_details", {"target_id": place_id})
    if place is None:
        raise HTTPException(404, "Place not found")
    return resolve_photo(place)


@app.get("/nearby")
async def nearby(latitude: Annotated[float, Query(ge=-90, le=90)],
                 longitude: Annotated[float, Query(ge=-180, le=180)]):
    return await rpc("nearby_places", {"origin_lat": latitude, "origin_lon": longitude})
