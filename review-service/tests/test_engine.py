import unittest

from app import engine
from tests.fixtures import EMAIL, FACTS, INSTAGRAM, ITEMS, RULES, TERMS, TODAY, WEBSITE


def run(item_key, with_siblings=True):
    claims = {k: engine.extract_claims(v["body"], FACTS) for k, v in ITEMS.items()}
    siblings = []
    if with_siblings:
        siblings = [{"id": o["id"], "title": o["title"], "channel": o["channel"], "claims": claims[k]}
                    for k, o in ITEMS.items() if k != item_key]
    return engine.review_item(ITEMS[item_key], RULES, FACTS, TERMS, TODAY, siblings, claims[item_key])


def find(result, status=None, claim=None, source=None):
    return [f for f in result["findings"]
            if (status is None or f["status"] == status)
            and (claim is None or claim.lower() in f["claim"].lower())
            and (source is None or f["source_id"] == source)]


class InstagramPost(unittest.TestCase):
    def setUp(self):
        self.r = run("ig")

    def test_wrong_price_is_flagged_as_campaign_mismatch_and_fixed(self):
        f = find(self.r, claim="Rs 999")[0]
        self.assertEqual(f["status"], "mismatch")
        self.assertIn("Rs 1,199", f["explanation"])
        self.assertEqual(f["source_id"], "F-4")
        self.assertEqual(f["suggested_fix"], "Rs 1,199")
        self.assertEqual(f["severity"], "high")

    def test_wrong_discount_is_flagged_with_the_other_channel(self):
        f = find(self.r, "mismatch", "20% off", "F-5")[0]
        self.assertIn("15% off", f["explanation"])
        self.assertEqual(f["suggested_fix"], "15% off")

    def test_delivery_amount_is_compared_with_delivery_fact_not_price(self):
        f = find(self.r, claim="Rs 500")[0]
        self.assertEqual(f["source_id"], "F-6")
        self.assertEqual(f["suggested_fix"], "Rs 799")

    def test_superlative_has_no_evidence(self):
        f = find(self.r, "unsupported", "world's best")[0]
        self.assertEqual(f["source_id"], "G-7")
        self.assertEqual(f["suggested_fix"], "100% natural")

    def test_brand_name_reported_once(self):
        self.assertEqual(len(find(self.r, claim="Fresh Juice")), 1)
        self.assertEqual(find(self.r, claim="Fresh Juice")[0]["suggested_fix"], "FreshJuice")

    def test_health_claim(self):
        f = find(self.r, "rule_violation", "Cures")[0]
        self.assertEqual(f["source_id"], "G-4")

    def test_too_many_emojis_on_instagram(self):
        self.assertTrue(find(self.r, "rule_violation", source="G-2"))

    def test_shouting_and_missing_end_date(self):
        self.assertTrue(find(self.r, "rule_violation", "FREE DELIVERY", source="G-1"))
        self.assertTrue(find(self.r, "rule_violation", "20% off", source="G-6"))

    def test_one_finding_per_wrong_number(self):
        self.assertEqual(len(find(self.r, claim="20% off", source="F-5")), 1)
        self.assertEqual(len(find(self.r, claim="Rs 999")), 1)

    def test_without_other_items_the_same_number_is_contradicted(self):
        alone = run("ig", with_siblings=False)
        self.assertEqual(find(alone, claim="Rs 999")[0]["status"], "contradicted")
        self.assertEqual(find(alone, claim="20% off", source="F-5")[0]["status"], "contradicted")

    def test_every_finding_cites_a_source(self):
        for f in self.r["findings"]:
            self.assertTrue(f["source_id"], f)
            self.assertTrue(f["explanation"], f)


class Email(unittest.TestCase):
    def setUp(self):
        self.r = run("em")

    def test_correct_price_and_discount_are_verified(self):
        self.assertTrue(find(self.r, "verified", "Rs 1,199", "F-4"))
        self.assertTrue(find(self.r, "verified", "15% off", "F-5"))

    def test_end_date_present_so_no_g6(self):
        self.assertFalse(find(self.r, source="G-6"))

    def test_emoji_in_email(self):
        f = find(self.r, "rule_violation", source="G-2")[0]
        self.assertEqual(f["suggested_fix"], "")

    def test_shelf_life_contradicted(self):
        f = find(self.r, "contradicted", "10 days")[0]
        self.assertEqual(f["source_id"], "F-7")
        self.assertEqual(f["suggested_fix"], "5 days")

    def test_ingredient_claims_verified(self):
        self.assertTrue(find(self.r, "verified", "100% natural", "F-2"))
        self.assertTrue(find(self.r, "verified", "no added sugar", "F-2"))

    def test_correct_values_are_not_flagged_as_mismatch(self):
        self.assertEqual(find(self.r, "mismatch"), [])

    def test_numbers_without_approved_fact_are_compared_between_items(self):
        no_percent_facts = [f for f in FACTS if f["unit"] != "percent"]
        a = {"id": "a", "title": "Ad", "channel": "ad", "body": "Save 20% off today"}
        b = {"id": "b", "title": "Mail", "channel": "email", "body": "Get 15% off today"}
        ca = engine.extract_claims(a["body"], no_percent_facts)
        cb = engine.extract_claims(b["body"], no_percent_facts)
        sib = [{"id": "b", "title": "Mail", "channel": "email", "claims": cb}]
        r = engine.review_item(a, RULES, no_percent_facts, TERMS, TODAY, sib, ca)
        self.assertTrue(find(r, "mismatch", "20% off", "campaign"))

    def test_discount_fact_expiring_is_not_flagged_yet(self):
        self.assertFalse(find(self.r, "needs_human", source="F-5"))


class Website(unittest.TestCase):
    def setUp(self):
        self.r = run("web")

    def test_city_count_contradicted(self):
        f = find(self.r, "contradicted", "20 cities")[0]
        self.assertEqual((f["source_id"], f["suggested_fix"]), ("F-8", "12 cities"))

    def test_pack_size_verified(self):
        self.assertTrue(find(self.r, "verified", "6 bottles", "F-3"))

    def test_banned_term(self):
        f = find(self.r, "rule_violation", "cheap")[0]
        self.assertEqual((f["source_id"], f["suggested_fix"]), ("G-1", "affordable"))

    def test_sugar_free_is_unsupported(self):
        f = find(self.r, "unsupported", "sugar-free")[0]
        self.assertEqual(f["source_id"], "G-5")


class Edges(unittest.TestCase):
    def item(self, body, channel="website"):
        return {"id": "x", "title": "t", "channel": channel, "body": body}

    def test_100_percent_natural_is_not_a_discount(self):
        claims = engine.extract_claims("It is 100% natural juice.", FACTS)
        self.assertEqual([c for c in claims if c.group == "discount"], [])

    def test_delivery_in_days_is_not_shelf_life(self):
        claims = engine.extract_claims("Delivered in 2 days.", FACTS)
        self.assertEqual([c for c in claims if c.group.startswith("unit:F-7")], [])

    def test_expired_fact_is_flagged(self):
        facts = [dict(f) for f in FACTS]
        facts[4]["valid_until"] = "2026-10-01"
        r = engine.review_item(self.item("Enjoy 15% off until 30 Nov."), RULES, facts, TERMS, TODAY)
        self.assertTrue(find(r, "expired_fact", source="F-5"))

    def test_fact_expiring_soon_needs_human_check(self):
        facts = [dict(f) for f in FACTS]
        facts[4]["valid_until"] = "2026-10-25"
        r = engine.review_item(self.item("Enjoy 15% off until 25 Oct."), RULES, facts, TERMS, TODAY)
        self.assertTrue(find(r, "needs_human", source="F-5"))

    def test_inactive_rule_is_not_checked(self):
        rules = [dict(r) for r in RULES]
        for r in rules:
            if r["id"] == "G-7":
                r["active"] = False
        r = engine.review_item(self.item("The best juice."), rules, FACTS, TERMS, TODAY)
        self.assertFalse(find(r, source="G-7"))

    def test_clean_text_has_no_problems(self):
        r = engine.review_item(self.item("FreshJuice is 100% natural fruit juice with no added sugar."), RULES, FACTS, TERMS, TODAY)
        self.assertEqual([f for f in r["findings"] if f["status"] != "verified"], [])

    def test_amount_unrelated_to_any_fact_needs_human_check(self):
        r = engine.review_item(self.item("Win a gift worth Rs 500."), RULES, FACTS, TERMS, TODAY)
        self.assertTrue(find(r, "needs_human", "Rs 500"))

    def test_best_before_is_allowed(self):
        r = engine.review_item(self.item("Best before the date on the cap."), RULES, FACTS, TERMS, TODAY)
        self.assertFalse(find(r, source="G-7"))


if __name__ == "__main__":
    unittest.main()
