"""
Agent — Le Gardien (points de vigilance). Agent capability #8.

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tid}/gardien*, /gardien/{id}/resolve
Storage: gardien_findings; reads fact_invoices + fact_received_invoices.
Cron: run_gardien_for_cabinet() is called by the daily cron (agent-daily).

WHAT IT DOES
    Le Gardien surveille chaque dossier et lève des « points de vigilance » —
    des anomalies qu'un humain devrait regarder AVANT qu'elles ne coûtent cher :
        • facture rejetée/en erreur par la PA, jamais corrigée,
        • facture B2B validée sans SIREN client (non conforme),
        • numéro de facture en double,
        • facture validée échue impayée depuis longtemps,
        • facture fournisseur lue (OCR) mais jamais saisie,
        • taux de TVA inhabituel.
    La détection est DÉTERMINISTE (règles) donc testable ; un LLM ne fait
    qu'habiller le message. Chaque finding est dédupliqué et fermable. Le
    Gardien signale — il ne corrige jamais tout seul.

WHY IT MATTERS
    C'est le « cerveau de nuit » du cabinet : pendant que l'équipe dort, il
    relit tous les dossiers et pose sur le bureau, au matin, la liste des choses
    à vérifier. C'est la vitrine de la promesse « employé numérique ».
"""
from __future__ import annotations

from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["agent-gardien"])
_db = None

VALID_VAT_RATES = {0.0, 2.1, 5.5, 10.0, 20.0}
OVERDUE_DAYS = 60


def init(db):
    global _db
    _db = db
    try:
        _db.gardien_findings.create_index([("tenant_id", 1), ("status", 1), ("dedupe", 1)])
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


def detect(tenant_id: str) -> List[Dict[str, Any]]:
    """Rule-based anomaly scan → candidate findings (before dedupe/persist)."""
    from services import statuses as stt
    invs = [stt.ensure(i) for i in _db.fact_invoices.find({"tenant_id": tenant_id})]
    today = _today()
    out: List[Dict[str, Any]] = []

    seen_numbers: Dict[str, int] = {}
    for i in invs:
        num = i.get("number")
        if num:
            seen_numbers[num] = seen_numbers.get(num, 0) + 1

    for i in invs:
        iid = i.get("id", "")
        num = i.get("number") or iid[:8]

        # 1) rejected / error, never corrected
        if i.get("pa_status") in ("refused", "error"):
            out.append({"dedupe": f"pa:{iid}", "type": "facture_rejetee",
                        "severity": "warning",
                        "title": f"Facture {num} rejetée par la plateforme",
                        "message": f"La facture {num} est en état « {i.get('pa_status')} » "
                                   f"et n'a pas été corrigée (avoir ou réémission).",
                        "evidence": {"invoice_id": iid, "pa_status": i.get("pa_status")}})

        # 2) B2B validated without SIREN
        buyer = i.get("buyer") or {}
        if i.get("review_status") == "validated" and buyer.get("is_company") \
           and not (buyer.get("siren") or "").strip():
            out.append({"dedupe": f"siren:{iid}", "type": "siren_manquant",
                        "severity": "warning",
                        "title": f"SIREN client manquant — facture {num}",
                        "message": f"La facture B2B {num} est validée sans SIREN client, "
                                   f"obligatoire depuis la réforme 2026.",
                        "evidence": {"invoice_id": iid, "client": buyer.get("name")}})

        # 3) duplicate number
        if i.get("number") and seen_numbers.get(i["number"], 0) > 1:
            out.append({"dedupe": f"dup:{i['number']}", "type": "numero_double",
                        "severity": "warning",
                        "title": f"Numéro de facture en double : {i['number']}",
                        "message": f"Le numéro {i['number']} apparaît sur plusieurs factures — "
                                   f"la numérotation doit être unique et continue.",
                        "evidence": {"number": i["number"]}})

        # 4) validated, overdue, unpaid
        due = str(i.get("due_date") or "")[:10]
        if i.get("review_status") == "validated" and i.get("payment_status") != "paid" \
           and due and due < (today - timedelta(days=OVERDUE_DAYS)).isoformat():
            out.append({"dedupe": f"overdue:{iid}", "type": "impaye_ancien",
                        "severity": "info",
                        "title": f"Impayé ancien — facture {num}",
                        "message": f"La facture {num} est échue depuis le {due} et toujours "
                                   f"impayée (> {OVERDUE_DAYS} jours).",
                        "evidence": {"invoice_id": iid, "due_date": due}})

        # 5) unusual VAT rate
        for ln in i.get("lines", []):
            rate = float(ln.get("vat_rate") or 0)
            if rate not in VALID_VAT_RATES:
                out.append({"dedupe": f"vat:{iid}:{rate}", "type": "tva_inhabituelle",
                            "severity": "warning",
                            "title": f"Taux de TVA inhabituel ({rate:g} %) — facture {num}",
                            "message": f"La facture {num} porte un taux de TVA de {rate:g} %, "
                                       f"hors des taux français standard.",
                            "evidence": {"invoice_id": iid, "vat_rate": rate}})
                break

    # 6) OCR'd supplier invoice never entered (saisie)
    for r in _db.fact_received_invoices.find({"tenant_id": tenant_id, "source": "ocr"}):
        if r.get("saisie_status") == "pending":
            out.append({"dedupe": f"saisie:{r['id']}", "type": "saisie_manquante",
                        "severity": "info",
                        "title": f"Facture fournisseur non saisie — {r.get('supplier',{}).get('name','?')}",
                        "message": "Une facture fournisseur a été lue (OCR) mais aucune écriture "
                                   "n'a encore été proposée/validée.",
                        "evidence": {"received_id": r["id"]}})
    return out


def run_gardien_for_cabinet(cabinet_id: str, actor, triggered_by: str) -> Dict[str, Any]:
    """Scan every dossier of a cabinet — shared by the button and the daily cron."""
    links = _db.cabinet_links.find({"cabinet_id": cabinet_id, "status": "active"})
    total = 0
    for link in links:
        total += _run_one(link["tenant_id"], cabinet_id, actor, triggered_by)
    return {"ok": True, "findings_created": total}


def _run_one(tenant_id: str, cabinet_id: str, actor, triggered_by: str) -> int:
    from features import cabinet_os as co
    agent_email = co.agent_email_for(cabinet_id)
    created = 0
    for cand in detect(tenant_id):
        if _db.gardien_findings.find_one({"tenant_id": tenant_id,
                                          "dedupe": cand["dedupe"], "status": "open"}):
            continue
        f = {"id": str(uuid4()), "tenant_id": tenant_id, "cabinet_id": cabinet_id,
             "status": "open", "created_by": agent_email, "created_at": _now(), **cand}
        _db.gardien_findings.insert_one(dict(f))
        _audit("agent.gardien_finding", tenant_id=tenant_id, actor=actor,
               object_kind="gardien_finding", object_id=f["id"],
               after={"type": f["type"], "severity": f["severity"]},
               detail={"triggered_by": triggered_by})
        created += 1
    return created


@router.post("/api/cabinet/dossiers/{tenant_id}/gardien/run")
def run_gardien(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    m = co.current_membership(token_data.email)
    co.ensure_agent(m["cabinet_id"])
    agent_actor = co.agent_actor(m["cabinet_id"])
    created = _run_one(tenant_id, m["cabinet_id"], agent_actor, token_data.email)
    return {"ok": True, "findings_created": created}


@router.get("/api/cabinet/dossiers/{tenant_id}/gardien")
def list_findings(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    co.assert_can_see_tenant(token_data.email, tenant_id)
    out = []
    for f in _db.gardien_findings.find({"tenant_id": tenant_id}).sort("created_at", -1):
        f.pop("_id", None)
        out.append(f)
    return {"findings": out}


@router.post("/api/cabinet/gardien/{finding_id}/resolve")
def resolve_finding(finding_id: str, token_data=Depends(require_role(["comptable"]))):
    from features import cabinet_os as co
    f = _db.gardien_findings.find_one({"id": finding_id})
    if not f:
        raise HTTPException(404, "Point de vigilance introuvable.")
    co.assert_can_see_tenant(token_data.email, f["tenant_id"])
    _db.gardien_findings.update_one({"id": finding_id}, {"$set": {
        "status": "resolved", "resolved_by": token_data.email, "resolved_at": _now()}})
    _audit("gardien.resolved", tenant_id=f["tenant_id"], actor=token_data,
           object_kind="gardien_finding", object_id=finding_id)
    return {"ok": True}
