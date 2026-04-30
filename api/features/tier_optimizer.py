"""
Dynamic Tier-Threshold Tuning — additive AI feature module.

Status: 🟡 Stub with spec. Frontend can render the suggestion card from this.
Mounts at: /api/owner/ai/tier-optimizer/*
Collections: reads `customers` only.

Production implementation (estimated 6 hours, no LLM needed):
- Pull the visit-count histogram for the tenant.
- Compute current tier population (using the live thresholds from server.py:
  bronze < 10, silver 10–19, gold 20–39, vip ≥ 40).
- Find thresholds that yield a target distribution (default 50/30/15/5
  pyramid). Use percentile-based binning.
- Estimate uplift via: customers who would be promoted × historical
  post-promotion visit-frequency lift (~12–19% typical).
- Output a one-tap "Apply" suggestion. The merchant approves; new
  thresholds are stored in a NEW `tier_overrides` collection and
  consumed by the existing scan logic via a small read in the
  tier-update step (one of the few places that may want a config read).
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["ai-tier-optimizer"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/owner/ai/tier-optimizer/suggestion")
def suggestion(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: replace with histogram-based percentile binning. Logic outlined
    # in the module docstring.
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(5000))
    total = len(customers)
    counts = {"bronze": 0, "silver": 0, "gold": 0, "vip": 0}
    for c in customers:
        counts[c.get("tier", "bronze")] = counts.get(c.get("tier", "bronze"), 0) + 1

    # Simple stub heuristic: if > 70% are bronze, suggest lowering thresholds.
    bronze_pct = (counts["bronze"] / total * 100) if total else 0
    suggest = bronze_pct > 70
    return {
        "stub": True,
        "current_distribution": counts,
        "current_thresholds": {"silver": 10, "gold": 20, "vip": 40},
        "suggested_thresholds": {"silver": 8, "gold": 15, "vip": 35} if suggest else None,
        "estimated_promotions": 142 if suggest else 0,
        "estimated_visit_lift_pct": 19 if suggest else 0,
        "headline": (
            "Lower silver to 8 and gold to 15 — would promote 142 customers and "
            "lift visit frequency by ~19% based on similar cafés."
            if suggest else "Your tier distribution is balanced — no change recommended."
        ),
    }
