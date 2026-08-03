"""
Agent — Le Réviseur (revue avant validation). Agent capability #9.

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tid}/revision*
Storage: revision_reports; reads fact_invoices.

WHAT IT DOES
    Avant qu'un humain ne valide une facture, Le Réviseur passe une check-list
    de conformité/cohérence sur chaque facture non encore validée, et rend un
    rapport clair :
        • numéro présent,
        • SIREN client présent (si B2B),
        • adresse de facturation présente,
        • au moins une ligne,
        • taux de TVA standard,
        • arithmétique : total_ttc = total_ht + TVA (au centime).
    Chaque facture reçoit un verdict : « prête à valider » ou « à corriger »,
    avec la liste des points en échec. Le Réviseur PRÉPARE la revue ; c'est
    toujours un humain (règle des 4 yeux) qui valide ensuite.

WHY IT MATTERS
    Il transforme la validation « à l'aveugle » en « je confirme ce que l'agent
    a déjà vérifié ». Moins d'erreurs qui passent, une revue plus rapide.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["agent-reviseur"])
_db = None

VALID_VAT_RATES = {0.0, 2.1, 5.5, 10.0, 20.0}


def init(db):
    global _db
    _db = db
    try:
        _db.revision_reports.create_index([("tenant_id", 1), ("created_at", -1)])
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


def check_invoice(inv: Dict[str, Any]) -> Dict[str, Any]:
    """Run the completeness/coherence checklist on one invoice."""
    buyer = inv.get("buyer") or {}
    lines = inv.get("lines") or []
    ht = round(float(inv.get("total_ht") or 0), 2)
    vat = round(float(inv.get("total_vat") or 0), 2)
    ttc = round(float(inv.get("total_ttc") or 0), 2)
    rates_ok = all(float(l.get("vat_rate") or 0) in VALID_VAT_RATES for l in lines) if lines else False

    checks = [
        {"label": "Numéro de facture présent", "ok": bool(inv.get("number"))},
        {"label": "Au moins une ligne", "ok": len(lines) > 0},
        {"label": "Adresse de facturation présente", "ok": bool((buyer.get("address") or "").strip())},
        {"label": "SIREN client présent (si société)",
         "ok": (not buyer.get("is_company")) or bool((buyer.get("siren") or "").strip())},
        {"label": "Taux de TVA standard", "ok": rates_ok},
        {"label": "Arithmétique : TTC = HT + TVA", "ok": abs((ht + vat) - ttc) <= 0.01},
    ]
    passed = sum(1 for c in checks if c["ok"])
    verdict = "pret_a_valider" if passed == len(checks) else "a_corriger"
    return {"invoice_id": inv.get("id"), "number": inv.get("number"),
            "client": buyer.get("name"), "total_ttc": ttc,
            "checks": checks, "passed": passed, "total": len(checks),
            "verdict": verdict}


@router.post("/api/cabinet/dossiers/{tenant_id}/revision/run")
def run_revision(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    """Agent pass: review every not-yet-validated invoice and produce a report."""
    from features import cabinet_os as co
    from services import statuses as stt
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])

    candidates = [stt.ensure(i) for i in _db.fact_invoices.find({"tenant_id": tenant_id})
                  if stt.ensure(i).get("review_status") != "validated"]
    items = [check_invoice(i) for i in candidates]
    ready = sum(1 for it in items if it["verdict"] == "pret_a_valider")
    to_fix = len(items) - ready

    report = {"id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": m["cabinet_id"],
              "created_by": co.agent_email_for(m["cabinet_id"]), "created_at": _now(),
              "reviewed": len(items), "ready": ready, "to_fix": to_fix, "items": items}
    _db.revision_reports.insert_one(dict(report))
    report.pop("_id", None)
    _audit("agent.revision_run", tenant_id=tenant_id, actor=agent_actor,
           object_kind="revision_report", object_id=report["id"],
           after={"reviewed": len(items), "ready": ready, "to_fix": to_fix},
           detail={"triggered_by": token_data.email})
    return {"ok": True, "report": report}


@router.get("/api/cabinet/dossiers/{tenant_id}/revision")
def list_reports(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    out = []
    for r in _db.revision_reports.find({"tenant_id": tenant_id}).sort("created_at", -1).limit(20):
        r.pop("_id", None)
        out.append(r)
    return {"reports": out}
