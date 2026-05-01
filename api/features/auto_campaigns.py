"""
Auto-generated messages for birthdays + inactive customers.

Status: ✅ Implemented (template-based; no LLM dependency).
Mounts at: /api/owner/auto-campaigns/*
Collections:
  - `auto_campaign_config` (one doc per tenant)
  - existing `customers`, `tenants`, `push_notifications`, `customer_status_config`

Each tenant configures:
  - birthday: enabled, message template, points_to_credit (welcome-style boost)
  - inactive: enabled, message template, days_to_trigger (uses
    customer_status_config when not overridden)

The actual sending is template substitution + write to `push_notifications`
for now (so it shows up on the History page). Real channel delivery (Apple
Wallet APN, Google Wallet, SMS, Email) is wired separately — adding more
channels means appending to `dispatch_message()` below without touching the
rest of this module.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from auth import require_role

router = APIRouter(tags=["auto-campaigns"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        db.auto_campaign_config.create_index("tenant_id", unique=True)
        db.auto_campaign_log.create_index([("tenant_id", 1), ("kind", 1), ("customer_id", 1)])
    except Exception:
        pass


# ---------- Models ----------
class AutoCampaignConfig(BaseModel):
    tenant_id: Optional[str] = None
    birthday_enabled: bool = True
    birthday_message: str = "Joyeux anniversaire {first_name} ! 🎂 Une boisson est offerte aujourd'hui chez {business_name}."
    birthday_bonus_points: int = 50
    inactive_enabled: bool = True
    inactive_message: str = "{first_name}, vous nous manquez chez {business_name}. -10% sur votre prochaine visite — à bientôt !"
    # If 0, falls back to customer_status_config.dormant_after_days
    inactive_trigger_days: int = 0
    # Avoid spamming the same person — wait this many days before re-sending
    inactive_cooldown_days: int = 30
    # Almost-there nudge: triggered when a customer is N visits away from
    # unlocking the next reward (default 1, configurable). Reads stamp +
    # threshold info from the existing card_templates collection.
    almost_there_enabled: bool = True
    almost_there_message: str = "{first_name}, vous êtes à 1 visite d'une récompense chez {business_name} ! ☕"
    almost_there_visits_left: int = 1
    almost_there_cooldown_days: int = 7
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _config(tenant_id: str) -> AutoCampaignConfig:
    doc = _db.auto_campaign_config.find_one({"tenant_id": tenant_id}) or {}
    payload = {**AutoCampaignConfig().model_dump(), **{k: v for k, v in doc.items() if k != "_id"}}
    return AutoCampaignConfig(**payload)


def _substitute(template: str, ctx: Dict[str, Any]) -> str:
    """Lightweight {placeholder} substitution — no f-string, no LLM."""
    out = template or ""
    for k, v in (ctx or {}).items():
        out = out.replace("{" + k + "}", str(v) if v is not None else "")
    return out


def _build_ctx(customer: dict, tenant: dict) -> Dict[str, Any]:
    name = customer.get("name") or ""
    return {
        "first_name": name.split(" ")[0] if name else "",
        "name": name,
        "business_name": tenant.get("name") or "your favourite spot",
        "tier": (customer.get("tier") or "bronze").title(),
        "points": int(customer.get("points", 0) or 0),
        "visits": int(customer.get("visits", 0) or 0),
    }


def _dispatch_message(tenant_id: str, customer: dict, kind: str, title: str, body: str):
    """Write a push-notification record. The History page surfaces these
    immediately; real-channel delivery (SMS / Wallet / Email) hooks here in a
    future iteration without changing callers."""
    _db.push_notifications.insert_one({
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "customer_id": customer.get("id"),
        "type": kind,                  # 'birthday' | 'inactive_rescue'
        "title": title,
        "body": body,
        "sent_at": datetime.now(timezone.utc),
    })
    _db.auto_campaign_log.insert_one({
        "tenant_id": tenant_id,
        "customer_id": customer.get("id"),
        "kind": kind,
        "sent_at": datetime.now(timezone.utc),
    })


# ---------- Config endpoints ----------
@router.get("/api/owner/auto-campaigns/config")
def get_config(token_data=Depends(require_role(["business_owner", "manager"]))):
    return _config(token_data.tenant_id).model_dump()


@router.put("/api/owner/auto-campaigns/config")
def put_config(
    cfg: AutoCampaignConfig,
    token_data=Depends(require_role(["business_owner"])),
):
    cfg.tenant_id = token_data.tenant_id
    cfg.updated_at = datetime.now(timezone.utc)
    payload = cfg.model_dump()
    _db.auto_campaign_config.update_one(
        {"tenant_id": token_data.tenant_id},
        {"$set": payload},
        upsert=True,
    )
    return payload


# ---------- Run endpoints ----------
@router.post("/api/owner/auto-campaigns/run-birthdays")
def run_birthdays(
    dry_run: bool = False,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    cfg = _config(token_data.tenant_id)
    if not cfg.birthday_enabled:
        return {"sent": 0, "reason": "disabled"}
    tenant = _db.tenants.find_one({"id": token_data.tenant_id}) or {}
    today_mmdd = datetime.now(timezone.utc).strftime("%m-%d")

    customers = list(_db.customers.find({
        "tenant_id": token_data.tenant_id,
        "birthday": today_mmdd,
    }).limit(2000))

    sent = 0
    previews = []
    for c in customers:
        # de-dupe: skip if already sent a birthday today
        already = _db.auto_campaign_log.find_one({
            "tenant_id": token_data.tenant_id,
            "customer_id": c["id"],
            "kind": "birthday",
            "sent_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=20)},
        })
        if already:
            continue
        ctx = _build_ctx(c, tenant)
        body = _substitute(cfg.birthday_message, ctx)
        title = f"🎂 {tenant.get('name', '')}".strip()
        if dry_run:
            previews.append({"customer_id": c["id"], "name": c.get("name"), "body": body})
        else:
            _dispatch_message(token_data.tenant_id, c, "birthday", title, body)
            if cfg.birthday_bonus_points > 0:
                _db.customers.update_one({"id": c["id"]}, {"$inc": {"points": cfg.birthday_bonus_points}})
            sent += 1

    return {
        "found": len(customers),
        "sent": sent,
        "dry_run": dry_run,
        "preview": previews if dry_run else None,
    }


@router.post("/api/owner/auto-campaigns/run-inactive")
def run_inactive(
    dry_run: bool = False,
    limit: int = 200,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    cfg = _config(token_data.tenant_id)
    if not cfg.inactive_enabled:
        return {"sent": 0, "reason": "disabled"}

    # Resolve trigger days — fall back to status config if not overridden
    trigger_days = cfg.inactive_trigger_days
    if trigger_days <= 0:
        status_cfg = _db.customer_status_config.find_one({"tenant_id": token_data.tenant_id}) or {}
        trigger_days = int(status_cfg.get("dormant_after_days", 90) or 90)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=trigger_days)
    cooldown_cutoff = now - timedelta(days=max(1, cfg.inactive_cooldown_days))

    tenant = _db.tenants.find_one({"id": token_data.tenant_id}) or {}
    candidates = list(_db.customers.find({
        "tenant_id": token_data.tenant_id,
        "last_visit_date": {"$lte": cutoff},
    }).limit(limit * 5))   # over-fetch to allow filtering by cooldown

    sent = 0
    previews = []
    for c in candidates:
        # respect cooldown — don't pester same customer repeatedly
        recent_log = _db.auto_campaign_log.find_one({
            "tenant_id": token_data.tenant_id,
            "customer_id": c["id"],
            "kind": "inactive_rescue",
            "sent_at": {"$gte": cooldown_cutoff},
        })
        if recent_log:
            continue
        ctx = _build_ctx(c, tenant)
        body = _substitute(cfg.inactive_message, ctx)
        title = f"{tenant.get('name', '')}".strip() or "We miss you"
        if dry_run:
            previews.append({
                "customer_id": c["id"], "name": c.get("name"),
                "days_since_last": (now - c["last_visit_date"]).days if c.get("last_visit_date") else None,
                "body": body,
            })
        else:
            _dispatch_message(token_data.tenant_id, c, "inactive_rescue", title, body)
            sent += 1
        if sent >= limit and not dry_run:
            break
        if dry_run and len(previews) >= limit:
            break

    return {
        "trigger_days": trigger_days,
        "candidates": len(candidates),
        "sent": sent,
        "dry_run": dry_run,
        "preview": previews if dry_run else None,
    }


@router.post("/api/owner/auto-campaigns/run-almost-there")
def run_almost_there(
    dry_run: bool = False,
    limit: int = 200,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    """Find customers who are EXACTLY `almost_there_visits_left` visits away
    from the next reward, and send them a personalised nudge. Reward cycle
    is read from card_templates: every (visits_per_stamp * reward_threshold_stamps)
    visits unlocks the next reward."""
    cfg = _config(token_data.tenant_id)
    if not cfg.almost_there_enabled:
        return {"sent": 0, "reason": "disabled"}

    tpl = _db.card_templates.find_one({"tenant_id": token_data.tenant_id}) or {}
    visits_per_stamp = max(int(tpl.get("visits_per_stamp", 1) or 1), 1)
    reward_threshold = max(int(tpl.get("reward_threshold_stamps", 10) or 10), 1)
    cycle = visits_per_stamp * reward_threshold

    target_remaining = max(1, int(cfg.almost_there_visits_left))
    now = datetime.now(timezone.utc)
    cooldown_cutoff = now - timedelta(days=max(1, cfg.almost_there_cooldown_days))
    tenant = _db.tenants.find_one({"id": token_data.tenant_id}) or {}

    sent = 0
    previews = []
    candidates = list(_db.customers.find({
        "tenant_id": token_data.tenant_id,
        "visits": {"$gt": 0},
    }).limit(limit * 5))

    for c in candidates:
        v = int(c.get("visits", 0) or 0)
        # Visits remaining inside the current reward cycle. When v % cycle == 0
        # the customer just hit a reward (no nudge needed); otherwise:
        remaining = cycle - (v % cycle) if (v % cycle) else cycle
        if remaining != target_remaining:
            continue
        # cooldown
        recent_log = _db.auto_campaign_log.find_one({
            "tenant_id": token_data.tenant_id,
            "customer_id": c["id"],
            "kind": "almost_there",
            "sent_at": {"$gte": cooldown_cutoff},
        })
        if recent_log:
            continue
        ctx = _build_ctx(c, tenant)
        ctx["visits_left"] = target_remaining
        body = _substitute(cfg.almost_there_message, ctx)
        title = f"{tenant.get('name', '')}".strip() or "Almost there!"
        if dry_run:
            previews.append({
                "customer_id": c["id"], "name": c.get("name"),
                "visits": v, "visits_left": target_remaining, "body": body,
            })
        else:
            _dispatch_message(token_data.tenant_id, c, "almost_there", title, body)
            sent += 1
        if sent >= limit and not dry_run:
            break
        if dry_run and len(previews) >= limit:
            break

    return {
        "cycle_visits": cycle,
        "target_visits_left": target_remaining,
        "candidates_scanned": len(candidates),
        "sent": sent,
        "dry_run": dry_run,
        "preview": previews if dry_run else None,
    }


@router.get("/api/owner/auto-campaigns/log")
def log(
    days: int = 30,
    kind: Optional[str] = None,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query = {"tenant_id": token_data.tenant_id, "sent_at": {"$gte": cutoff}}
    if kind:
        query["kind"] = kind
    rows = list(_db.auto_campaign_log.find(query).sort("sent_at", -1).limit(500))
    counts: Dict[str, int] = {}
    for r in rows:
        r.pop("_id", None)
        counts[r["kind"]] = counts.get(r["kind"], 0) + 1
    return {"counts": counts, "log": rows}
