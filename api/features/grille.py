"""
Grille de répartition des tâches — WHO does WHAT on each dossier (S9).

Status: 🟢 Core.
Mounts at: /api/cabinet/dossiers/{tenant_id}/grille
Storage: dossier_tasks.

WHY THIS EXISTS
    v1 said "one dossier = one owner". Field research says one dossier is
    worked by up to seven people, each on a different task: the assistant does
    the saisie, a gestionnaire de paie (a different wing entirely) does the
    payroll, the superviseur validates the annexe, the EC signs — and some
    tasks belong to the CLIENT (physical inventory) or a third party (lawyer).

    French cabinets already formalise this at onboarding as the "grille de
    répartition des tâches": a matrix of task × responsible × frequency,
    agreed with the client. We model exactly that. The dossier-level owner
    from S7 survives — demoted from "the truth" to "the default".

    The documented failure mode of the paper grille is that it is never
    revisited: tasks silently become "the other side's responsibility" and
    fall through. Keeping it live in the product — visible on the dossier,
    feeding visibility and workload — is the fix.

VISIBILITY SIDE-EFFECT (the important part)
    Being assigned a task on a dossier GRANTS sight of that dossier
    (cabinet_os.visible_tenant_ids unions task assignments in). So giving
    Hugo the paie of "Boulangerie Petit" shows him that dossier without
    making him its owner — which is exactly how a pôle social works.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["grille"])
_db = None

# --------------------------------------------------------------------------
# Task catalogue — the rows of the grille.
#
# Sourced from the research job-map (33 tasks) but reduced to what the
# platform can meaningfully track today; `domain` ties into the membership
# domain axis; `default_kind` says who typically does it when nobody chose.
# Deliberately data, not code: adding a task type must never be a migration.
# --------------------------------------------------------------------------
TASK_TYPES: Dict[str, Dict[str, Any]] = {
    "collecte_pieces": {"label_fr": "Collecte des pièces / relances",
                        "domain": "compta", "frequency": "monthly",
                        "default_kind": "member"},
    "saisie": {"label_fr": "Saisie comptable", "domain": "compta",
               "frequency": "monthly", "default_kind": "member"},
    "rapprochement": {"label_fr": "Rapprochement bancaire", "domain": "compta",
                      "frequency": "monthly", "default_kind": "member"},
    "lettrage": {"label_fr": "Lettrage clients/fournisseurs", "domain": "compta",
                 "frequency": "monthly", "default_kind": "member"},
    "tva": {"label_fr": "Déclarations TVA (CA3/CA12)", "domain": "compta",
            "frequency": "monthly", "default_kind": "member"},
    "facturation_electronique": {"label_fr": "Facturation électronique (PA)",
                                 "domain": "compta", "frequency": "continuous",
                                 "default_kind": "member"},
    "e_reporting": {"label_fr": "E-reporting (B2C)", "domain": "compta",
                    "frequency": "monthly", "default_kind": "member"},
    "paie_dsn": {"label_fr": "Paie + DSN", "domain": "social",
                 "frequency": "monthly", "default_kind": "member"},
    "revision": {"label_fr": "Révision des comptes (cycles)", "domain": "compta",
                 "frequency": "annual", "default_kind": "member"},
    "liasse": {"label_fr": "Bilan + liasse fiscale", "domain": "compta",
               "frequency": "annual", "default_kind": "member"},
    "juridique_ag": {"label_fr": "AG + dépôt des comptes", "domain": "juridique",
                     "frequency": "annual", "default_kind": "member"},
    "inventaire": {"label_fr": "Inventaire physique", "domain": "compta",
                   "frequency": "annual", "default_kind": "client"},
}

ASSIGNEE_KINDS = ("member", "client", "tiers", "none")


def init(db):
    global _db
    _db = db
    try:
        _db.dossier_tasks.create_index(
            [("cabinet_id", 1), ("tenant_id", 1), ("task_type", 1)], unique=True)
        _db.dossier_tasks.create_index([("assignee_membership_id", 1)])
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


# ==========================================================================
# endpoints
# ==========================================================================

@router.get("/api/cabinet/dossiers/{tenant_id}/grille")
def get_grille(tenant_id: str, token_data=Depends(require_role(["comptable"]))):
    """The full grid for one dossier: every task type, with its assignment or
    its default. Reading requires sight of the dossier, nothing more — the
    grille is exactly the 'who do I ask about X' document, so everyone working
    the dossier may read it."""
    from features import cabinet_os as co
    m = co.current_membership(token_data.email)
    link = co.assert_can_see_tenant(token_data.email, tenant_id)

    stored = {t["task_type"]: t for t in _db.dossier_tasks.find(
        {"cabinet_id": m["cabinet_id"], "tenant_id": tenant_id})}
    members = {mm["id"]: mm for mm in _db.cabinet_memberships.find(
        {"cabinet_id": m["cabinet_id"], "status": "active"})}

    rows = []
    for task_type, meta in TASK_TYPES.items():
        t = stored.get(task_type)
        if t:
            assignee_name = None
            if t.get("assignee_kind") == "member":
                mem = members.get(t.get("assignee_membership_id"))
                assignee_name = mem.get("full_name") if mem else "(membre retiré)"
            elif t.get("assignee_kind") == "client":
                assignee_name = "Client"
            elif t.get("assignee_kind") == "tiers":
                assignee_name = t.get("assignee_label") or "Tiers"
            rows.append({"task_type": task_type, **meta,
                         "assignee_kind": t.get("assignee_kind"),
                         "assignee_membership_id": t.get("assignee_membership_id"),
                         "assignee_name": assignee_name,
                         "explicit": True})
        else:
            # Default: the dossier owner for member-tasks, the client for
            # client-default tasks. Shown as a default, never stored — so
            # changing the dossier owner instantly moves every defaulted task.
            if meta["default_kind"] == "client":
                rows.append({"task_type": task_type, **meta,
                             "assignee_kind": "client", "assignee_membership_id": None,
                             "assignee_name": "Client", "explicit": False})
            else:
                owner = members.get(link.get("assignee_membership_id"))
                rows.append({"task_type": task_type, **meta,
                             "assignee_kind": "member" if owner else "none",
                             "assignee_membership_id": owner["id"] if owner else None,
                             "assignee_name": owner.get("full_name") if owner else None,
                             "explicit": False})
    return {"tenant_id": tenant_id, "tasks": rows,
            "can_edit": m["role"] in co.ASSIGN_ROLES}


@router.post("/api/cabinet/dossiers/{tenant_id}/grille")
def set_grille_task(tenant_id: str, body: Dict[str, Any],
                    token_data=Depends(require_role(["comptable"]))):
    """Assign one task of one dossier. EC/superviseur only — the grille is a
    responsibility document, and responsibility is granted downward, not taken.

    body: {task_type, assignee_kind: member|client|tiers|none,
           membership_id?, label?}
    """
    from features import cabinet_os as co
    actor = co.require_cabinet_role(token_data.email, co.ASSIGN_ROLES)
    co.assert_can_see_tenant(token_data.email, tenant_id)

    task_type = body.get("task_type")
    kind = body.get("assignee_kind")
    if task_type not in TASK_TYPES:
        raise HTTPException(422, "Type de tâche inconnu.")
    if kind not in ASSIGNEE_KINDS:
        raise HTTPException(422, "Type d'attribution invalide (member, client, tiers, none).")

    membership_id: Optional[str] = None
    label: Optional[str] = None
    if kind == "member":
        membership_id = body.get("membership_id")
        mem = _db.cabinet_memberships.find_one(
            {"id": membership_id, "cabinet_id": actor["cabinet_id"], "status": "active"})
        if not mem:
            raise HTTPException(422, "Membre invalide ou inactif.")
        mem = co.ensure_membership(mem)
        # Domain mismatch is a WARNING, not a block: research says the split
        # varies by cabinet ("role attribution partially inferred"), so the
        # product must allow it — but silently allowing it hides mistakes.
        domain_warning = TASK_TYPES[task_type]["domain"] not in (mem.get("domains") or [])
    elif kind == "tiers":
        label = (body.get("label") or "").strip()
        if not label:
            raise HTTPException(422, "Précisez qui est ce tiers (ex. « Cabinet juridique Durand »).")
        domain_warning = False
    else:
        domain_warning = False

    prev = _db.dossier_tasks.find_one({"cabinet_id": actor["cabinet_id"],
                                       "tenant_id": tenant_id, "task_type": task_type})
    if kind == "none" and TASK_TYPES[task_type]["default_kind"] != "client":
        # "none" clears the explicit row → falls back to the dossier-owner default.
        if prev:
            _db.dossier_tasks.delete_one({"id": prev["id"]})
    else:
        doc = {"id": prev["id"] if prev else str(uuid4()),
               "cabinet_id": actor["cabinet_id"], "tenant_id": tenant_id,
               "task_type": task_type, "assignee_kind": kind,
               "assignee_membership_id": membership_id,
               "assignee_label": label,
               "updated_by": actor["id"], "updated_at": _now()}
        _db.dossier_tasks.update_one(
            {"cabinet_id": actor["cabinet_id"], "tenant_id": tenant_id,
             "task_type": task_type},
            {"$set": doc}, upsert=True)

    _audit("grille.task_assigned", tenant_id=tenant_id, actor=token_data,
           object_kind="dossier_task", object_id=f"{tenant_id}:{task_type}",
           before={"kind": prev.get("assignee_kind"),
                   "assignee": prev.get("assignee_membership_id") or prev.get("assignee_label")} if prev else None,
           after={"kind": kind, "assignee": membership_id or label})
    return {"ok": True, "domain_warning": bool(domain_warning)}
