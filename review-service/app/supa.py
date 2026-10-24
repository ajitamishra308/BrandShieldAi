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


async def _request(
    method: str,
    table: str,
    *,
    params: dict[str, str] | None = None,
    json: list[dict] | dict | None = None,
    prefer: str | None = None,
) -> list[dict]:
    headers = _headers()
    if json is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.request(
            method,
            f"{settings.supabase_url}/rest/v1/{table}",
            headers=headers,
            params=params or {},
            json=json,
        )
        response.raise_for_status()
        return response.json() if response.content else []


async def select(table: str, params: dict[str, str] | None = None) -> list[dict]:
    return await _request("GET", table, params=params)


async def insert(table: str, rows: list[dict]) -> None:
    if rows:
        await _request("POST", table, json=rows, prefer="return=minimal")


async def delete(table: str, params: dict[str, str]) -> None:
    await _request("DELETE", table, params=params, prefer="return=minimal")


async def patch(table: str, params: dict[str, str], data: dict) -> None:
    await _request("PATCH", table, params=params, json=data, prefer="return=minimal")


async def ping() -> bool:
    """True if the database answers. Also keeps a free Supabase project awake."""
    if not settings.configured:
        return False
    try:
        await select("brand_rules", {"select": "id", "limit": "1"})
        return True
    except Exception:
        return False
