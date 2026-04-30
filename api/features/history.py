"""
History — past campaigns and push notifications, segregated.

Status: ✅ Implemented.
Mounts at: /api/owner/history/*
Collections: reads `campaigns` and `push_notifications` (existing) — read-only.

Powers a new "History" page in the merchant dashboard. Returns two clearly
separated streams so the UI can show two columns / tabs:
  - past_campaigns: all sent (and historical scheduled/draft) campaigns
  - past_pushes:    every system-sent push (tier-up congrats, etc.)
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["history"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/owner/history/campaigns")
def past_campaigns(
    days: Optional[int] = None,           # None = all-time
    status: Optional[str] = None,         # 'sent' | 'scheduled' | 'draft' | None=any
    limit: int = 200,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    query = {"tenant_id": token_data.tenant_id}
    if status:
        query["status"] = status
    if days is not None and days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query["$or"] = [
            {"sent_at": {"$gte": cutoff}},
            {"created_at": {"$gte": cutoff}},
        ]
    rows = list(
        _db.campaigns.find(query)
        .sort([("sent_at", -1), ("created_at", -1)])
        .limit(limit)
    )
    out = []
    for c in rows:
        c.pop("_id", None)
        out.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "content_preview": (c.get("content") or "")[:120],
            "sent_at": c.get("sent_at"),
            "created_at": c.get("created_at"),
            "targeted_count": c.get("targeted_count", 0),
            "delivered_count": c.get("delivered_count", 0),
            "opens": c.get("opens", 0),
            "clicks": c.get("clicks", 0),
            "visits_from_campaign": c.get("visits_from_campaign", 0),
            "filters": c.get("filters", {}),
        })
    return {"count": len(out), "campaigns": out}


@router.get("/api/owner/history/pushes")
def past_pushes(
    days: Optional[int] = None,
    push_type: Optional[str] = None,      # 'tier_up' | 'campaign' | None=any
    limit: int = 200,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    query = {"tenant_id": token_data.tenant_id}
    if push_type:
        query["type"] = push_type
    if days is not None and days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query["sent_at"] = {"$gte": cutoff}
    rows = list(
        _db.push_notifications.find(query)
        .sort("sent_at", -1)
        .limit(limit)
    )
    out = []
    for p in rows:
        p.pop("_id", None)
        # Resolve recipient name when we have a customer_id
        recipient_name = None
        if p.get("customer_id"):
            cust = _db.customers.find_one({"id": p["customer_id"]}) or {}
            recipient_name = cust.get("name")
        out.append({
            "title": p.get("title"),
            "body": p.get("body"),
            "type": p.get("type"),
            "sent_at": p.get("sent_at"),
            "previous_tier": p.get("previous_tier"),
            "new_tier": p.get("new_tier"),
            "recipient_id": p.get("customer_id"),
            "recipient_name": recipient_name,
        })
    return {"count": len(out), "pushes": out}


@router.get("/api/owner/history/summary")
def summary(token_data=Depends(require_role(["business_owner", "manager"]))):
    """Headline numbers shown at the top of the History page."""
    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)
    last_30 = now - timedelta(days=30)
    return {
        "campaigns_total":      _db.campaigns.count_documents({"tenant_id": tid}),
        "campaigns_sent_total": _db.campaigns.count_documents({"tenant_id": tid, "status": "sent"}),
        "campaigns_30d":        _db.campaigns.count_documents({"tenant_id": tid, "sent_at": {"$gte": last_30}}),
        "pushes_total":         _db.push_notifications.count_documents({"tenant_id": tid}),
        "pushes_30d":           _db.push_notifications.count_documents({"tenant_id": tid, "sent_at": {"$gte": last_30}}),
    }
