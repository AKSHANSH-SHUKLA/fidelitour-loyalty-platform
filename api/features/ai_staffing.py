"""
Optimal Staffing Recommendations — additive AI feature module.

Status: 🟡 Stub with spec. Returns mock schedule; underlying math is straightforward.
Mounts at: /api/owner/ai/staffing/*
Collections: reads `visits` only.

Production implementation (estimated 6 hours, no LLM needed):
- Bucket last 12 weeks of visits into a 7×24 matrix (weekday × hour).
- Compute per-cell average + 95th percentile.
- Use a "service-rate" config (default: 1 staff handles 8 customers/hour) to
  derive recommended staff count per slot.
- Compare against the merchant's declared roster (when they enter it) and
  surface "understaffed Saturday 11–14" / "overstaffed Monday 14–17".
- Pure stats — no LLM, runs in milliseconds.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["ai-staffing"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/owner/ai/staffing/recommendations")
def recommendations(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: compute from visits matrix; see module docstring for the algorithm.
    return {
        "stub": True,
        "service_rate_customers_per_staff_hour": 8,
        "recommendations": [
            {"day": "Sat", "hour_range": "11:00–14:00", "current": 1, "recommended": 2,
             "reasoning": "Avg 17 visits/hr in this window; 1 staff member is overloaded."},
            {"day": "Mon", "hour_range": "14:00–17:00", "current": 2, "recommended": 1,
             "reasoning": "Avg 4 visits/hr in this window; second staff member is idle."},
        ],
    }
