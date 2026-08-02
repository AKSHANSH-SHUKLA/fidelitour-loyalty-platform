"""
Agent — Saisie comptable (Chapter 4, the "entry" half). Agent capability #4.

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tid}/saisie*
Storage: saisie_entries; reads fact_received_invoices.

WHAT IT DOES
    For every OCR'd supplier invoice that has no accounting entry yet, the agent
    PROPOSES a balanced purchase double-entry in journal "AC" (achats):
        DÉBIT  6xx  Charge (mapped from the OCR category)   = HT
        DÉBIT  445660 TVA déductible                        = VAT
        CRÉDIT 401  Fournisseurs                            = TTC
    Débit total == Crédit total, to the centime, always (the test enforces it).

THE HARD RULE (the profession's non-negotiable)
    The agent PROPOSES. It never validates. `validate_entry` requires a human
    with an assignment/validator role; the agent identity is refused (403) even
    if something tried to call it as the agent. Only after a human validates
    does the received invoice count as "saisie faite". This is the same garde-fou
    as four-eyes (S10): autonomous work, human accountability.

WHY IT MATTERS (research)
    Re-keying purchase invoices is the collaborateur's daily grind. Turning
    "type every line" into "glance and click Validate" is the core of the
    "AI employee" pitch — the agent does the saisie, the human keeps the pen.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-saisie"])
_db = None

ACCOUNT_SUPPLIER = ("401000", "Fournisseurs")
ACCOUNT_TVA_DEDUCT = ("445660", "TVA déductible sur autres biens et services")

# OCR category -> (charge account number, label). A real cabinet remaps these to
# its own plan comptable; these are valid, conventional French defaults.
CHARGE_ACCOUNTS = {
    "fournitures":  ("606400", "Fournitures administratives"),
    "services":     ("611000", "Sous-traitance générale"),
    "restauration": ("625700", "Réceptions"),
    "transport":    ("625100", "Voyages et déplacements"),
    "telecom":      ("626000", "Frais postaux et télécommunications"),
    "loyer":        ("613200", "Locations immobilières"),
    "honoraires":   ("622600", "Honoraires"),
    "autre":        ("606300", "Fournitures non stockables"),
}


def init(db):
    global _db
    _db = db
    try:
        _db.saisie_entries.create_index([("tenant_id", 1), ("status", 1)])
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


def _charge_account(category: str) -> tuple:
    return CHARGE_ACCOUNTS.get((category or "autre").lower(), CHARGE_ACCOUNTS["autre"])


def propose_lines(rec: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build the balanced purchase entry for one received invoice."""
    ht = round(float(rec.get("total_ht") or 0), 2)
    vat = round(float(rec.get("total_vat") or 0), 2)
    ttc = round(float(rec.get("total_ttc") or (ht + vat)), 2)
    cat = rec.get("category_guess") or "autre"
    ca_num, ca_lib = _charge_account(cat)
    supplier = (rec.get("supplier") or {}).get("name") or "Fournisseur"
    lines = [
        {"account": ca_num, "label": ca_lib, "debit": ht, "credit": 0.0},
    ]
    if vat > 0:
        lines.append({"account": ACCOUNT_TVA_DEDUCT[0], "label": ACCOUNT_TVA_DEDUCT[1],
                      "debit": vat, "credit": 0.0})
    lines.append({"account": ACCOUNT_SUPPLIER[0],
                  "label": f"{ACCOUNT_SUPPLIER[1]} — {supplier}"[:100],
                  "debit": 0.0, "credit": ttc})
    return lines


def _totals(lines: List[Dict[str, Any]]) -> tuple:
    return (round(sum(l["debit"] for l in lines), 2),
            round(sum(l["credit"] for l in lines), 2))


@router.post("/api/cabinet/dossiers/{tenant_id}/saisie/run")
def run_saisie(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    """Agent pass: propose an entry for every OCR'd invoice not yet entered."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])
    agent_email = co.agent_email_for(m["cabinet_id"])

    todo = _db.fact_received_invoices.find(
        {"tenant_id": tenant_id, "source": "ocr", "saisie_status": "pending"})
    proposed = 0
    for rec in list(todo):
        lines = propose_lines(rec)
        deb, cre = _totals(lines)
        entry = {
            "id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
            "received_id": rec["id"], "journal": "AC",
            "lines": lines, "total_debit": deb, "total_credit": cre,
            "balanced": deb == cre,
            "status": "proposed", "proposed_by": agent_email, "proposed_at": _now(),
            "supplier": (rec.get("supplier") or {}).get("name"),
            "piece_ref": rec.get("number"), "date": rec.get("date"),
        }
        _db.saisie_entries.insert_one(dict(entry))
        _db.fact_received_invoices.update_one(
            {"id": rec["id"]}, {"$set": {"saisie_status": "proposed"}})
        _audit("agent.saisie_proposed", tenant_id=tenant_id, actor=agent_actor,
               object_kind="saisie_entry", object_id=entry["id"],
               after={"supplier": entry["supplier"], "debit": deb, "credit": cre,
                      "balanced": entry["balanced"]},
               detail={"triggered_by": token_data.email, "received_id": rec["id"]})
        proposed += 1
    return {"ok": True, "entries_proposed": proposed}


@router.get("/api/cabinet/dossiers/{tenant_id}/saisie")
def list_entries(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    out = []
    for e in _db.saisie_entries.find({"tenant_id": tenant_id}).sort("proposed_at", -1):
        e.pop("_id", None)
        out.append(e)
    return {"entries": out}


@router.post("/api/cabinet/saisie/{entry_id}/validate")
def validate_entry(entry_id: str, token_data=Depends(require_role(["comptable"]))):
    """A HUMAN validates the agent's proposed entry. The agent can never do this."""
    from features import cabinet_os as co
    e = _db.saisie_entries.find_one({"id": entry_id})
    if not e:
        raise HTTPException(404, "Écriture introuvable.")
    # HARD RULE: agent identity may never validate — accountability stays human.
    if co.is_agent_email(token_data.email):
        raise HTTPException(403, "Un agent ne peut pas valider une écriture.")
    # must be a human with a validator/assignment role on this cabinet
    co.require_cabinet_role(token_data.email, co.VALIDATOR_ROLES)
    co.assert_can_see_tenant(token_data.email, e["tenant_id"])
    if e["status"] != "proposed":
        raise HTTPException(409, "Cette écriture n'est plus en attente.")
    if not e.get("balanced"):
        raise HTTPException(422, "Écriture déséquilibrée — refusée par sécurité.")
    _db.saisie_entries.update_one({"id": entry_id}, {"$set": {
        "status": "validated", "validated_by": token_data.email,
        "validated_at": _now()}})
    _db.fact_received_invoices.update_one(
        {"id": e["received_id"]}, {"$set": {"saisie_status": "validated"}})
    _audit("saisie.validated", tenant_id=e["tenant_id"], actor=token_data,
           object_kind="saisie_entry", object_id=entry_id,
           detail={"received_id": e["received_id"]})
    return {"ok": True, "status": "validated"}
