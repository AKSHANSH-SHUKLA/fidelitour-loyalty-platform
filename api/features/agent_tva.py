"""
Agent — TVA / CA3 (declaration de TVA). Agent capability #6.

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tid}/tva*
Storage: tva_declarations; reads fact_invoices + fact_received_invoices.

WHAT IT DOES
    For a given period the agent computes a DRAFT CA3:
        TVA collectée   = Σ VAT on VALIDATED sales invoices in the period
        TVA déductible  = Σ VAT on ACCEPTED/PAID supplier invoices in the period
        TVA nette       = collectée − déductible
            > 0  → TVA à payer            (CA3 ligne ~28/32)
            < 0  → crédit de TVA à reporter/rembourser
    It breaks the collectée down per rate (the CA3 wants 20/10/5,5/2,1 % lines)
    and files it as status="draft". It NEVER télédéclare — filing to the DGFiP is
    a signed act reserved for the expert-comptable / the client. The agent lays
    the number on the desk; the human signs.

WHY ONLY VALIDATED / ACCEPTED
    An unreviewed sale or an unaccepted supplier invoice has no business moving
    the VAT total — the same books discipline as the FEC export. Drafts never
    reach the declaration.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-tva"])
_db = None

ACCEPTED_PURCHASE_STATES = ("accepted", "paid")


def init(db):
    global _db
    _db = db
    try:
        _db.tva_declarations.create_index([("tenant_id", 1), ("period_start", 1)])
    except Exception:
        pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _audit(*args, **kwargs):
    try:
        from features import audit
        audit.log(*args, **kwargs)
    except Exception:
        pass


def _in_period(d: str, start: str, end: str) -> bool:
    d = str(d or "")[:10]
    return bool(d) and start <= d <= end


def compute_ca3(tenant_id: str, start: str, end: str) -> Dict[str, Any]:
    """Pure computation — used by the endpoint and directly by tests."""
    from services import statuses as stt
    collected = 0.0
    by_rate: Dict[str, Dict[str, float]] = {}
    for i in _db.fact_invoices.find({"tenant_id": tenant_id}):
        i = stt.ensure(i)
        if i.get("review_status") != "validated":
            continue
        if not _in_period(i.get("date"), start, end):
            continue
        for ln in i.get("lines", []):
            rate = f"{float(ln.get('vat_rate') or 0):g}"
            ht = float(ln.get("line_total_ht")
                       or float(ln.get("quantity", 1)) * float(ln.get("unit_price", 0)))
            vat = round(ht * float(ln.get("vat_rate") or 0) / 100.0, 2)
            slot = by_rate.setdefault(rate, {"base_ht": 0.0, "tva": 0.0})
            slot["base_ht"] = round(slot["base_ht"] + ht, 2)
            slot["tva"] = round(slot["tva"] + vat, 2)
            collected = round(collected + vat, 2)

    deductible = 0.0
    for r in _db.fact_received_invoices.find({"tenant_id": tenant_id}):
        if r.get("state") not in ACCEPTED_PURCHASE_STATES:
            continue
        d = r.get("date") or (r.get("received_at") or "")[:10]
        if not _in_period(d, start, end):
            continue
        deductible = round(deductible + float(r.get("total_vat") or 0), 2)

    net = round(collected - deductible, 2)
    return {
        "period_start": start, "period_end": end,
        "tva_collectee": round(collected, 2),
        "tva_deductible": round(deductible, 2),
        "tva_nette": net,
        "sens": "a_payer" if net >= 0 else "credit",
        "credit_a_reporter": round(-net, 2) if net < 0 else 0.0,
        "collectee_par_taux": by_rate,
    }


@router.post("/api/cabinet/dossiers/{tenant_id}/tva/run")
def run_tva(tenant_id: str, body: Dict[str, Any],
            token_data=Depends(require_role(["comptable"]))):
    """Agent drafts the CA3 for a period. Human trigger; agent identity."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])

    start = (body.get("period_start") or "").strip()
    end = (body.get("period_end") or "").strip()
    if not start or not end:
        raise HTTPException(422, "Indiquez la période (period_start, period_end en AAAA-MM-JJ).")
    if end < start:
        raise HTTPException(422, "Période invalide : la fin précède le début.")

    ca3 = compute_ca3(tenant_id, start, end)
    decl = {"id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
            "status": "draft", "created_by": co.agent_email_for(m["cabinet_id"]),
            "created_at": _now(), **ca3}
    _db.tva_declarations.insert_one(dict(decl))
    decl.pop("_id", None)
    _audit("agent.tva_drafted", tenant_id=tenant_id, actor=agent_actor,
           object_kind="tva_declaration", object_id=decl["id"],
           after={"nette": ca3["tva_nette"], "sens": ca3["sens"],
                  "period": f"{start}→{end}"},
           detail={"triggered_by": token_data.email})
    return {"ok": True, "declaration": decl}


@router.get("/api/cabinet/dossiers/{tenant_id}/tva")
def list_tva(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    out = []
    for d in _db.tva_declarations.find({"tenant_id": tenant_id}).sort("created_at", -1):
        d.pop("_id", None)
        out.append(d)
    return {"declarations": out}
