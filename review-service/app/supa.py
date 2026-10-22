"""Tiny helper for talking to Supabase's REST API with the server-side (service) key.

The service key bypasses row-level security, so it must stay on the server and
must never be sent to the browser.
"""
import httpx

from .config import settings


def _headers() -> dict[str, str]:
    key = settings.supabase_service_key
    headers = {"apikey": key}
    # Older "service_role" keys are JWTs and are also sent as a Bearer token;
    # newer "sb_secret_..." keys are sent in the apikey header only.
    if not key.startswith("sb_"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


async def select(table: str, params: dict[str, str] | None = None) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/{table}", headers=_headers(), params=params or {}
        )
        response.raise_for_status()
        return response.json()


async def ping() -> bool:
    """True if the database answers. Also keeps a free Supabase project awake."""
    if not settings.configured:
        return False
    try:
        await select("brand_rules", {"select": "id", "limit": "1"})
        return True
    except Exception:
        return False
