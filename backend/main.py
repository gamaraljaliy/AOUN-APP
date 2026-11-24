import os
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query

load_dotenv()
app = FastAPI(title="AOUN", version="0.1.0")


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


@app.get("/places")
async def search(q: Annotated[str, Query(max_length=150)] = "",
                 facility: Annotated[list[int] | None, Query()] = None):
    ids = sorted(set(facility or []))
    if any(i < 1 or i > 9 for i in ids):
        raise HTTPException(422, "Facility IDs must be between 1 and 9")
    return await rpc("search_places", {"term": q.strip(), "required_ids": ids})


@app.get("/places/{place_id}")
async def details(place_id: Annotated[int, Path(ge=1, le=2147483647)]):
    place = await rpc("place_details", {"target_id": place_id})
    if place is None:
        raise HTTPException(404, "Place not found")
    return place


@app.get("/nearby")
async def nearby(latitude: Annotated[float, Query(ge=-90, le=90)],
                 longitude: Annotated[float, Query(ge=-180, le=180)]):
    return await rpc("nearby_places", {"origin_lat": latitude, "origin_lon": longitude})
