"""Run one bounded cleanup batch from a trusted scheduler."""
import asyncio
import os

import httpx
from dotenv import load_dotenv

from review_photos import BUCKET, KEY, json_request, privileged_headers


async def clean_batch(client, base, headers):
    keys = await json_request(client, "POST", base + "/rest/v1/rpc/claim_review_photo_cleanup",
                              headers=headers, json={"batch_size": 10})
    if not isinstance(keys, list) or len(keys) > 10 or not all(
        isinstance(key, str) and KEY.fullmatch(key) for key in keys
    ):
        raise ValueError("Invalid cleanup claim")
    if not keys:
        return 0, 0
    result = await json_request(client, "DELETE", base + "/storage/v1/object/" + BUCKET,
                                headers=headers, json={"prefixes": keys})
    if not isinstance(result, list):
        raise ValueError("Invalid cleanup response")
    removed = {row.get("name") for row in result if isinstance(row, dict) and
               isinstance(row.get("name"), str) and row["name"] in keys}
    return len(keys), len(removed)


async def main():
    load_dotenv()
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not base:
        raise ValueError("Missing cleanup configuration")
    async with asyncio.timeout(15), httpx.AsyncClient(timeout=5) as client:
        claimed, removed = await clean_batch(client, base, privileged_headers())
    print(f"Review photo cleanup: {removed}/{claimed} confirmed")
    return 0 if claimed == removed else 1


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except Exception:
        # A failed batch remains eligible after its database lease expires.
        print("Review photo cleanup could not be confirmed")
        raise SystemExit(1) from None
