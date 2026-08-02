"""
Agent — Facturation récurrente / abonnements (S13).

Status: 🟢 Core (agent capability #2 — the first EMISSION agent).
Mounts at: /api/cabinet/dossiers/{tid}/subscriptions*, /api/cabinet/agent/billing/run
Storage: subscriptions.

THE STANDING INSTRUCTION MODEL (answers "who approved the amount?")
    A human (EC or superviseur) writes the instruction ONCE:
        "Gym Metro — €450 HT + TVA 20% — every month on the 1st"
    That creation IS the approval: the instruction stores who approved it and
    when. From then on the agent is a clerk executing a signed order — it
    copies the numbers, never invents them (exactly like a bank standing
    order: you sign the SIP once, the bank never edits the amount).

    Two locks on every generated invoice:
      1. the SOURCE is human-approved (the subscription),
      2. the OUTPUT is a DRAFT under the agent's own name that still passes
         through the human review queue. The agent transmits nothing.

IDEMPOTENCE
    One invoice per subscription per calendar month (last_run_ym) — running
    the billing five times on the 3rd creates nothing new. A missed cron day
    self-heals: the next run catches up because the check is "day_of_month
    reached and not yet billed this month", not "is today exactly the day".
"""
from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-billing"])
_db = None

PAYMENT_TERM_DAYS = {"net30": 30, "net45": 45, "net60": 60, "immediate": 0}


def init(db):
    global _db
    _db = db
    try:
        _db.subscriptions.create_index([("cabinet_id", 1), ("active", 1)])
        _db.subscriptions.create_index([("tenant_id", 1)])
    except Exception:
        pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _audit(*args, **kwargs):
    try:
        from features import audit
        audit.log(*args, **kwargs)
    except Exception:
        pass


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# --------------------------------------------------------------------------
# CRUD — the standing instruction
# --------------------------------------------------------------------------

@router.post("/api/cabinet/dossiers/{tenant_id}/subscriptions")
def create_subscription(tenant_id: str, body: Dict[str, Any],
                        token_data=Depends(require_role(["comptable"]))):
    """Write the standing instruction. EC/superviseur only — creating it IS
    the approval, so it must come from someone who may approve."""
    from features import cabinet_os as co
    actor = co.require_cabinet_role(token_data.email, co.ASSIGN_ROLES)
    co.assert_can_see_tenant(token_data.email, tenant_id)

    label = (body.get("label") or "").strip()
    if not label:
        raise HTTPException(422, "Donnez un nom à l'abonnement (ex. « Adhésion mensuelle Gym Metro »).")

    buyer = body.get("buyer") or {}
    if not (buyer.get("name") or "").strip():
        raise HTTPException(422, "Le nom du client facturé est obligatoire.")
    if not (buyer.get("address") or "").strip():
        raise HTTPException(422, "L'adresse du client facturé est obligatoire.")
    if buyer.get("is_company", True):
        siren = "".join(ch for ch in str(buyer.get("siren") or "") if ch.isdigit())
        if len(siren) != 9 or not _luhn_ok(siren):
            raise HTTPException(422, "SIREN du client facturé invalide (9 chiffres + clé).")
        buyer["siren"] = siren

    lines = [l for l in (body.get("lines") or [])
             if str(l.get("description") or "").strip()
             and float(l.get("unit_price") or 0) > 0]
    if not lines:
        raise HTTPException(422, "Au moins une ligne avec description et montant est requise.")

    try:
        day = int(body.get("day_of_month", 1))
    except (TypeError, ValueError):
        raise HTTPException(422, "Jour du mois invalide.")
    if not 1 <= day <= 28:
        raise HTTPException(422, "Le jour du mois doit être entre 1 et 28 (pour exister dans tous les mois).")

    doc = {
        "id": str(uuid4()), "cabinet_id": actor["cabinet_id"], "tenant_id": tenant_id,
        "label": label, "buyer": buyer, "lines": lines,
        "day_of_month": day,
        "payment_term": body.get("payment_term") or "net30",
        "operation_category": body.get("operation_category") or "services",
        "active": True,
        # the human approval, recorded forever
        "approved_by": token_data.email, "approved_at": _now(),
        "last_run_ym": None, "last_invoice_id": None,
        "created_at": _now(),
    }
    _db.subscriptions.insert_one(dict(doc))
    _audit("subscription.created", tenant_id=tenant_id, actor=token_data,
           object_kind="subscription", object_id=doc["id"],
           after={"label": label, "day": day,
                  "total_ht": sum(float(l.get("quantity", 1)) * float(l["unit_price"])
                                  for l in lines)})
    doc.pop("_id", None)
    return {"ok": True, "subscription": doc}


@router.get("/api/cabinet/dossiers/{tenant_id}/subscriptions")
def list_subscriptions(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    subs = []
    for d in _db.subscriptions.find({"tenant_id": tenant_id}).sort("created_at", -1):
        d.pop("_id", None)
        subs.append(d)
    return {"subscriptions": subs}


@router.patch("/api/cabinet/subscriptions/{sub_id}")
def update_subscription(sub_id: str, body: Dict[str, Any],
                        token_data=Depends(require_role(["comptable"]))):
    """Pause/resume. Amount or terms change = deactivate + create a new one:
    the old instruction stays intact as the record of what WAS approved."""
    from features import cabinet_os as co
    actor = co.require_cabinet_role(token_data.email, co.ASSIGN_ROLES)
    sub = _db.subscriptions.find_one({"id": sub_id, "cabinet_id": actor["cabinet_id"]})
    if not sub:
        raise HTTPException(404, "Abonnement introuvable.")
    if "active" not in body:
        raise HTTPException(422, "Seul le champ 'active' est modifiable — pour changer le montant, créez un nouvel abonnement.")
    _db.subscriptions.update_one({"id": sub_id},
                                 {"$set": {"active": bool(body["active"]),
                                           "updated_at": _now(),
                                           "updated_by": token_data.email}})
    _audit("subscription.toggled", tenant_id=sub["tenant_id"], actor=token_data,
           object_kind="subscription", object_id=sub_id,
           after={"active": bool(body["active"])})
    return {"ok": True}


# --------------------------------------------------------------------------
# the billing run
# --------------------------------------------------------------------------

def run_billing_for_cabinet(cabinet_id: str, triggered_by: str) -> Dict[str, Any]:
    """Execute every due standing instruction of one cabinet, as the agent."""
    from features import cabinet_os as co
    from features import facturation as F
    agent = co.ensure_agent(cabinet_id)
    actor = co.agent_actor(cabinet_id)
    today = _today()
    ym = today.strftime("%Y-%m")

    drafted, skipped, errors = 0, 0, []
    for sub in _db.subscriptions.find({"cabinet_id": cabinet_id, "active": True}):
        if sub.get("last_run_ym") == ym or today.day < int(sub["day_of_month"]):
            skipped += 1
            continue
        term_days = PAYMENT_TERM_DAYS.get(sub.get("payment_term", "net30"), 30)
        payload = {
            "tenant_id": sub["tenant_id"],
            "buyer": sub["buyer"],
            "lines": [dict(l) for l in sub["lines"]],
            "date": today.isoformat(),
            "supply_date": today.isoformat(),
            "due_date": (today + timedelta(days=term_days)).isoformat(),
            "payment_term": sub.get("payment_term", "net30"),
            "operation_category": sub.get("operation_category", "services"),
            "notes": f"Abonnement : {sub['label']}",
            "send": False,          # DRAFT — the agent never transmits alone
        }
        try:
            res = F.create_invoice(payload, token_data=actor)
            inv = res["invoice"]
            _db.subscriptions.update_one({"id": sub["id"]},
                                         {"$set": {"last_run_ym": ym,
                                                   "last_invoice_id": inv["id"],
                                                   "last_run_at": _now()}})
            drafted += 1
            _audit("agent.invoice_drafted", tenant_id=sub["tenant_id"], actor=actor,
                   object_kind="invoice", object_id=inv["id"],
                   after={"number": inv["number"], "total_ttc": inv["total_ttc"],
                          "subscription": sub["label"]},
                   detail={"triggered_by": triggered_by,
                           "subscription_id": sub["id"],
                           "approved_by": sub.get("approved_by"),
                           "agent": agent["user_email"]})
        except Exception as e:                                   # noqa: BLE001
            # one broken subscription must not stop the others
            errors.append({"subscription": sub["label"], "error": str(e)[:120]})
    return {"ok": True, "invoices_drafted": drafted, "skipped": skipped,
            "errors": errors}


@router.post("/api/cabinet/agent/billing/run")
def run_billing(token_data=Depends(require_role(["comptable"]))):
    """Human trigger (EC/superviseur) — same core as the daily cron."""
    from features import cabinet_os as co
    actor_h = co.require_cabinet_role(token_data.email, co.ASSIGN_ROLES)
    return run_billing_for_cabinet(actor_h["cabinet_id"], token_data.email)
