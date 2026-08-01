"""
Cabinet OS — the accounting firm as an ORGANISATION (S5 + S7).

Status: 🟢 Core.
Mounts at: /api/cabinet/*
Storage: cabinets, cabinet_memberships, cabinet_links (mandates, evolved).

WHY THIS EXISTS
    Until now a cabinet was one login. A real firm is a team: an
    expert-comptable who sees everything, collaborateurs who own a slice of the
    portfolio, and assistants who prepare work. Without that structure:
      - every employee sees all 45 clients (a confidentiality problem, and a
        usability one — nobody can find their own work),
      - "assign this case to someone" is meaningless, because there is nobody
        to assign it to,
      - and when a person leaves, the only lever is changing a shared password,
        which silently destroys the audit trail (see MODEL note below).

MODEL — three separate things, on purpose
    users               a person's identity (email + password). Theirs, forever.
    cabinet_memberships "this person works at THIS cabinet, in THIS role".
                        Removing it kills access instantly; the user account and
                        their history survive.
    cabinet_links       "this cabinet may act for THIS client" (the mandate),
                        now also carrying WHO inside the cabinet owns it.

    Keeping them apart means a role change, a departure, a client leaving and a
    password reset are four independent events that cannot break each other.

SECURITY NOTE
    Role lives in the membership document, NOT in the JWT. The JWT keeps
    role="comptable" so every existing guard, route and redirect keeps working,
    and the fine-grained role is resolved per request — which also means a
    demotion or a removal takes effect on the very next click, not at next login.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from auth import require_role, hash_password

router = APIRouter(tags=["cabinet-os"])
_db = None

ROLES = ("admin", "collaborateur", "assistant")


def init(db):
    global _db
    _db = db
    try:
        _db.cabinets.create_index([("siren", 1)], unique=True, sparse=True)
        _db.cabinet_memberships.create_index([("cabinet_id", 1), ("user_email", 1)], unique=True)
        _db.cabinet_memberships.create_index([("user_email", 1), ("status", 1)])
    except Exception:
        pass       # index creation is best-effort; never break boot


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(email: str) -> str:
    return (email or "").strip().lower()


def _audit(*args, **kwargs):
    try:
        from features import audit
        audit.log(*args, **kwargs)
    except Exception:
        pass


# ==========================================================================
# membership resolution — the heart of every permission decision
# ==========================================================================

def current_membership(email: str) -> Dict[str, Any]:
    """Resolve the caller's ACTIVE membership, or refuse.

    Called on every cabinet request, deliberately: a suspended or removed
    employee loses access on their next click, not when their token expires.
    """
    m = _db.cabinet_memberships.find_one({"user_email": _norm(email), "status": "active"})
    if not m:
        raise HTTPException(403, "Aucun accès cabinet actif pour ce compte.")
    return m


def require_cabinet_role(email: str, allowed: tuple) -> Dict[str, Any]:
    """Membership + role gate. Returns the membership for convenience."""
    m = current_membership(email)
    if m.get("role") not in allowed:
        raise HTTPException(403, "Votre rôle ne permet pas cette action.")
    return m


def visible_tenant_ids(email: str) -> List[str]:
    """Which client dossiers this person may see.

    Admin sees the whole portfolio. Everyone else sees ONLY what is assigned to
    them — not as a UI filter but as the data boundary itself, so a guessed URL
    or a hand-made API call finds nothing either.
    """
    m = current_membership(email)
    q: Dict[str, Any] = {"cabinet_id": m["cabinet_id"], "status": "active"}
    if m.get("role") != "admin":
        q["assignee_membership_id"] = m["id"]
    return [l["tenant_id"] for l in _db.cabinet_links.find(q)]


def assert_can_see_tenant(email: str, tenant_id: str) -> Dict[str, Any]:
    """Guard for any single-dossier access. Raises 403 when out of scope."""
    m = current_membership(email)
    q: Dict[str, Any] = {"cabinet_id": m["cabinet_id"], "tenant_id": tenant_id,
                         "status": "active"}
    if m.get("role") != "admin":
        q["assignee_membership_id"] = m["id"]
    link = _db.cabinet_links.find_one(q)
    if not link:
        raise HTTPException(403, "Ce dossier ne vous est pas attribué.")
    return link


# ==========================================================================
# cabinet + team
# ==========================================================================

@router.post("/api/cabinet/signup")
def cabinet_signup(body: Dict[str, Any]):
    """Create a cabinet and its first admin (the expert-comptable)."""
    from services import password_policy
    email = _norm(body.get("email"))
    name = (body.get("name") or "").strip()
    password = body.get("password") or ""
    if not email or "@" not in email:
        raise HTTPException(422, "Email invalide.")
    if not name:
        raise HTTPException(422, "Le nom du cabinet est obligatoire.")
    password_policy.assert_valid(password)

    if _db.users.find_one({"email": email}):
        raise HTTPException(409, "Cet email est déjà utilisé.")
    siren = "".join(ch for ch in str(body.get("siren") or "") if ch.isdigit())
    if siren and _db.cabinets.find_one({"siren": siren}):
        raise HTTPException(409, "Un cabinet existe déjà avec ce SIREN — demandez une invitation à son administrateur.")

    cab = {
        "id": str(uuid4()), "name": name, "siren": siren or None,
        "status": "active", "created_at": _now(),
        "settings": {"materiality_threshold_eur": 50,
                     "require_two_step_review": False,
                     "force_reassign_on_removal": False},
    }
    _db.cabinets.insert_one(dict(cab))
    _db.users.insert_one({
        "email": email, "role": "comptable", "tenant_id": None,
        "hashed_password": hash_password(password), "created_at": _now(),
    })
    mem = _new_membership(cab["id"], email, "admin", body.get("full_name"), invited_by=email)
    _audit("cabinet.created", actor=None, object_kind="cabinet", object_id=cab["id"],
           after={"name": name, "admin": email})
    return {"ok": True, "cabinet": {"id": cab["id"], "name": name},
            "membership": _public(mem)}


def _new_membership(cabinet_id: str, email: str, role: str, full_name=None,
                    invited_by=None, must_change=False) -> Dict[str, Any]:
    doc = {
        "id": str(uuid4()), "cabinet_id": cabinet_id, "user_email": _norm(email),
        "full_name": full_name or _norm(email).split("@")[0],
        "role": role, "status": "active",
        "must_change_password": must_change,
        "invited_by": invited_by, "created_at": _now(),
    }
    _db.cabinet_memberships.insert_one(dict(doc))
    return doc


def _public(d: Dict[str, Any]) -> Dict[str, Any]:
    d.pop("_id", None)
    return d


@router.get("/api/cabinet/me")
def cabinet_me(token_data=Depends(require_role(["comptable"]))):
    """Who am I, in which cabinet, with what powers."""
    m = current_membership(token_data.email)
    cab = _db.cabinets.find_one({"id": m["cabinet_id"]}) or {}
    cab.pop("_id", None)
    return {"membership": _public(dict(m)), "cabinet": cab,
            "can": {"manage_team": m["role"] == "admin",
                    "assign": m["role"] == "admin",
                    "validate": m["role"] in ("admin", "collaborateur"),
                    "export": m["role"] in ("admin", "collaborateur")}}


@router.post("/api/cabinet/team")
def create_member(body: Dict[str, Any], token_data=Depends(require_role(["comptable"]))):
    """Admin creates an employee account directly (founder decision v1.1).

    The admin sets an initial password and shares it themselves. Two guard
    rails make that safe: the employee MUST change it on first login, so the
    admin never knows their working password afterwards — which is what keeps
    the audit trail meaningful ("Léa did this" really means Léa).
    """
    from services import password_policy
    admin = require_cabinet_role(token_data.email, ("admin",))
    email = _norm(body.get("email"))
    role = body.get("role")
    password = body.get("password") or ""
    if not email or "@" not in email:
        raise HTTPException(422, "Email invalide.")
    if role not in ("collaborateur", "assistant"):
        raise HTTPException(422, "Rôle invalide (collaborateur ou assistant).")
    password_policy.assert_valid(password)
    if _db.users.find_one({"email": email}):
        raise HTTPException(409, "Cet email est déjà utilisé.")

    _db.users.insert_one({
        "email": email, "role": "comptable", "tenant_id": None,
        "hashed_password": hash_password(password), "created_at": _now(),
    })
    mem = _new_membership(admin["cabinet_id"], email, role,
                          body.get("full_name"), invited_by=token_data.email,
                          must_change=True)
    _audit("cabinet.member_created", actor=token_data, object_kind="membership",
           object_id=mem["id"], after={"email": email, "role": role})
    return {"ok": True, "member": _public(mem)}


@router.get("/api/cabinet/team")
def list_team(token_data=Depends(require_role(["comptable"]))):
    """Team list with live workload — this is the "who is doing what" view.

    Counts come from the data itself (assigned dossiers, open cases), never
    from anything a person has to report. Working IS the report.
    """
    m = current_membership(token_data.email)
    members = list(_db.cabinet_memberships.find({"cabinet_id": m["cabinet_id"],
                                                 "status": {"$ne": "removed"}}))
    out = []
    for mm in members:
        dossiers = _db.cabinet_links.count_documents(
            {"cabinet_id": m["cabinet_id"], "assignee_membership_id": mm["id"],
             "status": "active"})
        open_cases = _db.exception_cases.count_documents(
            {"cabinet_id": m["cabinet_id"], "assignee_membership_id": mm["id"],
             "status": {"$in": ["open", "in_progress"]}})
        out.append({**_public(dict(mm)), "dossiers": dossiers, "open_cases": open_cases})
    unassigned = _db.cabinet_links.count_documents(
        {"cabinet_id": m["cabinet_id"], "status": "active",
         "assignee_membership_id": {"$in": [None, ""]}})
    return {"members": out, "unassigned_dossiers": unassigned,
            "my_role": m["role"]}


@router.patch("/api/cabinet/team/{membership_id}")
def update_member(membership_id: str, body: Dict[str, Any],
                  token_data=Depends(require_role(["comptable"]))):
    """Change a role, suspend, or remove — admin only.

    Removing does NOT touch the person's user account or their audit history:
    accounting needs to know who did what years later. Their dossiers fall into
    the "Non assignés" pool (founder decision), which the dashboard surfaces in
    amber so they cannot be silently forgotten.
    """
    admin = require_cabinet_role(token_data.email, ("admin",))
    mem = _db.cabinet_memberships.find_one({"id": membership_id,
                                            "cabinet_id": admin["cabinet_id"]})
    if not mem:
        raise HTTPException(404, "Membre introuvable.")
    if mem["id"] == admin["id"] and (body.get("status") in ("suspended", "removed")
                                     or body.get("role") not in (None, "admin")):
        raise HTTPException(409, "Vous ne pouvez pas retirer vos propres droits d'administrateur.")

    upd: Dict[str, Any] = {}
    if body.get("role"):
        if body["role"] not in ROLES:
            raise HTTPException(422, "Rôle invalide.")
        upd["role"] = body["role"]
    if body.get("status"):
        if body["status"] not in ("active", "suspended", "removed"):
            raise HTTPException(422, "Statut invalide.")
        upd["status"] = body["status"]
    if body.get("full_name"):
        upd["full_name"] = body["full_name"]
    if not upd:
        raise HTTPException(422, "Rien à modifier.")
    upd["updated_at"] = _now()

    _db.cabinet_memberships.update_one({"id": membership_id}, {"$set": upd})

    freed = 0
    if upd.get("status") == "removed":
        res = _db.cabinet_links.update_many(
            {"cabinet_id": admin["cabinet_id"], "assignee_membership_id": membership_id},
            {"$set": {"assignee_membership_id": None, "unassigned_at": _now()}})
        freed = getattr(res, "modified_count", 0)

    _audit("cabinet.member_updated", actor=token_data, object_kind="membership",
           object_id=membership_id,
           before={"role": mem.get("role"), "status": mem.get("status")},
           after=upd, detail={"dossiers_unassigned": freed} if freed else None)
    return {"ok": True, "dossiers_unassigned": freed}


@router.post("/api/cabinet/change-password")
def change_own_password(body: Dict[str, Any],
                        token_data=Depends(require_role(["comptable"]))):
    """First-login password change (and any later change).

    Clearing must_change_password here is what makes admin-set passwords safe:
    after this, only the employee knows their own credentials.
    """
    from services import password_policy
    from auth import verify_password
    m = current_membership(token_data.email)
    user = _db.users.find_one({"email": _norm(token_data.email)})
    old = body.get("current_password") or ""
    new = body.get("new_password") or ""
    if not m.get("must_change_password"):
        if not verify_password(old, user.get("hashed_password", "")):
            raise HTTPException(403, "Mot de passe actuel incorrect.")
    password_policy.assert_valid(new)
    if verify_password(new, user.get("hashed_password", "")):
        raise HTTPException(422, "Le nouveau mot de passe doit être différent de l'ancien.")

    _db.users.update_one({"email": _norm(token_data.email)},
                         {"$set": {"hashed_password": hash_password(new)}})
    _db.cabinet_memberships.update_one({"id": m["id"]},
                                       {"$set": {"must_change_password": False}})
    _audit("cabinet.password_changed", actor=token_data,
           object_kind="membership", object_id=m["id"])
    return {"ok": True}


# ==========================================================================
# dossier assignment
# ==========================================================================

@router.post("/api/cabinet/dossiers/{tenant_id}/assign")
def assign_dossier(tenant_id: str, body: Dict[str, Any],
                   token_data=Depends(require_role(["comptable"]))):
    """Give a client dossier to a member (or send it back to the pool)."""
    admin = require_cabinet_role(token_data.email, ("admin",))
    link = _db.cabinet_links.find_one({"cabinet_id": admin["cabinet_id"],
                                       "tenant_id": tenant_id, "status": "active"})
    if not link:
        raise HTTPException(404, "Dossier introuvable pour ce cabinet.")
    target = body.get("membership_id")
    if target:
        mem = _db.cabinet_memberships.find_one({"id": target,
                                                "cabinet_id": admin["cabinet_id"],
                                                "status": "active"})
        if not mem:
            raise HTTPException(422, "Membre invalide ou inactif.")
    _db.cabinet_links.update_one(
        {"id": link["id"]},
        {"$set": {"assignee_membership_id": target or None, "assigned_at": _now()}})
    _audit("dossier.assigned", tenant_id=tenant_id, actor=token_data,
           object_kind="mandate", object_id=link["id"],
           before={"assignee": link.get("assignee_membership_id")},
           after={"assignee": target})
    return {"ok": True}


@router.get("/api/cabinet/dossiers/unassigned")
def unassigned_dossiers(token_data=Depends(require_role(["comptable"]))):
    """The "Non assignés" pool — surfaced so no dossier is silently orphaned."""
    m = require_cabinet_role(token_data.email, ("admin",))
    links = _db.cabinet_links.find({"cabinet_id": m["cabinet_id"], "status": "active",
                                    "assignee_membership_id": {"$in": [None, ""]}})
    out = []
    for l in links:
        t = _db.tenants.find_one({"id": l["tenant_id"]}) or {}
        out.append({"tenant_id": l["tenant_id"],
                    "name": t.get("legal_name") or t.get("name"),
                    "since": l.get("unassigned_at") or l.get("created_at")})
    return {"dossiers": out}
