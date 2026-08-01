"""
Exception Centre — every failure becomes an owned, dated, closable case (S4).

Status: 🟢 Core.
Mounts at: /api/cabinet/cases/*
Storage: exception_cases.

WHY THIS EXISTS
    Today a PA rejection arrives as an email. Someone reads it, thinks "later",
    and three weeks afterwards a supplier phones asking where their money is.
    Nothing was lost technically — the information existed the whole time — but
    nobody OWNED it.

    The fix is not a better inbox. It is to stop treating failures as messages
    and start treating them as work items: a number, a cause, a client, an
    assignee, a due date, a status. Like a kitchen ticket with a name on it
    rather than someone shouting "table 7 is wrong".

DESIGN RULES
    - Cases are CREATED BY THE SYSTEM, never typed by a human. If a human has to
      remember to file the ticket, we have rebuilt the email problem.
    - Auto-assignment follows the dossier's owner, so a case lands on the person
      who already knows that client. Unassigned dossiers escalate to the admin.
    - Closing requires a resolution note when dismissing, because "we decided to
      ignore this" is exactly the decision an auditor will ask about later.
    - Duplicate suppression: the same underlying problem re-reported does not
      create a second open case, or a flapping webhook would bury the queue.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_role

router = APIRouter(tags=["exception-centre"])
_db = None

#: Case types and how urgent each one is. The SLA is in business terms:
#: red = blocks money or compliance, amber = degrades quality.
CASE_TYPES = {
    "pa_rejection":       {"severity": "red",   "sla_days": 2,
                           "title": "Facture refusée par la plateforme"},
    "send_error":         {"severity": "red",   "sla_days": 2,
                           "title": "Échec d'envoi de la facture"},
    "siret_invalid":      {"severity": "red",   "sla_days": 2,
                           "title": "Identifiant client invalide"},
    "export_failed":      {"severity": "red",   "sla_days": 3,
                           "title": "Échec de l'export comptable"},
    "duplicate":          {"severity": "amber", "sla_days": 5,
                           "title": "Doublon détecté"},
    "document_unreadable": {"severity": "amber", "sla_days": 5,
                            "title": "Justificatif illisible"},
    "missing_document":   {"severity": "amber", "sla_days": 5,
                           "title": "Justificatif manquant"},
}

OPEN_STATES = ("open", "in_progress")


def init(db):
    global _db
    _db = db
    try:
        _db.exception_cases.create_index([("cabinet_id", 1), ("status", 1), ("due_date", 1)])
        _db.exception_cases.create_index([("tenant_id", 1), ("status", 1)])
        _db.exception_cases.create_index([("dedupe_key", 1)])
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


def _public(c: Dict[str, Any]) -> Dict[str, Any]:
    c.pop("_id", None)
    # Computed, never stored: "overdue" is a function of time, and storing it
    # would mean a nightly job just to keep a boolean honest.
    if c.get("status") in OPEN_STATES and c.get("due_date"):
        c["overdue"] = c["due_date"] < _now()[:10]
    else:
        c["overdue"] = False
    return c


# ==========================================================================
# creation — called BY THE SYSTEM, not by users
# ==========================================================================

def open_case(tenant_id: str, case_type: str, *, detail_fr: str = "",
              related_kind: Optional[str] = None, related_id: Optional[str] = None,
              related_ref: Optional[str] = None, technical_ref: Optional[str] = None,
              db=None) -> Optional[Dict[str, Any]]:
    """Create (or reuse) a case for a problem that just happened.

    Returns the case, or None if the client has no cabinet — a business without
    an accountant still sees its own errors in the UI; there is simply nobody to
    assign the work to.
    """
    database = db or _db
    if database is None:
        return None
    try:
        spec = CASE_TYPES.get(case_type) or {"severity": "amber", "sla_days": 5,
                                             "title": "Anomalie"}
        link = database.cabinet_links.find_one({"tenant_id": tenant_id, "status": "active"})
        if not link:
            return None

        # One open case per underlying problem. A webhook that fires five times
        # must not produce five tickets.
        dedupe = f"{tenant_id}:{case_type}:{related_id or related_ref or ''}"
        existing = database.exception_cases.find_one(
            {"dedupe_key": dedupe, "status": {"$in": list(OPEN_STATES)}})
        if existing:
            database.exception_cases.update_one(
                {"id": existing["id"]},
                {"$set": {"last_seen_at": _now()},
                 "$inc": {"occurrences": 1}})
            return _public(dict(existing))

        # Land on whoever already owns this dossier; fall back to the admin so a
        # case is never ownerless.
        assignee = link.get("assignee_membership_id")
        if not assignee:
            adm = database.cabinet_memberships.find_one(
                {"cabinet_id": link.get("cabinet_id"),
                 "role": {"$in": ["expert_comptable", "admin"]}, "status": "active"})
            assignee = adm["id"] if adm else None

        due = (datetime.now(timezone.utc) + timedelta(days=spec["sla_days"])).date().isoformat()
        case = {
            "id": str(uuid4()),
            "number": _next_number(database),
            "cabinet_id": link.get("cabinet_id"),
            "tenant_id": tenant_id,
            "type": case_type,
            "severity": spec["severity"],
            "title_fr": spec["title"],
            "detail_fr": detail_fr,
            "related": {"kind": related_kind, "id": related_id, "ref": related_ref},
            "technical_ref": technical_ref,
            "status": "open",
            "assignee_membership_id": assignee,
            "due_date": due,
            "dedupe_key": dedupe,
            "occurrences": 1,
            "created_at": _now(), "last_seen_at": _now(),
        }
        database.exception_cases.insert_one(dict(case))
        return _public(dict(case))
    except Exception:
        # A failure to open a case must never break the operation that failed —
        # otherwise one bug here would block invoicing entirely.
        return None


def _next_number(database) -> str:
    n = database.exception_cases.count_documents({}) + 1
    return f"CAS-{n:04d}"


# ==========================================================================
# reading
# ==========================================================================

@router.get("/api/cabinet/cases")
def list_cases(status: Optional[str] = None, assignee: Optional[str] = None,
               tenant_id: Optional[str] = None, limit: int = Query(200, le=500),
               token_data=Depends(require_role(["comptable"]))):
    """The queue. Scoped to what the caller may see, overdue first."""
    from features.cabinet_os import current_membership, visible_tenant_ids
    m = current_membership(token_data.email)
    tids = visible_tenant_ids(token_data.email)
    if tenant_id:
        if tenant_id not in tids:
            raise HTTPException(403, "Ce dossier ne vous est pas attribué.")
        tids = [tenant_id]
    if not tids:
        return {"cases": [], "counts": {"open": 0, "overdue": 0}}

    q: Dict[str, Any] = {"cabinet_id": m["cabinet_id"], "tenant_id": {"$in": tids}}
    if status == "open":
        q["status"] = {"$in": list(OPEN_STATES)}
    elif status:
        q["status"] = status
    if assignee == "me":
        q["assignee_membership_id"] = m["id"]
    elif assignee:
        q["assignee_membership_id"] = assignee

    lim = limit if isinstance(limit, int) else 200
    docs = [_public(d) for d in _db.exception_cases.find(q).sort("created_at", -1).limit(lim)]
    # Overdue first, then severity, then age: the order someone should work in.
    sev = {"red": 0, "amber": 1}
    docs.sort(key=lambda c: (not c["overdue"], sev.get(c["severity"], 2), c["created_at"]))

    names = {t["id"]: (t.get("legal_name") or t.get("name"))
             for t in _db.tenants.find({"id": {"$in": tids}})}
    people = {p["id"]: p.get("full_name") or p.get("user_email")
              for p in _db.cabinet_memberships.find({"cabinet_id": m["cabinet_id"]})}
    for c in docs:
        c["client_name"] = names.get(c["tenant_id"])
        c["assignee_name"] = people.get(c.get("assignee_membership_id"))

    open_docs = [c for c in docs if c["status"] in OPEN_STATES]
    return {"cases": docs,
            "counts": {"open": len(open_docs),
                       "overdue": sum(1 for c in open_docs if c["overdue"])}}


# ==========================================================================
# acting on a case
# ==========================================================================

@router.post("/api/cabinet/cases/{case_id}/assign")
def assign_case(case_id: str, body: Dict[str, Any],
                token_data=Depends(require_role(["comptable"]))):
    """Hand a case to someone. Admins reassign freely; others only their own."""
    from features.cabinet_os import current_membership
    m = current_membership(token_data.email)
    case = _get_in_scope(case_id, token_data.email)
    from features.cabinet_os import PORTFOLIO_WIDE_ROLES
    if m["role"] not in PORTFOLIO_WIDE_ROLES and case.get("assignee_membership_id") != m["id"]:
        raise HTTPException(403, "Vous ne pouvez réattribuer que vos propres cas.")
    target = body.get("membership_id")
    if target and not _db.cabinet_memberships.find_one(
            {"id": target, "cabinet_id": m["cabinet_id"], "status": "active"}):
        raise HTTPException(422, "Membre invalide ou inactif.")
    _db.exception_cases.update_one({"id": case_id},
                                   {"$set": {"assignee_membership_id": target,
                                             "updated_at": _now()}})
    _audit("case.assigned", tenant_id=case["tenant_id"], actor=token_data,
           object_kind="case", object_id=case_id,
           before={"assignee": case.get("assignee_membership_id")},
           after={"assignee": target}, detail={"number": case.get("number")})
    return {"ok": True}


@router.post("/api/cabinet/cases/{case_id}/status")
def set_case_status(case_id: str, body: Dict[str, Any],
                    token_data=Depends(require_role(["comptable"]))):
    """Move a case along: in_progress → resolved, or dismissed with a reason.

    Dismissal REQUIRES a note. "We chose not to act on this" is precisely the
    decision someone will question months later, and an empty reason makes the
    whole trail worthless.
    """
    from features.cabinet_os import current_membership
    m = current_membership(token_data.email)
    case = _get_in_scope(case_id, token_data.email)
    target = (body.get("status") or "").strip()
    if target not in ("open", "in_progress", "resolved", "dismissed"):
        raise HTTPException(422, "Statut invalide.")
    note = (body.get("note") or "").strip()
    if target == "dismissed" and not note:
        raise HTTPException(422, "Un motif est obligatoire pour écarter un cas.")

    upd = {"status": target, "updated_at": _now()}
    if note:
        upd["resolution_note"] = note
    if target in ("resolved", "dismissed"):
        upd["closed_at"] = _now()
        upd["closed_by"] = token_data.email
    _db.exception_cases.update_one({"id": case_id}, {"$set": upd})
    _audit("case.status_changed", tenant_id=case["tenant_id"], actor=token_data,
           object_kind="case", object_id=case_id,
           before={"status": case["status"]}, after={"status": target},
           detail={"number": case.get("number"), "note": note or None})
    return {"ok": True, "case": _public(_db.exception_cases.find_one({"id": case_id}))}


def _get_in_scope(case_id: str, email: str) -> Dict[str, Any]:
    """Fetch a case only if the caller is allowed to see its dossier."""
    from features.cabinet_os import assert_can_see_tenant, current_membership
    m = current_membership(email)
    case = _db.exception_cases.find_one({"id": case_id, "cabinet_id": m["cabinet_id"]})
    if not case:
        raise HTTPException(404, "Cas introuvable.")
    assert_can_see_tenant(email, case["tenant_id"])
    return case
