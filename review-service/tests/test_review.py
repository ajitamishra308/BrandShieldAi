"""Tests the saving logic with an in-memory stand-in for Supabase."""
import unittest
from unittest import mock

from app import review
from tests.fixtures import FACTS, ITEMS, RULES, TERMS


class FakeDb:
    def __init__(self):
        self.tables = {
            "brand_rules": RULES, "facts": FACTS, "terminology": TERMS,
            "content_items": [
                {**ITEMS["ig"], "campaign_id": "c1", "version": 1, "status": "draft", "created_at": "1"},
                {**ITEMS["em"], "campaign_id": "c1", "version": 1, "status": "in_review", "created_at": "2"},
                {**ITEMS["web"], "campaign_id": "c1", "version": 1, "status": "draft", "created_at": "3"},
            ],
            "findings": [], "item_fact_links": [], "audit_log": [],
        }
        self.patches = []

    async def select(self, table, params=None):
        rows = self.tables[table]
        for key, value in (params or {}).items():
            if value.startswith("eq."):
                rows = [r for r in rows if str(r.get(key)) == value[3:]]
        return [dict(r) for r in rows]

    async def insert(self, table, rows):
        self.tables[table].extend(dict(r) for r in rows)

    async def delete(self, table, params):
        for key, value in params.items():
            self.tables[table] = [r for r in self.tables[table] if str(r.get(key)) != value[3:]]

    async def patch(self, table, params, data):
        self.patches.append((table, dict(params), dict(data)))
        for row in self.tables[table]:
            if all(str(row.get(k)) == v[3:] for k, v in params.items()):
                row.update(data)


class ReviewFlow(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        patcher = mock.patch.multiple(review.supa, select=self.db.select, insert=self.db.insert,
                                      delete=self.db.delete, patch=self.db.patch)
        patcher.start()
        self.addCleanup(patcher.stop)

    async def test_reviews_every_item_of_the_campaign(self):
        out = await review.run_review("ig", "user-1")
        self.assertEqual(len(out["reviewed"]), 3)
        self.assertTrue(self.db.tables["findings"])
        self.assertEqual(len(self.db.tables["audit_log"]), 3)

    async def test_status_moves_to_reviewed_only_from_draft_or_changes_requested(self):
        await review.run_review("ig", "user-1")
        status = {r["id"]: r["status"] for r in self.db.tables["content_items"]}
        self.assertEqual(status, {"ig": "reviewed", "em": "in_review", "web": "reviewed"})
        for row in self.db.tables["content_items"]:
            self.assertTrue(row.get("last_reviewed_at"))

    async def test_facts_used_are_linked_for_the_impact_view(self):
        await review.run_review("ig", "user-1")
        linked = {(r["item_id"], r["fact_id"]) for r in self.db.tables["item_fact_links"]}
        self.assertIn(("ig", "F-4"), linked)
        self.assertIn(("web", "F-8"), linked)

    async def test_earlier_decisions_survive_a_new_review(self):
        await review.run_review("ig", "user-1")
        target = next(f for f in self.db.tables["findings"] if f["item_id"] == "ig" and f["claim"] == "Rs 999")
        target.update(decision="dismissed", decision_reason="Old price on purpose", decided_by="user-1", decided_at="now")
        await review.run_review("ig", "user-1")
        again = [f for f in self.db.tables["findings"] if f["item_id"] == "ig" and f["claim"] == "Rs 999"]
        self.assertEqual(len(again), 1)
        self.assertEqual((again[0]["decision"], again[0]["decision_reason"]), ("dismissed", "Old price on purpose"))

    async def test_rerun_does_not_duplicate_findings(self):
        await review.run_review("ig", "user-1")
        first = len(self.db.tables["findings"])
        await review.run_review("ig", "user-1")
        self.assertEqual(len(self.db.tables["findings"]), first)

    async def test_unknown_item(self):
        with self.assertRaises(review.ItemNotFound):
            await review.run_review("nope", "user-1")


if __name__ == "__main__":
    unittest.main()
