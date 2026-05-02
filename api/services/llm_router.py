"""
LLM Router — decides which model to use for each query, and what context
strategy to use (raw, SQL pre-summary, or rich context).

Implements the rule set agreed with the client:
    - Categories A, B, C, H, I  → cheap model + SQL exact answer
    - Categories D, G           → expensive model + SQL summary
    - Categories E, F           → expensive model + RICH raw context
    - Categories J, K           → expensive model (full context)
    - Background automations    → cheap model where possible

Pure routing logic. No LLM calls happen here — this just returns a
decision dict that the calling code uses to make the actual call.
"""
from __future__ import annotations
import re
from typing import Optional, Literal


# Model tier names — calling code maps these to actual model identifiers
# (e.g. 'cheap' → 'claude-haiku-4-5' or 'gpt-4o-mini')
ModelTier = Literal["cheap", "mid", "premium"]
ContextStrategy = Literal["sql_exact", "sql_summary", "rich_raw", "minimal"]


# Patterns that flag a query as Category A/B/C — pure lookup/aggregation/trend.
# Matched case-insensitive, on the trimmed query text.
LOOKUP_PATTERNS = [
    r"\bhow many\b",
    r"\bcombien\b",
    r"\btotal\b",
    r"\baverage\b",
    r"\bmoyenne\b",
    r"\bpercentage\b",
    r"\btaux\b",
    r"\bcount\b",
    r"\btop \d+\b",
    r"\btop[- ]?[a-z]+\b",          # "top customers"
    r"\bshow me (all|my|the)\b",
    r"\bliste?\b",
    r"\blist of\b",
    r"\bfind\b",
    r"\bsearch\b",
    r"\bwho hasn'?t\b",
    r"\bwho has\b",
    r"\bwhich customers?\b",
    r"\btrend\b",
    r"\btendance\b",
    r"\bover the (last|past) \d+\b",
    r"\bthis (week|month|year)\b",
    r"\bvs\.? (last|previous)\b",
]

DIAGNOSTIC_PATTERNS = [
    r"\bwhy\b",
    r"\bpourquoi\b",
    r"\bwhat'?s causing\b",
    r"\bwhat'?s wrong\b",
    r"\bwhat happened\b",
    r"\bexplain\b",
    r"\bexpliquer?\b",
]

COMPARATIVE_PATTERNS = [
    r"\bcompare\b",
    r"\bcomparer?\b",
    r"\bvs\.? \w+\b",
    r"\bversus\b",
    r"\bdifference between\b",
    r"\bdifférence entre\b",
    r"\bmore than\b",
    r"\bless than\b",
]

STRATEGIC_PATTERNS = [
    r"\bshould i\b",
    r"\bdois[- ]je\b",
    r"\brecommend\b",
    r"\brecommandation\b",
    r"\bsuggérer\b",
    r"\bsuggest\b",
    r"\bplan\b",
    r"\bstrat[eé]gi\w+\b",
    r"\bwhat should\b",
    r"\bque devrais\b",
    r"\bworth (it|trying)\b",
]

EXPLORATORY_PATTERNS = [
    r"\banything (interesting|notable|weird|unusual)\b",
    r"\btell me what\b",
    r"\bwhat'?s (going on|happening|interesting)\b",
    r"\bwhat should i (focus|look at|prioritise|prioritize)\b",
    r"\bquoi (faire|prioriser)\b",
]

CREATIVE_PATTERNS = [
    r"\bwrite (me )?(a|an|some)\b",
    r"\bdraft (a|an|some)\b",
    r"\bcompose\b",
    r"\brédige\w*\b",
    r"\b(create|generate) (a|an) (campaign|message|email|sms|push)\b",
]

TRANSLATE_PATTERNS = [
    r"\btranslate\b",
    r"\btraduire?\b",
    r"\bin (arabic|english|spanish|german|italian)\b",
    r"\ben (arabe|anglais|espagnol|allemand|italien)\b",
]


def _matches(patterns, query_lower: str) -> bool:
    return any(re.search(p, query_lower) for p in patterns)


def route_query(query: str, *, intent: Optional[str] = None) -> dict:
    """Classify a query and return the routing decision.

    Returns:
        {
          "category": str,              # A..L category from the rule set
          "model_tier": "cheap"|"mid"|"premium",
          "context_strategy": "sql_exact"|"sql_summary"|"rich_raw"|"minimal",
          "max_output_tokens": int,
          "rationale": str,             # human-readable why
        }

    `intent` is an optional explicit intent override (used for auto-messages
    where we already know the category — e.g. "birthday", "translate").
    """
    q = (query or "").strip().lower()

    # ---- Explicit intent overrides (auto-messages, system calls) ----
    if intent:
        return _route_by_intent(intent)

    # ---- Empty / very short queries → cheap (default) ----
    if len(q) < 3:
        return _decision("A", "cheap", "minimal", 200,
                         "Empty/trivial query — default to cheap.")

    # ---- Translation: always cheap ----
    if _matches(TRANSLATE_PATTERNS, q):
        return _decision("I", "cheap", "minimal", 600,
                         "Translation task — cheap model handles perfectly.")

    # ---- Creative writing → mid (brand-defining) ----
    if _matches(CREATIVE_PATTERNS, q):
        return _decision("K", "mid", "sql_summary", 800,
                         "Creative writing (campaign/message draft) — mid model with brand-voice context.")

    # ---- Exploratory → expensive (mid) + RICH context ----
    if _matches(EXPLORATORY_PATTERNS, q):
        return _decision("F", "mid", "rich_raw", 800,
                         "Open-ended exploration — needs broad data scan, mid model.")

    # ---- Diagnostic ("why") → expensive + RICH context ----
    if _matches(DIAGNOSTIC_PATTERNS, q):
        return _decision("E", "mid", "rich_raw", 700,
                         "Diagnostic query — needs full context to spot non-obvious causes.")

    # ---- Strategic ("should I", "recommend") → mid + SQL summary ----
    if _matches(STRATEGIC_PATTERNS, q):
        return _decision("G", "mid", "sql_summary", 700,
                         "Strategic recommendation — mid model with summarised facts + brand voice.")

    # ---- Comparative → mid + SQL summary ----
    if _matches(COMPARATIVE_PATTERNS, q):
        return _decision("D", "mid", "sql_summary", 500,
                         "Comparison — mid model interpreting pre-computed pair of stats.")

    # ---- Lookup / aggregation / trend → cheap + SQL exact ----
    if _matches(LOOKUP_PATTERNS, q):
        return _decision("A/B/C", "cheap", "sql_exact", 250,
                         "Lookup or aggregation — SQL gives exact answer, cheap narrates.")

    # ---- Fallback for unclassified → cheap (default save-money) ----
    return _decision("?", "cheap", "minimal", 400,
                     "Unclassified query — default to cheap (cheaper to be wrong cheaply).")


def _route_by_intent(intent: str) -> dict:
    """Routing for known automation intents (no NLP guessing needed)."""
    intent = intent.lower()
    table = {
        # Customer-facing personalised auto-messages — Cat. H
        "birthday":          ("H", "cheap", "minimal", 200, "Birthday auto-message — cheap excels."),
        "inactive_rescue":   ("H", "cheap", "minimal", 200, "Inactive rescue — cheap excels."),
        "welcome":           ("H", "cheap", "minimal", 200, "Welcome message — cheap excels."),
        "almost_there":      ("H", "cheap", "minimal", 200, "Almost-there nudge — cheap excels."),
        "tier_up":           ("H", "cheap", "minimal", 200, "Tier-up congrats — cheap excels."),
        "translate":         ("I", "cheap", "minimal", 600, "Translation — cheap."),
        # Customer-facing high-stakes — Cat. J
        "complaint_deflect": ("J", "mid", "rich_raw", 600, "Complaint reply — mid model, full review context."),
        "review_response":   ("J", "mid", "rich_raw", 600, "Public review reply — mid model."),
        # Background automations — Cat. L
        "smart_alert":       ("L", "cheap", "sql_exact", 200, "Alert narration on math-detected anomaly."),
        "ai_suggestion":     ("L", "cheap", "sql_summary", 400, "AI suggestion card — cheap."),
        "anomaly_narrate":   ("L", "cheap", "sql_summary", 300, "Narrate math-detected anomaly."),
        "churn_explain":     ("L", "cheap", "sql_summary", 250, "Churn explanation per at-risk customer."),
        # Heavier creative / brand work — Cat. K
        "newsletter":        ("K", "mid", "sql_summary", 1000, "Monthly newsletter — mid model."),
        "voice_campaign":    ("K", "mid", "rich_raw", 700, "Voice memo → campaign draft."),
        "ab_variant":        ("K", "mid", "minimal", 300, "A/B variant — mid model with brand voice."),
        "brand_voice":       ("K", "mid", "rich_raw", 500, "Brand-voice profile retrain."),
    }
    if intent in table:
        cat, tier, ctx, max_out, why = table[intent]
        return _decision(cat, tier, ctx, max_out, why)
    # Unknown intent → safe default
    return _decision("?", "cheap", "minimal", 400, f"Unknown intent '{intent}' — default cheap.")


def _decision(category: str, tier: ModelTier, ctx: ContextStrategy,
              max_out: int, rationale: str) -> dict:
    return {
        "category": category,
        "model_tier": tier,
        "context_strategy": ctx,
        "max_output_tokens": max_out,
        "rationale": rationale,
    }


# ---- Example calls (for documentation) ---------------------------------
EXAMPLES = [
    ("How many customers today?",                        "A/B/C", "cheap", "sql_exact"),
    ("Top 10 customers",                                 "A/B/C", "cheap", "sql_exact"),
    ("Translate this campaign to Arabic",                "I",     "cheap", "minimal"),
    ("Compare last month vs this month",                 "D",     "mid",   "sql_summary"),
    ("Why did Saturday traffic drop?",                   "E",     "mid",   "rich_raw"),
    ("Anything interesting in my data this week?",       "F",     "mid",   "rich_raw"),
    ("Should I run a Sunday brunch promotion?",          "G",     "mid",   "sql_summary"),
    ("Write me a campaign about pumpkin spice",          "K",     "mid",   "sql_summary"),
    ("Visits over the last 30 days",                     "A/B/C", "cheap", "sql_exact"),
    ("Recommend a campaign for inactive customers",      "G",     "mid",   "sql_summary"),
]
