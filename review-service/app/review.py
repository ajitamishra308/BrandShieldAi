"""Runs a review: reads the brand kit and content from Supabase, runs the engine,
and saves the findings. People's earlier decisions on findings are kept.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from . import engine, supa

IST = timezone(timedelta(hours=5, minutes=30))


class ItemNotFound(Exception):
    pass


def today_ist():
    return datetime.now(IST).date()


async def run_review(item_id: str, actor_id: str) -> dict:
    """Review an item. If it belongs to a campaign, every item of that campaign is reviewed,
    so that contradictions between channels are found on all of them."""
    rows = await supa.select("content_items", {"select": "*", "id": f"eq.{item_id}"})
    if not rows:
        raise ItemNotFound(item_id)
    item = rows[0]
    group = [item]
    if item.get("campaign_id"):
        group = await supa.select(
            "content_items",
            {"select": "*", "campaign_id": f"eq.{item['campaign_id']}", "order": "created_at.asc"},
        )

    rules, facts, terms = await asyncio.gather(
        supa.select("brand_rules", {"select": "*"}),
        supa.select("facts", {"select": "*"}),
        supa.select("terminology", {"select": "*"}),
    )
    today = today_ist()
    claims = {it["id"]: engine.extract_claims(it["body"], facts) for it in group}

    summary = []
    for it in group:
        siblings = [
            {"id": o["id"], "title": o["title"], "channel": o["channel"], "claims": claims[o["id"]]}
            for o in group if o["id"] != it["id"]
        ]
        result = engine.review_item(it, rules, facts, terms, today, siblings, claims[it["id"]])
        summary.append(await _save(it, result, actor_id))
    return {"reviewed": summary, "engine": "rules"}


async def _save(item: dict, result: dict, actor_id: str) -> dict:
    item_id = item["id"]
    old = await supa.select(
        "findings",
        {"select": "claim,status,source_id,decision,decision_reason,decided_by,decided_at", "item_id": f"eq.{item_id}"},
    )
    decided = {(o["claim"], o["status"], o["source_id"]): o for o in old if o["decision"] != "open"}

    rows = []
    for f in result["findings"]:
        previous = decided.get((f["claim"], f["status"], f["source_id"]))
        rows.append({
            "item_id": item_id,
            "version": item["version"],
            "claim": f["claim"],
            "claim_type": f["claim_type"],
            "status": f["status"],
            "severity": f["severity"],
            "source_id": f["source_id"],
            "explanation": f["explanation"],
            "suggested_fix": f["suggested_fix"],
            "origin": f["origin"],
            "decision": previous["decision"] if previous else "open",
            "decision_reason": previous["decision_reason"] if previous else None,
            "decided_by": previous["decided_by"] if previous else None,
            "decided_at": previous["decided_at"] if previous else None,
        })

    await supa.delete("findings", {"item_id": f"eq.{item_id}"})
    await supa.insert("findings", rows)

    await supa.delete("item_fact_links", {"item_id": f"eq.{item_id}"})
    await supa.insert("item_fact_links", [{"item_id": item_id, "fact_id": fid} for fid in result["linked_facts"]])

    update = {"last_reviewed_at": datetime.now(timezone.utc).isoformat()}
    if item["status"] in ("draft", "changes_requested"):
        update["status"] = "reviewed"
    await supa.patch("content_items", {"id": f"eq.{item_id}"}, update)

    open_high = sum(1 for r in rows if r["decision"] == "open" and r["severity"] == "high" and r["status"] != "verified")
    await supa.insert("audit_log", [{
        "actor_id": actor_id,
        "action": "reviewed",
        "entity": "content_item",
        "entity_id": item_id,
        "details": {"findings": len(rows), "open_high": open_high, "engine": "rules", "version": item["version"]},
    }])
    return {"item_id": item_id, "title": item["title"], "channel": item["channel"],
            "findings": len(rows), "open_high": open_high}
