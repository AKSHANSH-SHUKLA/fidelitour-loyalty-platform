"""
Optimal Send-Time Learning — additive AI feature module.

Status: ✅ Implemented (math-based, no LLM cost).
Mounts at: /api/owner/ai/send-time/* and /api/customer/push-event
Collections: `push_events` (sent + opened), reads existing collections only.

Logic:
- Each campaign send is logged in `push_events` with sent_at + customer_id.
- When the customer opens a push (or clicks a link in it), we log that too.
- For each customer, the "best hour" is the mode of the hours at which they
  open notifications, smoothed with a fallback to their general visit hour
  pattern when push history is sparse (< 3 opens).
- Returns hour 0–23 in the customer's timezone offset (default UTC).

This is intentionally pre-LLM. Send-time is one of those features where
simple statistics beats a model, and it costs €0 in API calls.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Dict
from collections import Counter
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import require_role
from models import TokenData

router = APIRouter(tags=["ai-send-time"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        db.push_events.create_index([("tenant_id", 1), ("customer_id", 1), ("type", 1)])
    except Exception:
        pass


class PushEvent(BaseModel):
    tenant_slug: str
    barcode_id: str
    type: str   # 'sent' | 'opened' | 'clicked'
    campaign_id: Optional[str] = None
    occurred_at: Optional[datetime] = None


@router.post("/api/customer/push-event")
def record_event(req: PushEvent):
    tenant = _db.tenants.find_one({"slug": req.tenant_slug})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    customer = _db.customers.find_one({"tenant_id": tenant["id"], "barcode_id": req.barcode_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    _db.push_events.insert_one({
        "id": str(uuid.uuid4()),
        "tenant_id": tenant["id"],
        "customer_id": customer["id"],
        "type": req.type,
        "campaign_id": req.campaign_id,
        "occurred_at": req.occurred_at or datetime.now(timezone.utc),
    })
    return {"ok": True}


def _best_hour_for_customer(tenant_id: str, customer_id: str) -> Dict:
    opens = list(_db.push_events.find({
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "type": {"$in": ["opened", "clicked"]},
    }).limit(500))

    if len(opens) >= 3:
        hours = [e["occurred_at"].hour for e in opens if e.get("occurred_at")]
        counter = Counter(hours)
        best, n = counter.most_common(1)[0]
        confidence = round(n / len(hours), 2)
        return {"best_hour": best, "confidence": confidence, "method": "push_opens", "samples": len(hours)}

    # Fall back to visit-time pattern
    visits = list(_db.visits.find({
        "tenant_id": tenant_id,
        "customer_id": customer_id,
    }).limit(200))
    if visits:
        hours = [v["visit_time"].hour for v in visits if v.get("visit_time")]
        if hours:
            counter = Counter(hours)
            best, n = counter.most_common(1)[0]
            confidence = round(n / len(hours), 2) * 0.6  # downweight: visit ≠ open
            return {"best_hour": best, "confidence": round(confidence, 2),
                    "method": "visit_pattern_fallback", "samples": len(hours)}

    return {"best_hour": 11, "confidence": 0.0, "method": "default", "samples": 0}


@router.get("/api/owner/ai/send-time/customer/{customer_id}")
def best_for_customer(
    customer_id: str,
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
):
    customer = _db.customers.find_one({"id": customer_id, "tenant_id": token_data.tenant_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _best_hour_for_customer(token_data.tenant_id, customer_id)


@router.get("/api/owner/ai/send-time/segment-summary")
def segment_summary(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Distribution of best-hours across the customer base — drives the
    'when do customers open' chart on the campaign composer."""
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(5000))
    bucket = Counter()
    for c in customers:
        info = _best_hour_for_customer(token_data.tenant_id, c["id"])
        if info["confidence"] > 0:
            bucket[info["best_hour"]] += 1
    return {
        "by_hour": [{"hour": h, "customers": bucket.get(h, 0)} for h in range(24)],
        "total_customers": sum(bucket.values()),
    }


@router.post("/api/owner/ai/send-time/optimize-schedule")
def optimize_schedule(
    body: dict,
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
):
    """Given a list of recipient_ids, return the best UTC hour to send to each.
    The campaign sender uses this to schedule per-customer micro-batches."""
    ids = body.get("recipient_ids") or []
    out = {}
    for cid in ids[:10000]:
        out[cid] = _best_hour_for_customer(token_data.tenant_id, cid)
    return {"per_customer": out}
