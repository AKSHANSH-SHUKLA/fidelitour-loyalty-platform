"""
Facturation électronique (French e-invoicing) — owner-facing API.

Status: 🟡 In progress (Step 3 of the module build).
Mounts at: /api/owner/facturation/*   (+ public webhook /api/facturation/webhook)
Storage: Mongo collections fact_invoices, fact_received_invoices, fact_ereports,
         fact_credit_notes, fact_coherence_checks; tenant doc facturation_* fields.

Why this exists:
  FidClic's second module. Lets a merchant issue/receive compliant e-invoices,
  do B2C e-reporting, correct via credit notes, and see a "Bouclier Fiscal"
  coherence indicator — all through the PA-agnostic PdpConnector (Mock by
  default; B2Brouter when env is set). Nothing here talks to a PA directly.

Safety:
  - Gated: every route requires the tenant to have `facturation_enabled=True`,
    so loyalty-only tenants never touch this code path.
  - Registered via features/_loader.py; a failure here cannot take down the app.

Legal:
  The coherence score is an INFORMATIONAL consistency indicator, NOT tax advice
  and NOT an ECF (Examen de Conformité Fiscale). The UI carries that disclaimer.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import require_role, get_current_user_data

from services.pdp_connector import (
    get_pdp_connector, InvoiceState, IdempotencyGuard, PdpError,
)
import models as m

router = APIRouter(tags=["facturation"])
_db = None
_guard = IdempotencyGuard()


def init(db):
    global _db
    _db = db


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _tenant(tenant_id: str) -> Dict[str, Any]:
    t = _db.tenants.find_one({"id": tenant_id}) if _db is not None else None
    if not t:
        raise HTTPException(404, "Tenant not found")
    return t


def _require_facturation(token_data) -> Dict[str, Any]:
    """Resolve tenant AND enforce the facturation entitlement gate."""
    t = _tenant(token_data.tenant_id)
    if not t.get("facturation_enabled"):
        raise HTTPException(403, "Le module Facturation n'est pas activé pour ce compte.")
    return t


def _compute_totals(lines: List[Dict[str, Any]]) -> Dict[str, float]:
    ht = vat = 0.0
    for ln in lines:
        line_ht = float(ln.get("quantity", 1)) * float(ln.get("unit_price", 0))
        ln["line_total_ht"] = round(line_ht, 2)
        ht += line_ht
        vat += line_ht * float(ln.get("vat_rate", 20)) / 100.0
    return {"total_ht": round(ht, 2), "total_vat": round(vat, 2),
            "total_ttc": round(ht + vat, 2)}


def _public(inv: Dict[str, Any]) -> Dict[str, Any]:
    inv.pop("_id", None)
    return inv


def compute_bouclier(tenant: Dict[str, Any]) -> Dict[str, Any]:
    """Single source of truth for the Bouclier Fiscal score.

    Transparent, per-invoice rules with an itemised `breakdown` so the number
    is never a black box:
      - each issued invoice stuck in ERROR/REFUSED and NOT yet corrected by an
        avoir (credit note) costs points (capped) -> red
      - DGFiP compliance not activated -> amber
      - no supplier (received) invoice imported yet -> amber
    A refused invoice that HAS a linked avoir is considered corrected and no
    longer penalises the score (this is what makes "create an avoir" verifiable).
    Also returns channel counts (B2B e-invoicing vs B2C e-reporting).
    """
    tid = tenant["id"]
    issued = list(_db.fact_invoices.find({"tenant_id": tid}))
    received = _db.fact_received_invoices.count_documents({"tenant_id": tid})
    credit_notes = list(_db.fact_credit_notes.find({"tenant_id": tid}))
    credited_ids = {cn.get("original_invoice_id") for cn in credit_notes}

    refused = [i for i in issued if i.get("state") in (InvoiceState.ERROR, InvoiceState.REFUSED)]
    uncorrected = [i for i in refused if i.get("id") not in credited_ids]
    corrected = [i for i in refused if i.get("id") in credited_ids]

    einvoicing = sum(1 for i in issued if i.get("channel") == "e-invoicing"
                     or (i.get("channel") is None and (i.get("buyer") or {}).get("is_company", True)))
    ereporting = len(issued) - einvoicing

    alerts: List[Dict[str, Any]] = []
    breakdown: List[Dict[str, Any]] = []
    score = 100

    if uncorrected:
        pts = min(len(uncorrected) * 15, 45)
        score -= pts
        alerts.append({"level": "red",
                       "message": f"{len(uncorrected)} facture(s) refusée(s) ou en erreur à corriger.",
                       "fix_action": "review_rejected"})
        breakdown.append({"level": "red",
                          "label": f"{len(uncorrected)} facture(s) refusée(s) non corrigée(s)",
                          "points": -pts})
    if corrected:
        breakdown.append({"level": "green",
                          "label": f"{len(corrected)} facture(s) refusée(s) corrigée(s) par avoir",
                          "points": 0})
    if not tenant.get("dgfip_activated"):
        score -= 20
        alerts.append({"level": "amber",
                       "message": "Conformité DGFiP non activée — activez pour émettre.",
                       "fix_action": "activate_dgfip"})
        breakdown.append({"level": "amber", "label": "Conformité DGFiP non activée", "points": -20})
    if received == 0:
        score -= 8
        alerts.append({"level": "amber",
                       "message": "Aucune facture fournisseur reçue — cohérence achats/ventes limitée.",
                       "fix_action": None})
        breakdown.append({"level": "amber", "label": "Aucune facture fournisseur importée", "points": -8})

    score = max(0, score)
    reds = sum(1 for a in alerts if a["level"] == "red")
    ambers = sum(1 for a in alerts if a["level"] == "amber")
    band = "red" if reds else ("amber" if ambers else "green")
    if not breakdown:
        breakdown.append({"level": "green", "label": "Aucune anomalie détectée", "points": 0})

    return {
        "score": score, "band": band, "alerts": alerts, "breakdown": breakdown,
        "counts": {
            "issued": len(issued), "received": received,
            "einvoicing": einvoicing, "ereporting": ereporting,
            "credit_notes": len(credit_notes),
            "refused": len(refused), "refused_open": len(uncorrected),
        },
    }


# --------------------------------------------------------------------------
# availability & opt-in (ungated — used by the module chooser)
# --------------------------------------------------------------------------

@router.get("/api/owner/facturation/availability")
def facturation_availability(token_data=Depends(require_role(["business_owner", "manager"]))):
    """Ungated: tells the module chooser whether this tenant has Facturation on.
    Never 403s — loyalty-only tenants get {enabled: false}."""
    t = _tenant(token_data.tenant_id)
    return {
        "enabled": bool(t.get("facturation_enabled")),
        "plan": t.get("facturation_plan"),
        "legal_name": t.get("legal_name"),
        "siren": t.get("siren"),
        "dgfip_activated": bool(t.get("dgfip_activated")),
    }


@router.post("/api/owner/facturation/enable")
def facturation_enable(body: Dict[str, Any],
                       token_data=Depends(require_role(["business_owner"]))):
    """Turn the Facturation module ON for this tenant (simulates the purchase —
    standalone or add-on). Optionally captures legal identity at the same time.
    Stripe billing wiring comes later; for now this is the opt-in switch."""
    t = _tenant(token_data.tenant_id)
    upd: Dict[str, Any] = {
        "facturation_enabled": True,
        "facturation_plan": body.get("plan") or "addon",
    }
    for f in ("legal_name", "siren", "siret", "vat_number", "naf_code",
              "enterprise_size", "vat_regime"):
        if body.get(f):
            upd[f] = body[f]
    _db.tenants.update_one({"id": t["id"]}, {"$set": upd})
    return {"ok": True, "enabled": True, "plan": upd["facturation_plan"]}


# --------------------------------------------------------------------------
# status & activation
# --------------------------------------------------------------------------

@router.get("/api/owner/facturation/status")
def facturation_status(token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    tid = t["id"]
    return {
        "enabled": True,
        "legal_name": t.get("legal_name"),
        "siren": t.get("siren"),
        "siret": t.get("siret"),
        "vat_regime": t.get("vat_regime"),
        "dgfip_activated": bool(t.get("dgfip_activated")),
        "annuaire_status": t.get("annuaire_status"),
        "provider": type(get_pdp_connector()).__name__,
        "counts": compute_bouclier(t)["counts"],
    }


@router.post("/api/owner/facturation/activate")
def facturation_activate(body: Dict[str, Any],
                         token_data=Depends(require_role(["business_owner"]))):
    """Register the company with the PA / DGFiP (PPF Annuaire + tax-report setting)."""
    t = _require_facturation(token_data)
    conn = get_pdp_connector()
    settings = {
        "start_date": body.get("start_date") or "2026-09-01",
        "type_operation": body.get("type_operation") or "services",
        "naf_code": body.get("naf_code") or t.get("naf_code") or "",
        "enterprise_size": body.get("enterprise_size") or t.get("enterprise_size") or "pme",
        "email": body.get("email"),
    }
    try:
        res = conn.activate_compliance(t.get("pdp_account_id") or t["id"], settings)
    except PdpError as e:
        raise HTTPException(502, f"Activation PA échouée: {e.message}")
    _db.tenants.update_one({"id": t["id"]}, {"$set": {
        "dgfip_activated": True,
        "annuaire_status": res.get("annuaire") or res.get("status") or "pending",
        "dgfip_start_date": settings["start_date"],
    }})
    return {"ok": True, "result": res}


# --------------------------------------------------------------------------
# issued invoices
# --------------------------------------------------------------------------

@router.get("/api/owner/facturation/invoices")
def list_invoices(token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    docs = list(_db.fact_invoices.find({"tenant_id": t["id"]}).sort("created_at", -1).limit(500))
    return {"invoices": [_public(d) for d in docs]}


@router.post("/api/owner/facturation/invoices")
def create_invoice(body: Dict[str, Any],
                   token_data=Depends(require_role(["business_owner", "manager"]))):
    """Create a draft invoice. Pass send=true to also transmit immediately."""
    t = _require_facturation(token_data)
    lines = body.get("lines") or []
    if not lines:
        raise HTTPException(422, "Au moins une ligne est requise.")
    totals = _compute_totals(lines)
    buyer = body.get("buyer") or {}
    channel = "e-reporting" if not buyer.get("is_company", True) else "e-invoicing"
    inv = {
        "id": _new_id(),
        "tenant_id": t["id"],
        "number": body.get("number") or _next_number(t["id"]),
        "buyer": buyer,
        "lines": lines,
        "date": body.get("date"),
        "due_date": body.get("due_date"),
        **totals,
        "state": InvoiceState.DRAFT,
        "channel": channel,
        "lifecycle": [{"state": InvoiceState.DRAFT, "at": _now()}],
        "created_at": _now(),
        "updated_at": _now(),
    }
    _db.fact_invoices.insert_one(dict(inv))
    if body.get("send"):
        return _do_send(t, inv, simulate=body.get("simulate"))
    return {"invoice": _public(inv)}


@router.post("/api/owner/facturation/invoices/{invoice_id}/send")
def send_invoice(invoice_id: str,
                 token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    inv = _db.fact_invoices.find_one({"id": invoice_id, "tenant_id": t["id"]})
    if not inv:
        raise HTTPException(404, "Facture introuvable.")
    return _do_send(t, inv)


def _do_send(t: Dict[str, Any], inv: Dict[str, Any], simulate: Optional[str] = None) -> Dict[str, Any]:
    """Idempotent send: same tenant+number never transmits twice.
    `simulate` (TEST, Mock only): 'reject' | 'error' | 'timeout' forces that outcome
    so the rejection/error UX can be tested without a real PA."""
    key = IdempotencyGuard.make_key(t["id"], inv["number"])
    cached = _guard.already_sent(key)
    if cached:
        return {"invoice": _public(inv), "idempotent": True, "result": cached}
    conn = get_pdp_connector()
    # TEST hook: only the in-memory Mock supports forced outcomes.
    # Map the API vocabulary ('reject') to the Mock's ('refused').
    if simulate and hasattr(conn, "force_next_send"):
        conn.force_next_send = {"reject": "refused"}.get(simulate, simulate)
    account_id = t.get("pdp_account_id") or t["id"]
    try:
        created = conn.create_invoice(account_id, inv)
        pdp_id = created.get("id")
        result = conn.send(pdp_id)
    except PdpError as e:
        _update_state(inv["id"], InvoiceState.ERROR, code=e.code, reason=e.message)
        raise HTTPException(502, f"Envoi échoué: {e.message}")
    _guard.mark_sent(key, result)
    _update_state(inv["id"], result.get("state", InvoiceState.SENT),
                  pdp_id=result.get("id") or pdp_id,
                  code=result.get("reject_code"), reason=result.get("reject_reason"))
    inv = _db.fact_invoices.find_one({"id": inv["id"]})
    return {"invoice": _public(inv), "result": result}


@router.get("/api/owner/facturation/invoices/{invoice_id}")
def get_invoice(invoice_id: str,
                token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    inv = _db.fact_invoices.find_one({"id": invoice_id, "tenant_id": t["id"]})
    if not inv:
        raise HTTPException(404, "Facture introuvable.")
    # refresh live status if it was already transmitted
    if inv.get("pdp_invoice_id") and inv.get("state") not in (InvoiceState.DRAFT,):
        try:
            st = get_pdp_connector().get_status(inv["pdp_invoice_id"])
            if st.get("state") and st["state"] != inv.get("state"):
                _update_state(invoice_id, st["state"])
                inv = _db.fact_invoices.find_one({"id": invoice_id})
        except PdpError:
            pass
    return {"invoice": _public(inv)}


@router.post("/api/owner/facturation/invoices/{invoice_id}/credit-note")
def create_credit_note(invoice_id: str, body: Dict[str, Any],
                       token_data=Depends(require_role(["business_owner", "manager"]))):
    """Correct/cancel a prior invoice with an avoir (credit note)."""
    t = _require_facturation(token_data)
    orig = _db.fact_invoices.find_one({"id": invoice_id, "tenant_id": t["id"]})
    if not orig:
        raise HTTPException(404, "Facture d'origine introuvable.")
    amount_ht = float(body.get("amount_ht", orig.get("total_ht", 0)))
    amount_vat = float(body.get("amount_vat", orig.get("total_vat", 0)))
    cn = {
        "id": _new_id(),
        "tenant_id": t["id"],
        "original_invoice_id": invoice_id,
        "original_number": orig.get("number"),
        "buyer": orig.get("buyer"),
        "number": body.get("number") or ("AV-" + orig["number"]),
        "amount_ht": amount_ht,
        "amount_vat": amount_vat,
        "amount_ttc": round(amount_ht + amount_vat, 2),
        "reason": body.get("reason"),
        "state": InvoiceState.DRAFT,
        "created_at": _now(),
    }
    _db.fact_credit_notes.insert_one(dict(cn))
    return {"credit_note": _public(cn)}


@router.get("/api/owner/facturation/credit-notes")
def list_credit_notes(token_data=Depends(require_role(["business_owner", "manager"]))):
    """All avoirs (credit notes) issued, newest first."""
    t = _require_facturation(token_data)
    docs = list(_db.fact_credit_notes.find({"tenant_id": t["id"]}).sort("created_at", -1).limit(500))
    return {"credit_notes": [_public(d) for d in docs]}


# --------------------------------------------------------------------------
# received invoices
# --------------------------------------------------------------------------

@router.get("/api/owner/facturation/received")
def list_received(token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    docs = list(_db.fact_received_invoices.find({"tenant_id": t["id"]}).sort("received_at", -1).limit(500))
    return {"received": [_public(d) for d in docs]}


@router.post("/api/owner/facturation/received/seed-test")
def seed_test_received(body: Dict[str, Any],
                       token_data=Depends(require_role(["business_owner", "manager"]))):
    """TEST-ONLY: inject a fake supplier invoice so the purchases side of the
    Bouclier Fiscal (and the Reçues list) can be exercised with the Mock PA."""
    t = _require_facturation(token_data)
    ht = float(body.get("total_ht", 800))
    vat = round(ht * 0.20, 2)
    rec = {
        "id": _new_id(), "tenant_id": t["id"],
        "supplier": {"name": body.get("supplier_name", "Fournisseur Test SARL"),
                     "siren": body.get("siren", "444444444"), "is_company": True},
        "number": body.get("number", "F-SUP-001"),
        "total_ht": ht, "total_vat": vat, "total_ttc": round(ht + vat, 2),
        "state": InvoiceState.RECEIVED,
        "received_at": _now(),
    }
    _db.fact_received_invoices.insert_one(dict(rec))
    return {"received": _public(rec)}


@router.post("/api/owner/facturation/received/{rid}/mark")
def mark_received(rid: str, body: Dict[str, Any],
                  token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    state = body.get("state")
    if state not in (InvoiceState.ACCEPTED, InvoiceState.REFUSED, InvoiceState.PAID):
        raise HTTPException(422, "État invalide.")
    _db.fact_received_invoices.update_one(
        {"id": rid, "tenant_id": t["id"]}, {"$set": {"state": state}})
    return {"ok": True, "state": state}


# --------------------------------------------------------------------------
# e-reporting (B2C)
# --------------------------------------------------------------------------

@router.post("/api/owner/facturation/ereporting")
def send_ereporting(body: Dict[str, Any],
                    token_data=Depends(require_role(["business_owner", "manager"]))):
    t = _require_facturation(token_data)
    report = {
        "id": _new_id(),
        "tenant_id": t["id"],
        "period_start": body.get("period_start"),
        "period_end": body.get("period_end"),
        "totals_by_vat": body.get("totals_by_vat") or {},
        "state": "pending",
        "created_at": _now(),
    }
    try:
        res = get_pdp_connector().send_ereporting(t.get("pdp_account_id") or t["id"], report)
        report["state"] = res.get("state", "queued")
        report["pdp_report_id"] = res.get("id")
    except PdpError as e:
        report["state"] = "error"
        report["error"] = e.message
    _db.fact_ereports.insert_one(dict(report))
    return {"ereport": _public(report)}


# --------------------------------------------------------------------------
# Bouclier Fiscal — coherence indicator (informational, not tax advice)
# --------------------------------------------------------------------------

@router.get("/api/owner/facturation/coherence")
def coherence(token_data=Depends(require_role(["business_owner", "manager"]))):
    """Fiscal Shield v1 — a starter rule-based consistency check.
    Real 3-way (sales/purchases/CA3) coherence lands in a later step; this v1
    flags the obvious issues we already have data for."""
    t = _require_facturation(token_data)
    tid = t["id"]
    b = compute_bouclier(t)

    result = {"id": _new_id(), "tenant_id": tid,
              "score": b["score"], "band": b["band"],
              "alerts": b["alerts"], "breakdown": b["breakdown"], "counts": b["counts"],
              "created_at": _now(),
              "disclaimer": "Indicateur informatif de cohérence — ni conseil fiscal, ni ECF."}
    _db.fact_coherence_checks.insert_one(dict(result))
    return _public(result)


# --------------------------------------------------------------------------
# webhook (public — the PA calls us; no auth, signature-verified)
# --------------------------------------------------------------------------

@router.post("/api/facturation/webhook")
async def facturation_webhook(request: Request):
    raw = await request.body()
    conn = get_pdp_connector()
    if not conn.verify_webhook(dict(request.headers), raw):
        raise HTTPException(401, "Invalid webhook signature")
    try:
        import json as _json
        event = _json.loads(raw.decode() or "{}")
    except Exception:
        raise HTTPException(400, "Bad payload")
    pdp_id = event.get("invoice_id") or (event.get("invoice") or {}).get("id")
    raw_state = event.get("state") or (event.get("invoice") or {}).get("state")
    if pdp_id and raw_state:
        # adapters normalize; Mock/webhook may already send normalized state
        inv = _db.fact_invoices.find_one({"pdp_invoice_id": pdp_id})
        if inv:
            _update_state(inv["id"], raw_state)
    return {"received": True}


# --------------------------------------------------------------------------
# tiny utils
# --------------------------------------------------------------------------

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    from uuid import uuid4
    return str(uuid4())


def _next_number(tenant_id: str) -> str:
    n = _db.fact_invoices.count_documents({"tenant_id": tenant_id}) + 1
    year = datetime.now(timezone.utc).year
    return f"FAC-{year}-{n:04d}"


def _update_state(invoice_id: str, state: str, pdp_id: Optional[str] = None,
                  code: Optional[str] = None, reason: Optional[str] = None) -> None:
    upd: Dict[str, Any] = {"state": state, "updated_at": _now()}
    if pdp_id:
        upd["pdp_invoice_id"] = pdp_id
    if code:
        upd["reject_code"] = code
    if reason:
        upd["reject_reason"] = reason
    _db.fact_invoices.update_one({"id": invoice_id}, {
        "$set": upd,
        "$push": {"lifecycle": {"state": state, "at": _now()}},
    })
