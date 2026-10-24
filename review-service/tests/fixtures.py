"""Test data that mirrors database/seed.sql (the fictional FreshJuice brand kit)."""
from datetime import date

TODAY = date(2026, 10, 22)

RULES = [
    {"id": "G-1", "severity": "low", "active": True},
    {"id": "G-2", "severity": "low", "active": True},
    {"id": "G-3", "severity": "medium", "active": True},
    {"id": "G-4", "severity": "high", "active": True},
    {"id": "G-5", "severity": "high", "active": True},
    {"id": "G-6", "severity": "medium", "active": True},
    {"id": "G-7", "severity": "high", "active": True},
]


def _fact(id_, key, label, value, num, unit, source, owner, until):
    return {"id": id_, "fact_key": key, "label": label, "value": value, "numeric_value": num,
            "unit": unit, "source": source, "owner": owner, "valid_until": until}


FACTS = [
    _fact("F-1", "brand_name", "Brand name", "FreshJuice", None, "text", "Brand guidelines v1", "Brand admin", None),
    _fact("F-2", "ingredients", "Ingredients claim", "100% natural fruit juice, no added sugar", None, "text", "Ingredient sheet 2026", "Quality team", None),
    _fact("F-3", "pack_size", "Pack size", "6 bottles of 200 ml", 6, "bottles", "Product catalogue", "Product team", None),
    _fact("F-4", "price_6_pack", "Price of the 6-bottle pack", "Rs 1,199", 1199, "INR", "Price list Oct 2026", "Pricing team", "2026-12-31"),
    _fact("F-5", "launch_discount", "Festive launch discount", "15%", 15, "percent", "Campaign brief", "Marketing manager", "2026-11-15"),
    _fact("F-6", "free_delivery", "Free delivery threshold", "Free delivery on orders above Rs 799", 799, "INR", "Delivery policy", "Operations", None),
    _fact("F-7", "shelf_life", "Shelf life", "5 days when refrigerated", 5, "days", "Quality sheet", "Quality team", None),
    _fact("F-8", "availability", "Availability", "Available in 12 cities", 12, "cities", "Market sheet", "Operations", "2026-11-30"),
]

TERMS = [
    {"id": 1, "banned_term": "cheap", "preferred_term": "affordable", "note": "Avoid wording that suggests low quality", "rule_id": "G-1"},
    {"id": 2, "banned_term": "miracle", "preferred_term": "natural", "note": "Sounds like an unsupported claim", "rule_id": "G-5"},
    {"id": 3, "banned_term": "Fresh Juice", "preferred_term": "FreshJuice", "note": "Brand name is one word", "rule_id": "G-3"},
    {"id": 4, "banned_term": "detox", "preferred_term": None, "note": "Health claim, not allowed (rule G-4)", "rule_id": "G-4"},
]

INSTAGRAM = (
    "Festive launch! Our Fresh Juice is the world's best juice \U0001F379\U0001F379\U0001F379. "
    "Grab the 6-pack for only Rs 999 and get 20% off. Cures tiredness. "
    "FREE DELIVERY on orders above Rs 500!!!"
)
EMAIL = (
    "Subject: FreshJuice festive offer\nDear customer, enjoy the FreshJuice 6-pack at Rs 1,199 with 15% off "
    "until 15 Nov 2026 \U0001F60A. Our juice is 100% natural fruit juice with no added sugar and lasts 10 days "
    "in the fridge. Free delivery on orders above Rs 799."
)
WEBSITE = (
    "FreshJuice is available in 20 cities. Each pack has 6 bottles of 200 ml. "
    "Our cheap and delicious juice is sugar-free."
)

ITEMS = {
    "ig": {"id": "ig", "title": "Instagram launch post", "channel": "instagram", "body": INSTAGRAM},
    "em": {"id": "em", "title": "Launch email", "channel": "email", "body": EMAIL},
    "web": {"id": "web", "title": "Website banner", "channel": "website", "body": WEBSITE},
}
