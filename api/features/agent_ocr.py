"""
Agent — OCR ingestion of supplier invoices (Chapter 4, the "saisie" half).

Status: 🟢 Core (agent capability #3, the reading step).
Mounts at: /api/cabinet/dossiers/{tid}/ocr, /api/owner/facturation/ocr
Storage: fact_received_invoices (source="ocr").

WHAT IT DOES
    Takes a photo/scan of a supplier invoice (base64), asks services.ocr to read
    it into structured fields, and files it as a RECEIVED invoice draft carrying
    an `ocr_confidence` and an `ocr_status`:
        confidence >= OCR_AUTO_THRESHOLD (default 0.85) -> "auto"
                                          otherwise      -> "needs_review"
    The numbers are NEVER posted to the books here — OCR only *reads*. The Saisie
    agent (agent_saisie) proposes the accounting entry, and a human validates it.
    That preserves the profession's non-negotiable: a human signs the books.

WHY BASE64 JSON (not multipart)
    Keeps the endpoint trivially testable and identical across the owner and
    cabinet sides; the frontend sends the file as a data URL. Images are small
    (a phone photo), so the payload cost is negligible.

IDENTITY
    Cabinet-side ingestion is audited under the AGENT identity (triggered_by the
    human who uploaded) — it is autonomous work the firm delegated. Owner-side
    ingestion is audited as the owner.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-ocr"])
_db = None


def init(db):
    global _db
    _db = db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _threshold() -> float:
    try:
        return float(os.environ.get("OCR_AUTO_THRESHOLD", "0.85"))
    except ValueError:
        return 0.85


def _audit(*args, **kwargs):
    try:
        from features import audit
        audit.log(*args, **kwargs)
    except Exception:
        pass


def _strip_data_url(b64: str) -> tuple:
    """Accept either a raw base64 string or a data URL; return (b64, mime)."""
    mime = "image/jpeg"
    if b64.startswith("data:"):
        head, _, rest = b64.partition(",")
        if ";" in head:
            mime = head[5:].split(";")[0] or mime
        b64 = rest
    return b64, mime


def _ingest(tenant_id: str, body: Dict[str, Any], *, actor, agent_email=None,
            triggered_by=None) -> Dict[str, Any]:
    from services import ocr
    image = (body.get("image") or "").strip()
    if not image:
        raise HTTPException(422, "Aucune image fournie.")
    image_b64, mime = _strip_data_url(image)
    mime = body.get("mime") or mime

    result = ocr.extract_invoice(image_b64, mime)
    if not result.get("ok"):
        if result.get("no_op"):
            raise HTTPException(503, "OCR non configuré (clé du modèle absente).")
        raise HTTPException(422, f"Lecture impossible : {result.get('error', 'inconnue')}")

    conf = float(result.get("confidence") or 0)
    status = "auto" if conf >= _threshold() else "needs_review"
    rec = {
        "id": str(uuid4()), "tenant_id": tenant_id,
        "supplier": {"name": result["supplier_name"],
                     "siren": result["supplier_siren"], "is_company": True},
        "number": result["invoice_number"] or "SANS-NUMERO",
        "date": result["date"],
        "total_ht": result["total_ht"], "total_vat": result["total_vat"],
        "total_ttc": result["total_ttc"], "vat_rate": result["vat_rate"],
        "currency": result["currency"], "category_guess": result["category_guess"],
        "state": "received",
        "source": "ocr", "ocr_confidence": conf, "ocr_status": status,
        "saisie_status": "pending",  # Saisie agent will propose an entry
        "received_at": _now(),
        **({"ingested_by_agent": agent_email} if agent_email else {}),
    }
    _db.fact_received_invoices.insert_one(dict(rec))
    rec.pop("_id", None)
    _audit("agent.ocr_ingested", tenant_id=tenant_id, actor=actor,
           object_kind="received_invoice", object_id=rec["id"],
           after={"supplier": rec["supplier"]["name"], "ttc": rec["total_ttc"],
                  "confidence": conf, "status": status},
           detail={"triggered_by": triggered_by} if triggered_by else None)
    return {"ok": True, "received": rec,
            "needs_review": status == "needs_review",
            "confidence": conf}


@router.post("/api/cabinet/dossiers/{tenant_id}/ocr")
def cabinet_ocr(tenant_id: str, body: Dict[str, Any],
                token_data=Depends(require_role(["comptable"]))):
    """Cabinet reads a client's supplier invoice — audited as the agent."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])
    agent = co.agent_email_for(m["cabinet_id"])
    return _ingest(tenant_id, body, actor=agent_actor, agent_email=agent,
                   triggered_by=token_data.email)


@router.post("/api/owner/facturation/ocr")
def owner_ocr(body: Dict[str, Any],
              token_data=Depends(require_role(["business_owner", "manager"]))):
    """A merchant photographs their own supplier invoice."""
    from features import facturation as F
    t = F._require_facturation(token_data)
    return _ingest(t["id"], body, actor=token_data)


# --------------------------------------------------------------------------
# VENTE — photograph an invoice the business ITSELF issued (paper history).
# It becomes a SALES record (fact_invoices), never transmitted to a PA
# (pa_status="imported"): it documents a sale that already happened.
# --------------------------------------------------------------------------

def _ingest_vente(tenant_id: str, body: Dict[str, Any], *, actor,
                  triggered_by=None) -> Dict[str, Any]:
    from services import ocr
    image = (body.get("image") or "").strip()
    if not image:
        raise HTTPException(422, "Aucune image fournie.")
    image_b64, mime = _strip_data_url(image)
    result = ocr.extract_invoice(image_b64, body.get("mime") or mime, kind="vente")
    if not result.get("ok"):
        if result.get("no_op"):
            raise HTTPException(503, "OCR non configuré (clé du modèle absente).")
        raise HTTPException(422, f"Lecture impossible : {result.get('error', 'inconnue')}")

    conf = float(result.get("confidence") or 0)
    status = "auto" if conf >= _threshold() else "needs_review"
    seq = _db.fact_invoices.count_documents({"tenant_id": tenant_id,
                                             "source": "ocr_vente"}) + 1
    inv = {
        "id": str(uuid4()), "tenant_id": tenant_id,
        "number": result["invoice_number"] or f"IMP-{seq:04d}",
        "date": result["date"],
        "buyer": {"name": result["supplier_name"],           # counterparty = customer
                  "siren": result["supplier_siren"], "is_company": True},
        "lines": [{"description": "Facture photographiée (import)",
                   "quantity": 1, "unit_price": result["total_ht"],
                   "vat_rate": result["vat_rate"],
                   "line_total_ht": result["total_ht"]}],
        "total_ht": result["total_ht"], "total_vat": result["total_vat"],
        "total_ttc": result["total_ttc"],
        "pa_status": "imported",                              # already issued on paper
        "review_status": "unreviewed", "payment_status": "unpaid",
        "source": "ocr_vente", "ocr_confidence": conf, "ocr_status": status,
        "created_at": _now(),
    }
    _db.fact_invoices.insert_one(dict(inv))
    inv.pop("_id", None)
    _audit("agent.ocr_vente", tenant_id=tenant_id, actor=actor,
           object_kind="invoice", object_id=inv["id"],
           after={"client": inv["buyer"]["name"], "ttc": inv["total_ttc"],
                  "confidence": conf, "status": status},
           detail={"triggered_by": triggered_by} if triggered_by else None)
    return {"ok": True, "invoice": inv,
            "needs_review": status == "needs_review", "confidence": conf}


@router.post("/api/cabinet/dossiers/{tenant_id}/ocr-vente")
def cabinet_ocr_vente(tenant_id: str, body: Dict[str, Any],
                      token_data=Depends(require_role(["comptable"]))):
    """Cabinet photographs a SALES invoice the client issued on paper."""
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    return _ingest_vente(tenant_id, body, actor=co.agent_actor(m["cabinet_id"]),
                         triggered_by=token_data.email)


@router.post("/api/owner/facturation/ocr-vente")
def owner_ocr_vente(body: Dict[str, Any],
                    token_data=Depends(require_role(["business_owner", "manager"]))):
    from features import facturation as F
    t = F._require_facturation(token_data)
    return _ingest_vente(t["id"], body, actor=token_data)
