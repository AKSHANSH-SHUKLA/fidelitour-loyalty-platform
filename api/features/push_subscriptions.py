"""
Web Push subscription management — lets customer browsers register for
push notifications, and lets the backend fan out messages.

Status: ✅ Implemented.
Mounts at: /api/customer/push/* and /api/owner/push/*
Collections: `push_subscriptions` (one per customer device)

Flow:
    1. Customer visits their wallet card on phone (e.g. /card/FT-XXXXXX)
    2. Frontend asks for notification permission, gets browser subscription
    3. Frontend POSTs subscription to /api/customer/push/subscribe
    4. From now on, auto-campaigns dispatch via Web Push (free) instead of SMS
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import require_role

router = APIRouter(tags=["web-push"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        db.push_subscriptions.create_index("customer_id")
        db.push_subscriptions.create_index([("tenant_id", 1), ("customer_id", 1)])
        db.push_subscriptions.create_index("endpoint", unique=True)
    except Exception:
        pass


class SubscribeRequest(BaseModel):
    tenant_slug: str
    barcode_id: str
    subscription: Dict[str, Any]   # the raw browser PushSubscription JSON


class TestPushRequest(BaseModel):
    barcode_id: str
    title: Optional[str] = "FidéliTour"
    body: Optional[str] = "Test web push from FidéliTour"


@router.get("/api/public/vapid-public-key")
def vapid_public_key():
    """Customer browsers fetch this to subscribe."""
    from services.web_push import public_key, is_configured           # noqa: WPS433
    if not is_configured():
        return {"configured": False, "key": ""}
    return {"configured": True, "key": public_key()}


@router.post("/api/customer/push/subscribe")
def subscribe(req: SubscribeRequest):
    """Browser subscribes a customer to web push notifications."""
    tenant = _db.tenants.find_one({"slug": req.tenant_slug})
    if not tenant:
        return {"ok": False, "error": "tenant_not_found"}
    customer = _db.customers.find_one({
        "tenant_id": tenant["id"], "barcode_id": req.barcode_id
    })
    if not customer:
        return {"ok": False, "error": "customer_not_found"}

    endpoint = (req.subscription or {}).get("endpoint")
    if not endpoint:
        return {"ok": False, "error": "missing_endpoint"}

    _db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {
            "$set": {
                "tenant_id": tenant["id"],
                "customer_id": customer["id"],
                "subscription": req.subscription,
                "endpoint": endpoint,
                "updated_at": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )
    return {"ok": True}


@router.post("/api/customer/push/unsubscribe")
def unsubscribe(req: SubscribeRequest):
    endpoint = (req.subscription or {}).get("endpoint")
    if endpoint:
        _db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"ok": True}


@router.post("/api/owner/push/test")
def test_push(
    req: TestPushRequest,
    token_data=Depends(require_role(["business_owner"])),
):
    """Owner sends a test push to one of their own customers (verification)."""
    from services.web_push import send_push, is_configured            # noqa: WPS433
    if not is_configured():
        return {"sent": False, "error": "vapid_not_configured"}

    customer = _db.customers.find_one({
        "tenant_id": token_data.tenant_id, "barcode_id": req.barcode_id
    })
    if not customer:
        return {"sent": False, "error": "customer_not_found"}

    subs = list(_db.push_subscriptions.find({
        "tenant_id": token_data.tenant_id, "customer_id": customer["id"],
    }))
    if not subs:
        return {"sent": False, "error": "no_active_subscriptions"}

    sent = 0
    expired = []
    for s in subs:
        result = send_push(s["subscription"], req.title or "FidéliTour", req.body or "Test")
        if result.get("sent"):
            sent += 1
        elif result.get("expired"):
            expired.append(s["endpoint"])
    # Clean up expired endpoints
    if expired:
        _db.push_subscriptions.delete_many({"endpoint": {"$in": expired}})
    return {"sent": sent, "subs_total": len(subs), "expired_cleaned": len(expired)}


def fan_out_to_customer(tenant_id: str, customer_id: str, title: str, body: str) -> Dict[str, Any]:
    """Helper: send a push to all of one customer's subscribed devices.
    Called by auto_campaigns._dispatch_message."""
    if _db is None:
        return {"sent": 0, "error": "db_not_initialised"}
    from services.web_push import send_push, is_configured            # noqa: WPS433
    if not is_configured():
        return {"sent": 0, "error": "vapid_not_configured"}

    subs = list(_db.push_subscriptions.find({
        "tenant_id": tenant_id, "customer_id": customer_id
    }))
    if not subs:
        return {"sent": 0, "error": "no_subscription"}

    sent = 0
    expired = []
    for s in subs:
        r = send_push(s["subscription"], title, body)
        if r.get("sent"):
            sent += 1
        elif r.get("expired"):
            expired.append(s["endpoint"])
    if expired:
        _db.push_subscriptions.delete_many({"endpoint": {"$in": expired}})
    return {"sent": sent, "subs_total": len(subs), "expired_cleaned": len(expired)}
