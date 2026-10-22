"""BrandShield AI review service (FastAPI).

Stage 1 only has the basics: health check and "who am I". The review pipeline
(rules, fact matching, AI, validation, campaign checks) is added in later steps.
"""
from datetime import datetime, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import supa
from .auth import get_current_user
from .config import settings

app = FastAPI(title="BrandShield AI Review Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
