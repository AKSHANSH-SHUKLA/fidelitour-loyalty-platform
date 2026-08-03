"""
Agent — Le Lettrage (rapprochement bancaire). Agent capability #7.

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tid}/lettrage*, /bank-transactions*
Storage: bank_transactions, lettrage_matches; reads/updates fact_invoices.

WHAT IT DOES
    Le lettrage, c'est faire correspondre chaque encaissement bancaire à la
    facture qu'il paie. À la main, c'est fastidieux et source d'erreurs. L'agent
    regarde les transactions bancaires non rapprochées et les factures validées
    non payées, et PROPOSE des rapprochements avec un niveau de confiance :
        montant + numéro de facture dans le libellé  → confiance haute (0.95)
        montant seul (+ nom du client dans le libellé) → confiance moyenne (~0.7)
    Un HUMAIN valide le rapprochement ; alors seulement la facture passe « payée ».
    L'agent ne valide jamais (403) — même règle que la saisie.

WHY IT MATTERS
    Le rapprochement est un des travaux répétitifs cités par la profession.
    L'agent fait la proposition ; le collaborateur confirme d'un clic.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-lettrage"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        _db.bank_transactions.create_index([("tenant_id", 1), ("matched", 1)])
        _db.lettrage_matches.create_index([("tenant_id", 1), ("status", 1)])
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


def _amount_due(inv: Dict[str, Any]) -> float:
    return round(float(inv.get("total_ttc") or 0) - float(inv.get("amount_paid") or 0), 2)


def propose_matches(tenant_id: str) -> List[Dict[str, Any]]:
    """Pure matcher: pair unmatched transactions with unpaid validated invoices."""
    txns = [t for t in _db.bank_transactions.find({"tenant_id": tenant_id})
            if not t.get("matched")]
    invoices = [i for i in _db.fact_invoices.find({"tenant_id": tenant_id})
                if i.get("review_status") == "validated"
                and i.get("payment_status") != "paid"]
    used_inv = set()
    proposals = []
    for t in txns:
        amt = round(float(t.get("amount") or 0), 2)
        label = (t.get("label") or "").lower()
        ref = (t.get("reference") or "").lower()
        best = None
        for inv in invoices:
            if inv["id"] in used_inv:
                continue
            if abs(_amount_due(inv) - amt) > 0.01:
                continue
            num = (inv.get("number") or "").lower()
            client = ((inv.get("buyer") or {}).get("name") or "").lower()
            if num and (num in ref or num in label):
                best = (inv, 0.95, "montant + numéro de facture")
                break
            if client and client.split()[0] in label:
                best = best or (inv, 0.75, "montant + nom du client")
            else:
                best = best or (inv, 0.60, "montant identique")
        if best:
            inv, conf, basis = best
            used_inv.add(inv["id"])
            proposals.append({"transaction": t, "invoice": inv,
                              "amount": amt, "confidence": conf, "basis": basis})
    return proposals


@router.post("/api/cabinet/dossiers/{tenant_id}/bank-transactions/seed-test")
def seed_transactions(tenant_id: str, body: Dict[str, Any],
                      token_data=Depends(require_role(["comptable"]))):
    """TEST/DEMO: inject bank transactions so lettrage can be exercised."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    items = body.get("transactions") or [body]
    out = []
    for it in items:
        tx = {"id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
              "date": it.get("date") or _now()[:10],
              "amount": round(float(it.get("amount") or 0), 2),
              "label": it.get("label") or "Virement reçu",
              "reference": it.get("reference") or "",
              "matched": False, "created_at": _now()}
        _db.bank_transactions.insert_one(dict(tx))
        tx.pop("_id", None)
        out.append(tx)
    return {"ok": True, "transactions": out}


@router.post("/api/cabinet/dossiers/{tenant_id}/lettrage/run")
def run_lettrage(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    """Agent pass: propose reconciliations for this dossier."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])
    agent_email = co.agent_email_for(m["cabinet_id"])

    proposed = 0
    for p in propose_matches(tenant_id):
        # skip if a proposal already exists for this transaction
        if _db.lettrage_matches.find_one({"transaction_id": p["transaction"]["id"],
                                          "status": "proposed"}):
            continue
        match = {"id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
                 "transaction_id": p["transaction"]["id"],
                 "invoice_id": p["invoice"]["id"],
                 "invoice_number": p["invoice"].get("number"),
                 "amount": p["amount"], "confidence": p["confidence"],
                 "basis": p["basis"], "status": "proposed",
                 "proposed_by": agent_email, "proposed_at": _now()}
        _db.lettrage_matches.insert_one(dict(match))
        _audit("agent.lettrage_proposed", tenant_id=tenant_id, actor=agent_actor,
               object_kind="lettrage_match", object_id=match["id"],
               after={"invoice": match["invoice_number"], "amount": match["amount"],
                      "confidence": match["confidence"], "basis": match["basis"]},
               detail={"triggered_by": token_data.email})
        proposed += 1
    return {"ok": True, "matches_proposed": proposed}


@router.get("/api/cabinet/dossiers/{tenant_id}/lettrage")
def list_matches(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    out = []
    for x in _db.lettrage_matches.find({"tenant_id": tenant_id}).sort("proposed_at", -1):
        x.pop("_id", None)
        out.append(x)
    return {"matches": out}


@router.post("/api/cabinet/lettrage/{match_id}/validate")
def validate_match(match_id: str, token_data=Depends(require_role(["comptable"]))):
    """A HUMAN confirms the reconciliation → the invoice becomes 'paid'."""
    from features import cabinet_os as co
    mt = _db.lettrage_matches.find_one({"id": match_id})
    if not mt:
        raise HTTPException(404, "Rapprochement introuvable.")
    if co.is_agent_email(token_data.email):
        raise HTTPException(403, "Un agent ne peut pas valider un rapprochement.")
    co.require_cabinet_role(token_data.email, co.VALIDATOR_ROLES)
    co.assert_can_see_tenant(token_data.email, mt["tenant_id"])
    if mt["status"] != "proposed":
        raise HTTPException(409, "Ce rapprochement n'est plus en attente.")

    inv = _db.fact_invoices.find_one({"id": mt["invoice_id"]})
    if not inv:
        raise HTTPException(404, "Facture introuvable.")
    _db.fact_invoices.update_one({"id": mt["invoice_id"]}, {"$set": {
        "payment_status": "paid", "amount_paid": float(inv.get("total_ttc") or 0),
        "updated_at": _now()}})
    _db.bank_transactions.update_one({"id": mt["transaction_id"]},
                                     {"$set": {"matched": True}})
    _db.lettrage_matches.update_one({"id": match_id}, {"$set": {
        "status": "validated", "validated_by": token_data.email, "validated_at": _now()}})
    _audit("lettrage.validated", tenant_id=mt["tenant_id"], actor=token_data,
           object_kind="lettrage_match", object_id=match_id,
           detail={"invoice_id": mt["invoice_id"]})
    return {"ok": True, "status": "validated", "payment_status": "paid"}
