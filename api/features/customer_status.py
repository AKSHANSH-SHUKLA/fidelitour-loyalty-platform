"""
Configurable Active/Inactive customer definition.

Status: ✅ Implemented.
Mounts at: /api/owner/customer-status/*
Collections:
  - `customer_status_config` (one doc per tenant)  — config storage
  - `customers` (existing)                          — read-only

Owner sets a definition (e.g. "active = visited within 21 days"); endpoints
return matching customers using that definition. Existing customer-list
endpoints in server.py are NOT modified — this is an additive parallel API.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from auth import require_role

router = APIRouter(tags=["customer-status"])
_db = None

# Defaults match the existing server.py "inactive 30d" thresholds
DEFAULT_ACTIVE_DAYS = 30
DEFAULT_DORMANT_DAYS = 90


def init(db):
    global _db
    _db = db
    try:
        db.customer_status_config.create_index("tenant_id", unique=True)
    except Exception:
        pass


class StatusConfig(BaseModel):
    tenant_id: Optional[str] = None
    active_within_days: int = DEFAULT_ACTIVE_DAYS       # visited within N days = active
    dormant_after_days: int = DEFAULT_DORMANT_DAYS      # last visit older than N days = dormant
    minimum_visits_for_active: int = 1                  # need at least N total visits to count as active
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@router.get("/api/owner/customer-status/config")
def get_config(token_data=Depends(require_role(["business_owner", "manager"]))):
    doc = _db.customer_status_config.find_one({"tenant_id": token_data.tenant_id})
    if not doc:
        return StatusConfig(tenant_id=token_data.tenant_id).model_dump()
    doc.pop("_id", None)
    return doc


@router.put("/api/owner/customer-status/config")
def update_config(
    cfg: StatusConfig,
    token_data=Depends(require_role(["business_owner"])),
):
    cfg.tenant_id = token_data.tenant_id
    cfg.updated_at = datetime.now(timezone.utc)
    payload = cfg.model_dump()
    _db.customer_status_config.update_one(
        {"tenant_id": token_data.tenant_id},
        {"$set": payload},
        upsert=True,
    )
    return payload


def _resolve_config(tenant_id: str) -> StatusConfig:
    doc = _db.customer_status_config.find_one({"tenant_id": tenant_id}) or {}
    return StatusConfig(**{**StatusConfig().model_dump(), **{k: v for k, v in doc.items() if k != "_id"}})


def _classify(customer: dict, cfg: StatusConfig, now: datetime) -> str:
    visits = int(customer.get("visits", 0) or 0)
    last = customer.get("last_visit_date")
    if visits < cfg.minimum_visits_for_active or not last:
        return "new" if visits == 0 else "inactive"
    days_since = (now - last).total_seconds() / 86400.0
    if days_since <= cfg.active_within_days:
        return "active"
    if days_since >= cfg.dormant_after_days:
        return "dormant"
    return "inactive"


@router.get("/api/owner/customer-status/list")
def list_by_status(
    status: Optional[str] = None,         # 'active' | 'inactive' | 'dormant' | 'new' | None=all
    limit: int = 1000,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    """Returns customers tagged with their resolved status using the tenant's
    configured thresholds. Existing /api/owner/customers endpoint is unaffected."""
    cfg = _resolve_config(token_data.tenant_id)
    now = datetime.now(timezone.utc)
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(limit))
    out = []
    counts = {"active": 0, "inactive": 0, "dormant": 0, "new": 0}
    for c in customers:
        c.pop("_id", None)
        st = _classify(c, cfg, now)
        counts[st] = counts.get(st, 0) + 1
        if status and st != status:
            continue
        c["computed_status"] = st
        out.append(c)
    return {
        "config": cfg.model_dump(),
        "counts": counts,
        "customers": out,
    }


@router.get("/api/owner/customer-status/summary")
def summary(token_data=Depends(require_role(["business_owner", "manager"]))):
    """Lightweight counts only — for a dashboard tile."""
    cfg = _resolve_config(token_data.tenant_id)
    now = datetime.now(timezone.utc)
    customers = list(_db.customers.find({"tenant_id": token_data.tenant_id}).limit(20000))
    counts = {"active": 0, "inactive": 0, "dormant": 0, "new": 0}
    for c in customers:
        st = _classify(c, cfg, now)
        counts[st] = counts.get(st, 0) + 1
    return {"config": cfg.model_dump(), "counts": counts, "total": len(customers)}
