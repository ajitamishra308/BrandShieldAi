"""Rule-based review engine (no AI).

These are plain functions that take plain data (dicts) and return findings, so they are
easy to test. Every finding cites a brand rule (G-x), an approved fact (F-x) or a
terminology entry. Nothing is flagged without a source.

Checks (Stage 2):
  * brand name spelling, banned terms (terminology list)
  * health claims, superlatives without evidence
  * channel tone (emojis, shouting)
  * prices, discounts, delivery terms and other numbers compared with approved facts
  * missing end date on offers
  * expired or soon-to-expire facts
  * ingredient claims that are not in the approved facts
  * contradictions between items of the same campaign
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
STATUS_ORDER = {
    "contradicted": 0, "mismatch": 1, "expired_fact": 2, "rule_violation": 3,
    "unsupported": 4, "needs_human": 5, "verified": 6,
}


# ---------------------------------------------------------------- small helpers
def fmt_date(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def parse_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def fact_number(fact: dict) -> float | None:
    value = fact.get("numeric_value")
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def is_expired(fact: dict, today: date) -> bool:
    until = parse_date(fact.get("valid_until"))
    return bool(until and until < today)


def expires_soon(fact: dict, today: date, days: int = 7) -> bool:
    until = parse_date(fact.get("valid_until"))
    return bool(until and today <= until <= today + timedelta(days=days))


def _norm(text: str) -> str:
    return re.sub(r"[\s\-]+", " ", text.lower()).strip()


def _finding(*, claim, status, severity, source_id, explanation, origin,
             suggested_fix=None, claim_type=None) -> dict:
    return {
        "claim": claim,
        "claim_type": claim_type,
        "status": status,
        "severity": severity,
        "source_id": source_id,
        "explanation": explanation,
        "suggested_fix": suggested_fix,
        "origin": origin,
    }


# ---------------------------------------------------------------- claim extraction
MONEY = re.compile(
    r"(?:₹|\brs\.?|\binr)\s*(?P<n1>\d+(?:,\d{2,3})*(?:\.\d+)?)"
    r"|(?P<n2>\d+(?:,\d{2,3})*(?:\.\d+)?)\s*(?:rupees|\brs\b)",
    re.I,
)
PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s?%")
UNIT_WORDS = {"days": r"days?", "bottles": r"bottles?", "cities": r"cit(?:y|ies)"}
SYNONYMS = {
    "price": ["price", "only", "just", "now", "buy", "get", "pack", "cost", "for"],
    "delivery": ["delivery", "delivered", "shipping", "free", "orders", "order", "above"],
    "discount": ["discount", "off", "save", "offer"],
    "shelf": ["shelf", "life", "lasts", "last", "fresh", "refrigerated", "fridge", "expiry"],
    "pack": ["pack", "bottles", "bottle"],
    "availability": ["available", "availability", "cities", "city", "delivered"],
}
STOP_WORDS = {"the", "and", "for", "with", "from", "size"}


@dataclass
class Claim:
    group: str                # what the number is about, e.g. "money:F-4" or "discount"
    value: float
    text: str                 # exact text in the draft
    start: int
    end: int
    fact_id: str | None       # approved fact this claim is compared with
    exact: bool = False       # equals an approved value
    replacement: str | None = None


def fact_keywords(fact: dict) -> set[str]:
    source = f"{fact.get('fact_key', '')} {fact.get('label', '')}".lower()
    words = {w for w in re.findall(r"[a-z]{3,}", source) if w not in STOP_WORDS}
    extra: set[str] = set()
    for name, synonyms in SYNONYMS.items():
        if name in words:
            extra.update(synonyms)
    return words | extra


def _score(text: str, start: int, end: int, fact: dict) -> int:
    window = text[max(0, start - 50): end + 50].lower()
    return len(set(re.findall(r"[a-z]+", window)) & fact_keywords(fact))


def _money_text(prefix_source: str, number: float) -> str:
    prefix = re.match(r"(₹|rs\.?|inr)", prefix_source, re.I)
    label = prefix.group(1) if prefix else "Rs"
    label = "₹" if label == "₹" else ("INR" if label.lower() == "inr" else "Rs")
    amount = f"{number:,.0f}" if float(number).is_integer() else f"{number:,.2f}"
    return f"{label}{amount}" if label == "₹" else f"{label} {amount}"


def extract_claims(text: str, facts: list[dict]) -> list[Claim]:
    claims: list[Claim] = []

    # prices, delivery thresholds and other rupee amounts
    inr = [f for f in facts if (f.get("unit") or "").upper() == "INR" and fact_number(f) is not None]
    for m in MONEY.finditer(text):
        value = float((m.group("n1") or m.group("n2")).replace(",", ""))
        scored = [(_score(text, m.start(), m.end(), f), f) for f in inr]
        exact = [(s, f) for s, f in scored if abs(fact_number(f) - value) < 0.01]
        fact, exact_flag = None, False
        if exact:
            fact, exact_flag = max(exact, key=lambda t: t[0])[1], True
        elif scored:
            best_score, best_fact = max(scored, key=lambda t: t[0])
            if best_score > 0:
                fact = best_fact
        claims.append(Claim(
            group=f"money:{fact['id']}" if fact else "money:other",
            value=value, text=m.group(0), start=m.start(), end=m.end(),
            fact_id=fact["id"] if fact else None, exact=exact_flag,
            replacement=_money_text(m.group(0), fact_number(fact)) if fact else None,
        ))

    # discounts (a percentage counts as a discount only when the words around it say so)
    percent_facts = [f for f in facts if (f.get("unit") or "").lower() == "percent" and fact_number(f) is not None]
    discount_fact = next((f for f in percent_facts if "discount" in fact_keywords(f)), percent_facts[0] if percent_facts else None)
    for m in PERCENT.finditer(text):
        after = text[m.end(): m.end() + 15].lower()
        before = text[max(0, m.start() - 20): m.start()].lower()
        if not (re.search(r"\b(off|discount|cashback)\b", after) or re.search(r"\b(save|flat|extra|discount|up to|upto)\b", before)):
            continue
        tail = re.match(r"\s*(off|discount)\b", text[m.end():], re.I)
        end = m.end() + (tail.end() if tail else 0)
        value = float(m.group(1))
        exact = bool(discount_fact and abs(fact_number(discount_fact) - value) < 0.01)
        replacement = None
        if discount_fact:
            replacement = discount_fact["value"] + (f" {tail.group(1)}" if tail else "")
        claims.append(Claim(
            group="discount", value=value, text=text[m.start():end], start=m.start(), end=end,
            fact_id=discount_fact["id"] if discount_fact else None, exact=exact, replacement=replacement,
        ))

    # counts with units (days, bottles, cities), only when the surrounding words fit the fact
    for fact in facts:
        unit = (fact.get("unit") or "").lower()
        number = fact_number(fact)
        if unit not in UNIT_WORDS or number is None:
            continue
        for m in re.finditer(rf"(\d+)\s*(?:x\s*)?{UNIT_WORDS[unit]}\b", text, re.I):
            if _score(text, m.start(), m.end(), fact) == 0:
                continue
            value = float(m.group(1))
            claims.append(Claim(
                group=f"unit:{fact['id']}", value=value, text=m.group(0), start=m.start(), end=m.end(),
                fact_id=fact["id"], exact=abs(number - value) < 0.01,
                replacement=re.sub(r"\d+", str(int(number)), m.group(0), count=1),
            ))
    return claims


# ---------------------------------------------------------------- rule patterns
SUPERLATIVE = re.compile(
    r"world['’]?s\s+best|#\s?1\b|\bno\.?\s?1\b|\bnumber\s+(?:one|1)\b|\bbest\b(?!\s+before)"
    r"|\bunbeatable\b|\bfinest\b|\bgreatest\b|\bunmatched\b",
    re.I,
)
HEALTH = [
    re.compile(r"\bcure[sd]?\b(?:\s+\w+)?", re.I),
    re.compile(
        r"\b(?:treat|treats|prevent|prevents|heal|heals|reverse|reverses)\s+(?:\w+\s+){0,2}"
        r"(?:disease|diseases|cancer|diabetes|covid|infection|infections|illness|arthritis)\b", re.I),
]
EMOJI = re.compile("[\u2600-\u27BF\U0001F300-\U0001FAFF]")
SHOUTING = re.compile(r"\b[A-Z]{3,}(?:\s+[A-Z]{2,})+\b")
EXCLAIM = re.compile(r"!{3,}")
INGREDIENT_CLAIM = re.compile(
    r"100\s?%\s*natural|no\s+added\s+sugar|sugar[\s-]?free|zero\s+sugar|no\s+sugar|preservative[\s-]?free"
    r"|no\s+preservatives?|\borganic\b|\bvegan\b|gluten[\s-]?free|no\s+artificial\s+\w+",
    re.I,
)
DATE_MENTION = re.compile(
    r"\b(till|until|valid|ends?|ending|expires?)\b"
    r"|\b\d{1,2}\s?(?:st|nd|rd|th)?\s?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b"
    r"|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b",
    re.I,
)


def _rule_on(rules: dict[str, dict], rule_id: str) -> bool:
    rule = rules.get(rule_id)
    return bool(rule and rule.get("active", True))


def _rule_severity(rules: dict[str, dict], rule_id: str, default: str = "medium") -> str:
    return (rules.get(rule_id) or {}).get("severity", default)


def _match_case(original: str, replacement: str) -> str:
    if original[:1].isupper() and replacement[:1].islower():
        return replacement[:1].upper() + replacement[1:]
    return replacement


def _fact_text(fact: dict) -> str:
    return f"{fact['id']} ({fact['label']}: {fact['value']}; source: {fact['source']})"



def _sibling_conflict(claim: Claim, siblings: list[dict] | None):
    """First item of the campaign that states a different value for the same thing."""
    for other in siblings or []:
        for other_claim in other["claims"]:
            if other_claim.group == claim.group and abs(other_claim.value - claim.value) > 0.01:
                return other, other_claim
    return None, None

# ---------------------------------------------------------------- the review
def review_item(
    item: dict,
    rules: list[dict],
    facts: list[dict],
    terms: list[dict],
    today: date,
    siblings: list[dict] | None = None,
    claims: list[Claim] | None = None,
) -> dict:
    """Review one content item. Returns {"findings": [...], "linked_facts": [...]}."""
    text = item["body"]
    channel = item.get("channel", "other")
    rules_by_id = {r["id"]: r for r in rules}
    facts_by_id = {f["id"]: f for f in facts}
    findings: list[dict] = []
    spans: list[tuple[int, int]] = []
    linked: dict[str, str] = {}  # fact id -> first claim text that used it

    def overlaps(span: tuple[int, int]) -> bool:
        return any(span[0] < e and s < span[1] for s, e in spans)

    def add_rule_finding(span: tuple[int, int], finding: dict) -> None:
        if overlaps(span):
            return
        spans.append(span)
        findings.append(finding)

    # 1. brand name spelling (G-3)
    brand = next((f for f in facts if f.get("fact_key") == "brand_name"), None)
    if brand and _rule_on(rules_by_id, "G-3"):
        parts = re.findall(r"[A-Z][a-z]*|[a-z]+|\d+", brand["value"])
        if len(parts) > 1:
            pattern = re.compile(r"\b" + r"[\s\-]*".join(parts) + r"\b", re.I)
            for m in pattern.finditer(text):
                if m.group(0) != brand["value"]:
                    add_rule_finding((m.start(), m.end()), _finding(
                        claim=m.group(0), claim_type="term", status="rule_violation",
                        severity=_rule_severity(rules_by_id, "G-3"), source_id="G-3", origin="rule",
                        explanation=f'The product name must be written "{brand["value"]}" (rule G-3, approved fact {brand["id"]}).',
                        suggested_fix=brand["value"]))

    # 2. banned terms from the terminology list
    for term in terms:
        banned = (term.get("banned_term") or "").strip()
        if not banned:
            continue
        pattern = re.compile(r"(?<!\w)" + r"\s+".join(re.escape(p) for p in banned.split()) + r"(?!\w)", re.I)
        rule_id = term.get("rule_id") or f"TERM-{term.get('id')}"
        if term.get("rule_id") and not _rule_on(rules_by_id, term["rule_id"]):
            continue
        for m in pattern.finditer(text):
            preferred = term.get("preferred_term")
            note = f" {term['note']}." if term.get("note") else ""
            add_rule_finding((m.start(), m.end()), _finding(
                claim=m.group(0), claim_type="term", status="rule_violation",
                severity=_rule_severity(rules_by_id, term.get("rule_id") or "", "medium"),
                source_id=rule_id, origin="rule",
                explanation=f'"{m.group(0)}" is on the banned-terms list.{note}'
                            + (f' Use "{preferred}" instead.' if preferred else " Remove or rephrase it."),
                suggested_fix=_match_case(m.group(0), preferred) if preferred else None))

    # 3. health claims (G-4)
    if _rule_on(rules_by_id, "G-4"):
        for pattern in HEALTH:
            for m in pattern.finditer(text):
                add_rule_finding((m.start(), m.end()), _finding(
                    claim=m.group(0), claim_type="health", status="rule_violation",
                    severity=_rule_severity(rules_by_id, "G-4", "high"), source_id="G-4", origin="rule",
                    explanation="Health claims are not allowed: the product must not be said to cure, treat or prevent anything (rule G-4). "
                                "Describe taste and ingredients instead."))

    # 4. superlatives without evidence (G-7)
    if _rule_on(rules_by_id, "G-7"):
        natural = next((re.search(r"100\s?%\s*natural", f["value"], re.I) for f in facts if re.search(r"100\s?%\s*natural", f["value"], re.I)), None)
        ingredients = next((f for f in facts if f.get("fact_key") == "ingredients"), None)
        for m in SUPERLATIVE.finditer(text):
            follows = re.match(r"\s+(juice|juices|drink|brand|product|pack|taste)\b", text[m.end():], re.I)
            fix = "100% natural" if (natural and follows) else None
            hint = f' Approved claim: "{ingredients["value"]}" ({ingredients["id"]}).' if ingredients else ""
            add_rule_finding((m.start(), m.end()), _finding(
                claim=m.group(0), claim_type="superlative", status="unsupported",
                severity=_rule_severity(rules_by_id, "G-7", "high"), source_id="G-7", origin="rule",
                explanation=f'"{m.group(0)}" is a superlative and no approved evidence supports it (rule G-7).{hint}',
                suggested_fix=fix))

    # 5. channel tone (G-2) and friendly voice (G-1)
    emojis = list(EMOJI.finditer(text))
    if _rule_on(rules_by_id, "G-2"):
        if channel == "email" and emojis:
            first = emojis[0]
            add_rule_finding((first.start(), first.end()), _finding(
                claim=first.group(0), claim_type="tone", status="rule_violation",
                severity=_rule_severity(rules_by_id, "G-2", "low"), source_id="G-2", origin="rule",
                explanation=f"Emails must not use emojis (rule G-2). {len(emojis)} found.", suggested_fix=""))
        elif channel == "instagram" and len(emojis) > 2:
            third = emojis[2]
            add_rule_finding((third.start(), third.end()), _finding(
                claim=third.group(0), claim_type="tone", status="rule_violation",
                severity=_rule_severity(rules_by_id, "G-2", "low"), source_id="G-2", origin="rule",
                explanation=f"Instagram posts may use at most two emojis (rule G-2). {len(emojis)} found.", suggested_fix=""))
    if _rule_on(rules_by_id, "G-1"):
        for m in SHOUTING.finditer(text):
            add_rule_finding((m.start(), m.end()), _finding(
                claim=m.group(0), claim_type="tone", status="rule_violation",
                severity=_rule_severity(rules_by_id, "G-1", "low"), source_id="G-1", origin="rule",
                explanation="Capital letters read as shouting. Use a friendly, simple voice (rule G-1).",
                suggested_fix=m.group(0).capitalize()))
        for m in EXCLAIM.finditer(text):
            add_rule_finding((m.start(), m.end()), _finding(
                claim=m.group(0), claim_type="tone", status="rule_violation",
                severity=_rule_severity(rules_by_id, "G-1", "low"), source_id="G-1", origin="rule",
                explanation="Several exclamation marks read as shouting (rule G-1).", suggested_fix="!"))

    # 6. numbers compared with approved facts (G-5)
    if claims is None:
        claims = extract_claims(text, facts)
    fact_checks_on = _rule_on(rules_by_id, "G-5") if "G-5" in rules_by_id else True
    if fact_checks_on:
        for c in claims:
            fact = facts_by_id.get(c.fact_id) if c.fact_id else None
            if fact is None:
                if c.group == "money:other":
                    findings.append(_finding(
                        claim=c.text, claim_type="price", status="needs_human",
                        severity="medium", source_id="G-5", origin="fact",
                        explanation="This amount is not in the approved facts. Confirm it with the fact owner before publishing."))
                continue
            kind = "discount" if c.group == "discount" else ("price" if c.group.startswith("money") else "count")
            linked.setdefault(fact["id"], c.text)
            if c.exact:
                findings.append(_finding(
                    claim=c.text, claim_type=kind, status="verified", severity="low",
                    source_id=fact["id"], origin="fact",
                    explanation=f"Matches approved fact {_fact_text(fact)}."))
            else:
                other, other_claim = _sibling_conflict(c, siblings)
                if other:
                    findings.append(_finding(
                        claim=c.text, claim_type=kind, status="mismatch", severity="high",
                        source_id=fact["id"], origin="campaign",
                        explanation=f'This {channel} item says "{c.text}" but the {other["channel"]} item '
                                    f'"{other["title"]}" in the same campaign says "{other_claim.text}". '
                                    f'The approved fact is {_fact_text(fact)}.',
                        suggested_fix=c.replacement))
                else:
                    findings.append(_finding(
                        claim=c.text, claim_type=kind, status="contradicted", severity="high",
                        source_id=fact["id"], origin="fact",
                        explanation=f'The draft says "{c.text}" but the approved fact is {_fact_text(fact)}.',
                        suggested_fix=c.replacement))

        # offers need an end date (G-6)
        discount_claims = [c for c in claims if c.group == "discount"]
        if discount_claims and _rule_on(rules_by_id, "G-6") and not DATE_MENTION.search(text):
            c = discount_claims[0]
            fact = facts_by_id.get(c.fact_id) if c.fact_id else None
            until = parse_date(fact.get("valid_until")) if fact else None
            fix = None
            if until:
                base = c.replacement if (c.replacement and not c.exact) else c.text
                fix = f"{base}, offer ends {fmt_date(until)}"
            findings.append(_finding(
                claim=c.text, claim_type="discount", status="rule_violation",
                severity=_rule_severity(rules_by_id, "G-6"), source_id="G-6", origin="rule",
                explanation="Every time-limited offer must state when it ends (rule G-6)."
                            + (f" The approved offer ends on {fmt_date(until)} ({fact['id']})." if until else ""),
                suggested_fix=fix))

        # 7. ingredient claims must exist in the approved facts
        text_facts = [f for f in facts if not (f.get("unit") or "").strip() or (f.get("unit") or "").lower() == "text"]
        for m in INGREDIENT_CLAIM.finditer(text):
            normal = _norm(m.group(0))
            support = next((f for f in text_facts if normal in _norm(f["value"])), None)
            if support:
                linked.setdefault(support["id"], m.group(0))
                findings.append(_finding(
                    claim=m.group(0), claim_type="ingredient", status="verified", severity="low",
                    source_id=support["id"], origin="fact",
                    explanation=f"Supported by approved fact {_fact_text(support)}."))
            else:
                ing = next((f for f in facts if f.get("fact_key") == "ingredients"), None)
                hint = f' The approved wording is "{ing["value"]}" ({ing["id"]}).' if ing else ""
                findings.append(_finding(
                    claim=m.group(0), claim_type="ingredient", status="unsupported",
                    severity=_rule_severity(rules_by_id, "G-5", "high"), source_id="G-5", origin="fact",
                    explanation=f'"{m.group(0)}" is not supported by any approved fact (rule G-5).{hint}'))

    # 8. expired or soon-to-expire facts that the draft relies on
    for fact_id, claim_text in linked.items():
        fact = facts_by_id[fact_id]
        until = parse_date(fact.get("valid_until"))
        if is_expired(fact, today):
            findings.append(_finding(
                claim=claim_text, claim_type="expiry", status="expired_fact", severity="high",
                source_id=fact_id, origin="fact",
                explanation=f"Approved fact {fact_id} ({fact['label']}) expired on {fmt_date(until)}. "
                            f"Ask the owner ({fact['owner']}) to confirm or update it before publishing."))
        elif expires_soon(fact, today):
            days = (until - today).days
            findings.append(_finding(
                claim=claim_text, claim_type="expiry", status="needs_human", severity="low",
                source_id=fact_id, origin="fact",
                explanation=f"Approved fact {fact_id} ({fact['label']}) expires in {days} day(s), on {fmt_date(until)}. "
                            "Check that the content is still needed after that date."))

    # 9. numbers without an approved fact: compare the items of the campaign with each other
    for c in claims:
        if c.fact_id or c.group.endswith(":other"):
            continue
        other, other_claim = _sibling_conflict(c, siblings)
        if other:
            findings.append(_finding(
                claim=c.text, claim_type="campaign", status="mismatch", severity="high",
                source_id="campaign", origin="campaign",
                explanation=f'This {channel} item says "{c.text}" but the {other["channel"]} item '
                            f'"{other["title"]}" in the same campaign says "{other_claim.text}". '
                            "There is no approved fact for this, so decide the correct value."))

    findings.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 3), STATUS_ORDER.get(f["status"], 9)))
    return {"findings": findings, "linked_facts": list(linked.keys())}
