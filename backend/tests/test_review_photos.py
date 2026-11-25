import asyncio
import io
import inspect
import json
import os
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from PIL import Image, PngImagePlugin

from main import app
from photo_limits import PhotoSigningLimits
from review_photos import MAX_BYTES, proof_for, sanitize
from review_photo_cleanup import clean_batch

CLIENT = TestClient(app)
BASE = "https://example.invalid"
KEY = "37/00000000-0000-4000-8000-000000000001.png"
ROUTE = "/review-photos/37"
SECRET = "mock-validation-only-" * 3
CONFIG = {
    "SUPABASE_URL": BASE, "SUPABASE_PUBLISHABLE_KEY": "mock-public",
    "SUPABASE_REVIEW_PHOTO_SECRET_KEY": "sb_secret_mock_backend_only",
    "REVIEW_PHOTO_VALIDATION_KEY": SECRET,
}
AUTH = {"Authorization": "Bearer fixture.session.token"}
ASYNC_CLIENT = httpx.AsyncClient


def image_bytes(kind="PNG"):
    out = io.BytesIO()
    image = Image.new("RGB", (8, 8), (20, 30, 40))
    if kind == "PNG":
        info = PngImagePlugin.PngInfo()
        info.add_text("Location", "private location")
        image.save(out, format=kind, pnginfo=info)
    else:
        exif = Image.Exif()
        exif[270] = "private location"
        image.save(out, format=kind, exif=exif)
    return out.getvalue()


class ReviewPhotos(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, CONFIG, clear=True)
        env.start()
        self.addCleanup(env.stop)
        self.calls = []
        limiter = patch("review_photos.signing_limits", PhotoSigningLimits())
        limiter.start()
        self.addCleanup(limiter.stop)

    def mock_upstream(self, handler):
        async def record(request):
            self.calls.append(request)
            result = handler(request)
            return await result if inspect.isawaitable(result) else result
        client = patch("review_photos.httpx.AsyncClient", side_effect=lambda **opts:
                       ASYNC_CLIENT(transport=httpx.MockTransport(record), **opts))
        client.start()
        self.addCleanup(client.stop)

    def prepare_handler(self, request):
        self.assertEqual(request.headers["authorization"], AUTH["Authorization"])
        self.assertEqual(request.headers["apikey"], CONFIG["SUPABASE_PUBLISHABLE_KEY"])
        if request.url.path.endswith("/aoun_active"):
            return httpx.Response(200, json=True)
        self.assertEqual(request.url.params["id"], "eq.37")
        return httpx.Response(200, json=[{"id": 37, "user_id": "mock-owner"}])

    def mock_signing(self, *, published_first=True, published_last=True, tampered=False):
        body, _, _ = sanitize(image_bytes())
        def respond(request):
            path = request.url.path
            if path == "/rest/v1/place_reviews":
                self.assertEqual(request.headers["apikey"], "mock-public")
                attached = published_first if len(self.calls) == 1 else published_last
                return httpx.Response(200, json=[{"id": 37, "photo_paths": [KEY] if attached else []}])
            self.assertEqual(request.headers["apikey"], CONFIG["SUPABASE_REVIEW_PHOTO_SECRET_KEY"])
            self.assertNotIn("authorization", request.headers)
            if path.startswith("/storage/v1/object/info/"):
                return httpx.Response(200, json={
                    "content_type": "image/png", "version": "version-1",
                    "metadata": {"aoun_proof": proof_for(SECRET.encode(), KEY, body)},
                })
            if path.startswith("/storage/v1/object/authenticated/"):
                self.assertEqual(request.url.params["versionId"], "version-1")
                return httpx.Response(200, content=image_bytes() if tampered else body)
            self.assertEqual(path, "/storage/v1/object/sign/review-photos/" + KEY)
            self.assertIn(b'"versionId":"version-1"', request.content)
            self.assertIn(b'"expiresIn":120', request.content)
            return httpx.Response(200, json={"signedURL": "/object/sign/review-photos/" + KEY + "?token=mock"})
        self.mock_upstream(respond)

    def test_preparation_decodes_and_strips_jpeg_exif_and_png_text(self):
        self.mock_upstream(self.prepare_handler)
        for kind, suffix in [("PNG", ".png"), ("JPEG", ".jpg")]:
            with self.subTest(kind=kind):
                raw = image_bytes(kind)
                self.assertIn(b"private location", raw)
                result = CLIENT.post(ROUTE + "/prepare", content=raw, headers=AUTH)
                self.assertEqual(result.status_code, 200)
                key = result.headers["X-Review-Photo-Key"]
                self.assertTrue(key.startswith("37/") and key.endswith(suffix))
                self.assertNotIn(b"private location", result.content)
                self.assertEqual(result.headers["X-Review-Photo-Proof"],
                                 proof_for(SECRET.encode(), key, result.content))
                with Image.open(io.BytesIO(result.content)) as clean:
                    self.assertEqual(clean.format, kind)
                    self.assertFalse(clean.getexif())

    def test_preparation_rejects_invalid_bytes_and_oversize_body(self):
        self.mock_upstream(self.prepare_handler)
        self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=b"fake JPEG", headers={
            **AUTH, "Content-Type": "image/jpeg",
        }).status_code, 422)
        self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=b"x" * (MAX_BYTES + 1),
                                     headers=AUTH).status_code, 413)

    def test_preparation_requires_active_member(self):
        self.mock_upstream(lambda _request: httpx.Response(200, json=False))
        self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=image_bytes()).status_code, 401)
        self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=image_bytes(), headers=AUTH).status_code, 403)
        self.assertEqual(len(self.calls), 1)

    def test_preparation_requires_owned_rating(self):
        self.mock_upstream(lambda request: httpx.Response(
            200, json=True if request.url.path.endswith("/aoun_active") else [],
        ))
        self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=image_bytes(), headers=AUTH).status_code, 404)

    def test_guest_signs_only_verified_attached_version(self):
        self.mock_signing()
        result = CLIENT.get(ROUTE, params={"key": KEY}, follow_redirects=False)
        self.assertEqual(result.status_code, 302)
        self.assertEqual(result.headers["location"], BASE + "/storage/v1/object/sign/review-photos/" + KEY + "?token=mock")
        self.assertEqual(result.headers["cache-control"], "no-store")

    def test_wrong_and_unattached_keys_are_rejected_before_privileged_reads(self):
        self.mock_signing(published_first=False)
        self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY.replace("37/", "38/")}).status_code, 404)
        self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 404)
        self.assertEqual([request.url.path for request in self.calls], ["/rest/v1/place_reviews"])

    def test_tampered_bytes_are_not_signed(self):
        self.mock_signing(tampered=True)
        self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 404)
        self.assertTrue(all(request.method == "GET" for request in self.calls))

    def test_detached_during_validation_is_not_signed(self):
        self.mock_signing(published_last=False)
        self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 404)
        self.assertTrue(all(request.method == "GET" for request in self.calls))

    def test_missing_secret_or_validator_fails_closed(self):
        self.mock_upstream(lambda _request: self.fail("unexpected request"))
        with patch.dict(os.environ, {"SUPABASE_REVIEW_PHOTO_SECRET_KEY": ""}):
            self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 503)
            self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=image_bytes(), headers=AUTH).status_code, 503)
        with patch("review_photos.Image", None):
            self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 503)
            self.assertEqual(CLIENT.post(ROUTE + "/prepare", content=image_bytes(), headers=AUTH).status_code, 503)

    def mock_verification(self, *, forged=False, owned=True):
        clean, _, _ = sanitize(image_bytes())

        def handler(request):
            path = request.url.path
            if path.endswith("/aoun_active"):
                self.assertEqual(request.headers["authorization"], AUTH["Authorization"])
                return httpx.Response(200, json=True)
            if path.endswith("/ratings"):
                self.assertEqual(request.headers["authorization"], AUTH["Authorization"])
                return httpx.Response(200, json=[{"id": 37, "user_id": "mock-owner"}] if owned else [])
            self.assertEqual(request.headers["apikey"], CONFIG["SUPABASE_REVIEW_PHOTO_SECRET_KEY"])
            self.assertNotIn("authorization", request.headers)
            if "/object/info/" in path:
                return httpx.Response(200, json={
                    "content_type": "image/png", "version": "verified-v1",
                    "metadata": {"aoun_proof": proof_for(SECRET.encode(), KEY, clean)},
                })
            if "/object/authenticated/" in path:
                self.assertEqual(request.url.params["versionId"], "verified-v1")
                return httpx.Response(200, content=image_bytes() if forged else clean)
            self.assertTrue(path.endswith("/record_review_photo_verification"))
            self.assertEqual(json.loads(request.content), {
                "target_key": KEY, "target_rating": 37,
                "reviewer": "mock-owner", "object_version": "verified-v1",
            })
            return httpx.Response(204)

        self.mock_upstream(handler)

    def test_verifies_the_uploaded_bytes_before_recording_the_exact_version(self):
        self.mock_verification()
        self.assertEqual(CLIENT.post(ROUTE + "/verify", params={"key": KEY}, headers=AUTH).status_code, 204)
        self.assertEqual(len(self.calls), 5)

    def test_forged_proof_does_not_record_verification(self):
        self.mock_verification(forged=True)
        self.assertEqual(CLIENT.post(ROUTE + "/verify", params={"key": KEY}, headers=AUTH).status_code, 422)
        self.assertEqual(len(self.calls), 4)
        self.assertFalse(any("record_review_photo_verification" in request.url.path for request in self.calls))

    def test_verify_denies_unowned_rating_before_storage_access(self):
        self.mock_verification(owned=False)
        self.assertEqual(CLIENT.post(ROUTE + "/verify", params={"key": KEY}, headers=AUTH).status_code, 404)
        self.assertEqual(len(self.calls), 2)

    def test_signing_rate_rejection_makes_no_upstream_request(self):
        limiter = PhotoSigningLimits(per_client=1)
        self.mock_signing(published_first=False)
        with patch("review_photos.signing_limits", limiter):
            self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 404)
            limited = CLIENT.get(ROUTE, params={"key": KEY})
            self.assertEqual(limited.status_code, 429)
            self.assertIn("retry-after", limited.headers)
        self.assertEqual(len(self.calls), 1)

    def test_signing_concurrency_limit_releases_after_completion(self):
        limiter = PhotoSigningLimits(inflight=1)
        self.mock_signing(published_first=False)
        with patch("review_photos.signing_limits", limiter):
            with limiter.admit("another-client"):
                self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 429)
                self.assertFalse(self.calls)
            self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 404)

    def test_signing_deadline_is_shared_by_the_upstream_requests(self):
        async def slow(_request):
            await asyncio.sleep(1)
            return httpx.Response(200, json=[])
        self.mock_upstream(slow)
        with patch("review_photos.SIGNING_DEADLINE_SECONDS", 0.01):
            self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 503)

    def test_oversize_stored_object_is_not_signed(self):
        def handler(request):
            path = request.url.path
            if path.endswith("/place_reviews"):
                return httpx.Response(200, json=[{"id": 37, "photo_paths": [KEY]}])
            if "/object/info/" in path:
                return httpx.Response(200, json={
                    "content_type": "image/png", "version": "v1", "metadata": {"aoun_proof": "b" * 64},
                })
            if "/object/authenticated/" in path:
                return httpx.Response(200, content=b"x" * (MAX_BYTES + 1))
            self.fail("oversize bytes must not be signed")
        self.mock_upstream(handler)
        self.assertEqual(CLIENT.get(ROUTE, params={"key": KEY}).status_code, 413)


class CleanupTests(unittest.IsolatedAsyncioTestCase):
    async def test_worker_only_deletes_claimed_keys_and_confirms_the_returned_subset(self):
        def handler(request):
            if request.method == "POST":
                self.assertTrue(request.url.path.endswith("/claim_review_photo_cleanup"))
                self.assertEqual(json.loads(request.content), {"batch_size": 10})
                return httpx.Response(200, json=[KEY])
            self.assertEqual(request.method, "DELETE")
            self.assertEqual(request.url.path, "/storage/v1/object/review-photos")
            self.assertEqual(json.loads(request.content), {"prefixes": [KEY]})
            return httpx.Response(200, json=[])
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            self.assertEqual(await clean_batch(client, BASE, {}), (1, 0))

    async def test_worker_can_resume_a_failed_batch_using_a_new_claim(self):
        deletes = 0
        def handler(request):
            nonlocal deletes
            if request.method == "POST":
                return httpx.Response(200, json=[KEY])
            deletes += 1
            if deletes == 1:
                return httpx.Response(503)
            return httpx.Response(200, json=[{"name": KEY}])
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(httpx.HTTPStatusError):
                await clean_batch(client, BASE, {})
            self.assertEqual(await clean_batch(client, BASE, {}), (1, 1))

    async def test_worker_refuses_invalid_claim_without_storage_delete(self):
        def handler(request):
            self.assertEqual(request.method, "POST")
            return httpx.Response(200, json=["../../other-bucket/image.jpg"])
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with self.assertRaises(ValueError):
                await clean_batch(client, BASE, {})
