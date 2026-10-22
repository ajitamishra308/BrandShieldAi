"""Checks the signed-in user's token by asking Supabase Auth who it belongs to."""
import httpx
from fastapi import Header, HTTPException

from . import supa
from .config import settings


async def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[7:].strip()
    if not settings.configured:
        raise HTTPException(status_code=503, detail="Service is not configured")

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = response.json()
    rows = await supa.select("profiles", {"select": "full_name,role", "id": f"eq.{user['id']}"})
    if not rows:
        raise HTTPException(status_code=403, detail="This account has no role yet")
    return {"id": user["id"], "email": user.get("email"), **rows[0]}
