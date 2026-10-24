"""BrandShield AI review service (FastAPI).

Endpoints:
  GET  /health                    public status check (also keeps free hosting awake)
  GET  /me                        who is signed in
  POST /review/item/{item_id}     review an item (and the other items of its campaign)
  POST /review/campaign/{id}      review every item of a campaign

The review runs the rule-based engine. The AI step is added in Stage 3.
"""
import re
from datetime import datetime, timezone

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import review, supa
from .auth import get_current_user
from .config import settings

app = FastAPI(title="BrandShield AI Review Service", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


@app.get("/")
async def root() -> dict:
    return {"service": "brandshield-review-service", "docs": "/docs", "health": "/health"}


@app.get("/health")
async def health() -> dict:
    """Public. Used by the dashboard and by a free uptime monitor to keep the app awake."""
    database_ok = await supa.ping()
    return {
        "status": "ok",
        "service": "review-service",
        "database": "ok" if database_ok else "unreachable",
        "ai_configured": bool(settings.gemini_api_key),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    """Protected. Returns the signed-in user's id, name and role."""
    return user


def _check_uuid(value: str) -> str:
    if not UUID.match(value):
        raise HTTPException(status_code=400, detail="Invalid id")
    return value


async def _run(item_id: str, user: dict) -> dict:
    try:
        return await review.run_review(item_id, user["id"])
    except review.ItemNotFound:
        raise HTTPException(status_code=404, detail="Item not found")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Database request failed ({exc.response.status_code})")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the database")


@app.post("/review/item/{item_id}")
async def review_item(item_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Protected. Reviews the item and, if it is in a campaign, the whole campaign."""
    return await _run(_check_uuid(item_id), user)


@app.post("/review/campaign/{campaign_id}")
async def review_campaign(campaign_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Protected. Reviews every item of the campaign."""
    _check_uuid(campaign_id)
    try:
        items = await supa.select("content_items", {"select": "id", "campaign_id": f"eq.{campaign_id}", "limit": "1"})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the database")
    if not items:
        raise HTTPException(status_code=404, detail="Campaign has no items")
    return await _run(items[0]["id"], user)
