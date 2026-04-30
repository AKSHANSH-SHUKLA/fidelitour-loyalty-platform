"""
Per-Customer Churn Forecasting — additive AI feature module.

Status: ✅ Implemented (math-based, no LLM cost).
Mounts at: /api/owner/ai/churn/*
Collections: reads `customers` and `visits` only; no new collection.

Logic per customer:
- Compute the typical gap between consecutive visits (avg_gap_days).
- Compute days_since_last_visit.
- churn_score = days_since_last / avg_gap (clamped to [0, 3]).
  - score < 1.0  → on rhythm
  - 1.0–1.5      → slightly late, monitor
  - 1.5–2.0      → at risk, send rescue offer
  - > 2.0        → likely churned
- Customers with < 3 visits use a tenant-wide median rhythm as fallback.

This is the foundation of the "per-customer rescue" workflow. The merchant
sees a list of at-risk customers ranked by impact (LTV × score).
"""
from __future__ import annotations

from datetime import datetime, timezone
from statistics import median
from typing import List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException

from auth import require_role
from models import TokenData

router = APIRouter(tags=["ai-churn"])
_db = None


def init(db):
    global _db
    _db = db


def _avg_gap_days(visits: List[dict]) -> Optional[float]:
    if len(visits) < 2:
        return None
    times = sorted(v["visit_time"] for v in visits if v.get("visit_time"))
    if len(times) < 2:
        return None
    gaps = [(times[i] - times[i - 1]).total_seconds() / 86400.0 for i in range(1, len(times))]
    if not gaps:
        return None
    return sum(gaps) / len(gaps)


def _tenant_median_gap(tenant_id: str) -> float:
    customers = list(_db.customers.find({"tenant_id": tenant_id, "visits": {"$gte": 3}}).limit(500))
    gaps = []
    for c in customers:
        visits = list(_db.visits.find({"tenant_id": tenant_id, "customer_id": c["id"]}).limit(50))
        g = _avg_gap_days(visits)
        if g is not None:
            gaps.append(g)
    return median(gaps) if gaps else 14.0   # 14-day fallback


def _score_customer(customer: dict, fallback_gap: float, now: datetime) -> Dict:
    visits = list(_db.visits.find({
        "tenant_id": customer["tenant_id"],
        "customer_id": customer["id"],
    }).limit(100))
    avg_gap = _avg_gap_days(visits)
    method = "personal"
    if not avg_gap:
        avg_gap = fallback_gap
        method = "tenant_median_fallback"

    last_visit = customer.get("last_visit_date")
    if not last_visit:
        # Use customer creation as a baseline
        last_visit = customer.get("created_at") or now
    days_since = max(0.0, (now - last_visit).total_seconds() / 86400.0)

    raw_score = days_since / avg_gap if avg_gap > 0 else 0.0
    score = max(0.0, min(3.0, raw_score))

    if score < 1.0:
        bucket = "on_rhythm"
    elif score < 1.5:
        bucket = "slightly_late"
    elif score < 2.0:
        bucket = "at_risk"
    else:
        bucket = "likely_churned"

    impact = round(score * float(customer.get("total_amount_paid", 0) or 0), 2)
    return {
        "customer_id": customer["id"],
        "name": customer.get("name"),
        "tier": customer.get("tier"),
        "ltv": round(float(customer.get("total_amount_paid", 0) or 0), 2),
        "visits": int(customer.get("visits", 0) or 0),
        "avg_gap_days": round(avg_gap, 1),
        "days_since_last": round(days_since, 1),
        "score": round(score, 2),
        "bucket": bucket,
        "impact_score": impact,        # higher = more revenue at stake
        "method": method,
    }


@router.get("/api/owner/ai/churn/predictions")
def predictions(
    bucket: Optional[str] = None,
    limit: int = 200,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    now = datetime.now(timezone.utc)
    fallback = _tenant_median_gap(token_data.tenant_id)
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(5000))
    rows = [_score_customer(c, fallback, now) for c in customers]
    if bucket:
        rows = [r for r in rows if r["bucket"] == bucket]
    rows.sort(key=lambda r: r["impact_score"], reverse=True)
    return {"tenant_median_gap_days": round(fallback, 1), "predictions": rows[:limit]}


@router.get("/api/owner/ai/churn/at-risk")
def at_risk_summary(token_data=Depends(require_role(["business_owner", "manager"]))):
    """Compact dashboard tile: counts per bucket + top 5 highest-impact at-risk."""
    now = datetime.now(timezone.utc)
    fallback = _tenant_median_gap(token_data.tenant_id)
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(5000))
    rows = [_score_customer(c, fallback, now) for c in customers]
    counts = {"on_rhythm": 0, "slightly_late": 0, "at_risk": 0, "likely_churned": 0}
    for r in rows:
        counts[r["bucket"]] += 1
    rescue = [r for r in rows if r["bucket"] in ("at_risk", "slightly_late")]
    rescue.sort(key=lambda r: r["impact_score"], reverse=True)
    return {
        "buckets": counts,
        "top_rescue_targets": rescue[:5],
        "tenant_median_gap_days": round(fallback, 1),
    }


@router.get("/api/owner/ai/churn/customer/{customer_id}")
def customer_score(
    customer_id: str,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    customer = _db.customers.find_one({"id": customer_id, "tenant_id": token_data.tenant_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    fallback = _tenant_median_gap(token_data.tenant_id)
    return _score_customer(customer, fallback, datetime.now(timezone.utc))
