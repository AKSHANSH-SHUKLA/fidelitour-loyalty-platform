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

# ==========================================================================
# ROLES v2 (S8) — two axes, because a cabinet runs on a responsibility CHAIN,
# not a permission ladder.
#
# Axis 1 — FUNCTION (what you may do in the chain: produce → validate → sign):
#   assistant          produces volume (saisie, lettrage, bank rec) — validates nothing
#   collaborateur      produces judgement work, validates below threshold
#   superviseur        the chef de mission — validates everything, signs nothing
#   expert_comptable   signs. Attestation / lettre de mission / TRACFIN are
#                      NON-DELEGABLE to anyone else (Ordre deontology) — so this
#                      is a legal identity, not a permission tier. can_sign()
#                      additionally requires an Ordre registration number.
#   agent              FidClic itself, when it acts (S11). Produces only.
#                      NEVER validates — no threshold, no exception. Every agent
#                      output lands in a human review queue. This hard line is
#                      the "garde-fou" the profession explicitly demands.
#
# Axis 2 — DOMAIN (which wing you work in): compta / social (paie) / juridique.
#   A gestionnaire de paie is simply role=collaborateur + domains=["social"] —
#   payroll is a wing, not a rank.
#
# SMALL-CABINET COLLAPSE: research shows the superviseur layer often doesn't
# exist separately ("chhote cabinets mein alag role nahi bhi hota"). We never
# require one: wherever a superviseur is expected, an expert_comptable
# qualifies too (see VALIDATOR_ROLES / PORTFOLIO_WIDE_ROLES).
# ==========================================================================

ROLES = ("assistant", "collaborateur", "superviseur", "expert_comptable", "agent")
LEGACY_ROLE_MAP = {"admin": "expert_comptable"}   # v1 rows, normalized on read
DOMAINS = ("compta", "social", "juridique")

MANAGER_ROLES = ("expert_comptable",)                       # team + settings
ASSIGN_ROLES = ("expert_comptable", "superviseur")          # dossiers + grille
VALIDATOR_ROLES = ("expert_comptable", "superviseur", "collaborateur")
PORTFOLIO_WIDE_ROLES = ("expert_comptable", "superviseur")  # see every dossier
HUMAN_ROLES = tuple(r for r in ROLES if r != "agent")


def normalize_role(role: Optional[str]) -> str:
    return LEGACY_ROLE_MAP.get(role or "", role or "")


def ensure_membership(m: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize-on-read migration for v1 membership rows (same pattern as
    statuses.ensure): legacy 'admin' becomes expert_comptable, missing fields
    get defaults, and the row is quietly backfilled so it only happens once."""
    if not m:
        return m
    fixed: Dict[str, Any] = {}
    new_role = normalize_role(m.get("role"))
    if new_role != m.get("role"):
        fixed["role"] = new_role
    if not m.get("domains"):
        fixed["domains"] = ["compta"]
    if "ordre_number" not in m:
        fixed["ordre_number"] = None
    if "is_lab_referent" not in m:
        # v1 admins were the founding EC — they carried the LAB duty de facto.
        fixed["is_lab_referent"] = new_role == "expert_comptable"
    if fixed:
        m.update(fixed)
        try:
            _db.cabinet_memberships.update_one({"id": m["id"]}, {"$set": fixed})
        except Exception:
            pass
    return m


def can_sign(m: Dict[str, Any]) -> bool:
    """Signing (attestation-level acts) = EC role AND an Ordre number on file.
    The number is the professional identity the signature legally hangs on."""
    return m.get("role") == "expert_comptable" and bool(m.get("ordre_number"))


def init(db):
    global _db
    _db = db
    try:
        _db.cabinets.create_index([("siren", 1)], unique=True, sparse=True)
        _db.cabinet_memberships.create_index([("cabinet_id", 1), ("user_email", 1)], unique=True)
        _db.cabinet_memberships.create_index([("user_email", 1), ("status", 1)])
        # Root fix for the duplicate-founder race: one identity per email.
        _db.users.create_index([("email", 1)], unique=True)
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

    SELF-HEAL (observed in production): a double-submit on signup can race
    past the duplicate-email check and create TWO cabinets + TWO memberships
    for the same founder. find_one() then resolves to either row depending on
    the instance — the portfolio appears and disappears between requests.
    When we detect multiple active memberships we merge the duplicate cabinets
    once, deterministically (oldest wins), and the flapping ends forever.
    """
    rows = list(_db.cabinet_memberships.find({"user_email": _norm(email), "status": "active"}))
    if not rows:
        raise HTTPException(403, "Aucun accès cabinet actif pour ce compte.")
    if len(rows) > 1:
        rows.sort(key=lambda r: (r.get("created_at") or "", r.get("id") or ""))
        winner = rows[0]
        for loser in rows[1:]:
            if loser.get("cabinet_id") != winner.get("cabinet_id"):
                _merge_cabinets(winner["cabinet_id"], loser["cabinet_id"])
            _db.cabinet_memberships.update_one(
                {"id": loser["id"]}, {"$set": {"status": "merged", "merged_at": _now(),
                                               "merged_into": winner["id"]}})
        _audit("cabinet.duplicates_merged", actor=None, object_kind="membership",
               object_id=winner["id"], detail={"merged": len(rows) - 1})
        rows = [winner]
    return ensure_membership(rows[0])


def _merge_cabinets(win_id: str, lose_id: str) -> None:
    """Fold a duplicate cabinet into the surviving one.

    Everything that referenced the duplicate now references the survivor.
    Memberships move one by one because of the (cabinet_id, user_email)
    unique index: a person present in BOTH cabinets keeps the surviving row
    and the duplicate is marked merged, never deleted (audit history).
    """
    for coll in ("cabinet_links", "dossier_tasks", "exception_cases"):
        try:
            getattr(_db, coll).update_many({"cabinet_id": lose_id},
                                           {"$set": {"cabinet_id": win_id}})
        except Exception:
            pass
    for mem in _db.cabinet_memberships.find({"cabinet_id": lose_id}):
        dup = _db.cabinet_memberships.find_one({"cabinet_id": win_id,
                                                "user_email": mem["user_email"]})
        if dup:
            _db.cabinet_memberships.update_one(
                {"id": mem["id"]}, {"$set": {"status": "merged", "merged_at": _now(),
                                             "merged_into": dup["id"]}})
        else:
            _db.cabinet_memberships.update_one(
                {"id": mem["id"]}, {"$set": {"cabinet_id": win_id}})
    _db.cabinets.update_one({"id": lose_id},
                            {"$set": {"status": "merged", "merged_into": win_id,
                                      "merged_at": _now()}})


def require_cabinet_role(email: str, allowed: tuple) -> Dict[str, Any]:
    """Membership + role gate. Returns the membership for convenience.

    `allowed` may contain legacy names ("admin"): both sides are normalized so
    old call sites keep working during the v1→v2 transition.
    """
    m = current_membership(email)
    allowed_norm = tuple(normalize_role(r) for r in allowed)
    if m.get("role") not in allowed_norm:
        raise HTTPException(403, "Votre rôle ne permet pas cette action.")
    return m


def _task_tenant_ids(m: Dict[str, Any]) -> List[str]:
    """Dossiers where this member owns at least one task in the grille (S9).

    This is what makes the grille real: being given the paie of a dossier
    GRANTS you sight of that dossier, even if someone else is its owner."""
    try:
        return list({t["tenant_id"] for t in _db.dossier_tasks.find(
            {"cabinet_id": m["cabinet_id"], "assignee_membership_id": m["id"]})})
    except Exception:
        return []


def visible_tenant_ids(email: str) -> List[str]:
    """Which client dossiers this person may see.

    EC and superviseur see the whole portfolio (their job IS oversight).
    Everyone else sees what is theirs — as dossier owner OR as assignee of any
    task on it. Not a UI filter but the data boundary itself, so a guessed URL
    or a hand-made API call finds nothing either.
    """
    m = current_membership(email)
    q: Dict[str, Any] = {"cabinet_id": m["cabinet_id"], "status": "active"}
    if m.get("role") in PORTFOLIO_WIDE_ROLES:
        return [l["tenant_id"] for l in _db.cabinet_links.find(q)]
    q["assignee_membership_id"] = m["id"]
    owned = {l["tenant_id"] for l in _db.cabinet_links.find(q)}
    owned.update(_task_tenant_ids(m))
    return list(owned)


def assert_can_see_tenant(email: str, tenant_id: str) -> Dict[str, Any]:
    """Guard for any single-dossier access. Raises 403 when out of scope."""
    m = current_membership(email)
    q: Dict[str, Any] = {"cabinet_id": m["cabinet_id"], "tenant_id": tenant_id,
                         "status": "active"}
    link = _db.cabinet_links.find_one(q)
    if not link:
        raise HTTPException(403, "Ce dossier ne vous est pas attribué.")
    if m.get("role") in PORTFOLIO_WIDE_ROLES:
        return link
    if link.get("assignee_membership_id") == m["id"]:
        return link
    if tenant_id in _task_tenant_ids(m):
        return link
    raise HTTPException(403, "Ce dossier ne vous est pas attribué.")


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
    mem = _new_membership(cab["id"], email, "expert_comptable", body.get("full_name"),
                          invited_by=email, domains=["compta"],
                          ordre_number=(body.get("ordre_number") or "").strip() or None,
                          is_lab_referent=True)
    _audit("cabinet.created", actor=None, object_kind="cabinet", object_id=cab["id"],
           after={"name": name, "admin": email})
    return {"ok": True, "cabinet": {"id": cab["id"], "name": name},
            "membership": _public(mem)}


def _new_membership(cabinet_id: str, email: str, role: str, full_name=None,
                    invited_by=None, must_change=False, domains=None,
                    ordre_number=None, is_lab_referent=False) -> Dict[str, Any]:
    doc = {
        "id": str(uuid4()), "cabinet_id": cabinet_id, "user_email": _norm(email),
        "full_name": full_name or _norm(email).split("@")[0],
        "role": role, "status": "active",
        "domains": [d for d in (domains or ["compta"]) if d in DOMAINS] or ["compta"],
        "ordre_number": ordre_number, "is_lab_referent": bool(is_lab_referent),
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
            "can": {"manage_team": m["role"] in MANAGER_ROLES,
                    "assign": m["role"] in ASSIGN_ROLES,
                    "validate": m["role"] in VALIDATOR_ROLES,
                    "sign": can_sign(m),
                    "export": m["role"] in VALIDATOR_ROLES}}


@router.post("/api/cabinet/team")
def create_member(body: Dict[str, Any], token_data=Depends(require_role(["comptable"]))):
    """Admin creates an employee account directly (founder decision v1.1).

    The admin sets an initial password and shares it themselves. Two guard
    rails make that safe: the employee MUST change it on first login, so the
    admin never knows their working password afterwards — which is what keeps
    the audit trail meaningful ("Léa did this" really means Léa).
    """
    from services import password_policy
    admin = require_cabinet_role(token_data.email, MANAGER_ROLES)
    email = _norm(body.get("email"))
    role = normalize_role(body.get("role"))
    password = body.get("password") or ""
    if not email or "@" not in email:
        raise HTTPException(422, "Email invalide.")
    if role not in HUMAN_ROLES:
        raise HTTPException(422, "Rôle invalide (assistant, collaborateur, superviseur ou expert_comptable).")
    domains = body.get("domains") or ["compta"]
    if not isinstance(domains, list) or not all(d in DOMAINS for d in domains):
        raise HTTPException(422, "Domaines invalides (compta, social, juridique).")
    ordre_number = (body.get("ordre_number") or "").strip() or None
    password_policy.assert_valid(password)
    if _db.users.find_one({"email": email}):
        raise HTTPException(409, "Cet email est déjà utilisé.")

    _db.users.insert_one({
        "email": email, "role": "comptable", "tenant_id": None,
        "hashed_password": hash_password(password), "created_at": _now(),
    })
    mem = _new_membership(admin["cabinet_id"], email, role,
                          body.get("full_name"), invited_by=token_data.email,
                          must_change=True, domains=domains,
                          ordre_number=ordre_number,
                          is_lab_referent=bool(body.get("is_lab_referent")))
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
        mm = ensure_membership(mm)
        dossiers = _db.cabinet_links.count_documents(
            {"cabinet_id": m["cabinet_id"], "assignee_membership_id": mm["id"],
             "status": "active"})
        open_cases = _db.exception_cases.count_documents(
            {"cabinet_id": m["cabinet_id"], "assignee_membership_id": mm["id"],
             "status": {"$in": ["open", "in_progress"]}})
        tasks = 0
        try:
            tasks = _db.dossier_tasks.count_documents(
                {"cabinet_id": m["cabinet_id"], "assignee_membership_id": mm["id"]})
        except Exception:
            pass
        out.append({**_public(dict(mm)), "dossiers": dossiers,
                    "open_cases": open_cases, "tasks": tasks})
    unassigned = _db.cabinet_links.count_documents(
        {"cabinet_id": m["cabinet_id"], "status": "active",
         "assignee_membership_id": {"$in": [None, ""]}})
    return {"members": out, "unassigned_dossiers": unassigned,
            "my_role": m["role"], "my_membership_id": m["id"]}


@router.patch("/api/cabinet/team/{membership_id}")
def update_member(membership_id: str, body: Dict[str, Any],
                  token_data=Depends(require_role(["comptable"]))):
    """Change a role, suspend, or remove — admin only.

    Removing does NOT touch the person's user account or their audit history:
    accounting needs to know who did what years later. Their dossiers fall into
    the "Non assignés" pool (founder decision), which the dashboard surfaces in
    amber so they cannot be silently forgotten.
    """
    admin = require_cabinet_role(token_data.email, MANAGER_ROLES)
    mem = _db.cabinet_memberships.find_one({"id": membership_id,
                                            "cabinet_id": admin["cabinet_id"]})
    if not mem:
        raise HTTPException(404, "Membre introuvable.")
    mem = ensure_membership(mem)
    new_role = normalize_role(body.get("role")) if body.get("role") else None
    if mem["id"] == admin["id"] and (body.get("status") in ("suspended", "removed")
                                     or new_role not in (None, "expert_comptable")):
        raise HTTPException(409, "Vous ne pouvez pas retirer vos propres droits d'expert-comptable.")

    upd: Dict[str, Any] = {}
    if new_role:
        if new_role not in HUMAN_ROLES:
            raise HTTPException(422, "Rôle invalide.")
        upd["role"] = new_role
    if body.get("domains") is not None:
        d = body["domains"]
        if not isinstance(d, list) or not all(x in DOMAINS for x in d) or not d:
            raise HTTPException(422, "Domaines invalides.")
        upd["domains"] = d
    if "ordre_number" in body:
        upd["ordre_number"] = (body.get("ordre_number") or "").strip() or None
    if "is_lab_referent" in body:
        upd["is_lab_referent"] = bool(body.get("is_lab_referent"))
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


@router.patch("/api/cabinet/settings")
def update_settings(body: Dict[str, Any],
                    token_data=Depends(require_role(["comptable"]))):
    """Cabinet-level policy knobs — EC only. Currently: the four-eyes seuil
    (review_threshold_eur) and the two-step review switch."""
    admin = require_cabinet_role(token_data.email, MANAGER_ROLES)
    cab = _db.cabinets.find_one({"id": admin["cabinet_id"]}) or {}
    settings = dict(cab.get("settings") or {})
    upd = {}
    if "review_threshold_eur" in body:
        try:
            v = float(body["review_threshold_eur"])
        except (TypeError, ValueError):
            raise HTTPException(422, "Seuil invalide.")
        if v < 0:
            raise HTTPException(422, "Le seuil ne peut pas être négatif.")
        upd["review_threshold_eur"] = v
    if "require_two_step_review" in body:
        upd["require_two_step_review"] = bool(body["require_two_step_review"])
    if not upd:
        raise HTTPException(422, "Rien à modifier.")
    settings.update(upd)
    _db.cabinets.update_one({"id": admin["cabinet_id"]}, {"$set": {"settings": settings}})
    _audit("cabinet.settings_updated", actor=token_data, object_kind="cabinet",
           object_id=admin["cabinet_id"], before=cab.get("settings"), after=settings)
    return {"ok": True, "settings": settings}


# ==========================================================================
# S6 — cabinet-initiated client onboarding
# ==========================================================================

def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def _fetch_company(siren: str) -> Optional[Dict[str, Any]]:
    """Government lookup (recherche-entreprises.api.gouv.fr — public, no key).

    Kept as its own function so tests can replace it without network access,
    and so a future INSEE-Sirene switch changes exactly one place."""
    import json as _json
    import urllib.request
    url = f"https://recherche-entreprises.api.gouv.fr/search?q={siren}&page=1&per_page=1"
    req = urllib.request.Request(url, headers={"User-Agent": "FidClic/1.0"})
    with urllib.request.urlopen(req, timeout=8) as r:
        data = _json.loads(r.read().decode())
    for res in data.get("results") or []:
        if res.get("siren") == siren:
            siege = res.get("siege") or {}
            return {
                "siren": siren,
                "legal_name": res.get("nom_complet") or res.get("nom_raison_sociale"),
                "siret": siege.get("siret"),
                "naf_code": res.get("activite_principale"),
                "address": siege.get("adresse"),
                "postal_code": siege.get("code_postal"),
                "city": siege.get("libelle_commune"),
                "legal_form": res.get("nature_juridique"),
                "active": (res.get("etat_administratif") or "A") == "A",
            }
    return None


@router.get("/api/cabinet/siren-lookup")
def siren_lookup(siren: str = "", token_data=Depends(require_role(["comptable"]))):
    """Type a SIREN, get the company — like plate number → RTO record.
    EC/superviseur only (they are the ones who onboard clients)."""
    require_cabinet_role(token_data.email, ASSIGN_ROLES)
    digits = "".join(ch for ch in (siren or "") if ch.isdigit())
    if len(digits) != 9:
        raise HTTPException(422, "Le SIREN doit comporter 9 chiffres.")
    if not _luhn_ok(digits):
        raise HTTPException(422, "SIREN invalide (échec du contrôle de clé).")
    try:
        found = _fetch_company(digits)
    except Exception:
        raise HTTPException(502, "Annuaire des entreprises injoignable — réessayez, ou saisissez les informations manuellement.")
    if not found:
        raise HTTPException(404, "Aucune entreprise trouvée pour ce SIREN.")
    return {"company": found}


@router.post("/api/cabinet/clients")
def create_client_dossier(body: Dict[str, Any],
                          token_data=Depends(require_role(["comptable"]))):
    """S6 — the cabinet onboards a client itself. The client never has to
    register first: dossier + mandate are created in one step, the owner is
    assigned, and (optionally) a client login is created whose temp password
    is shown exactly once.

    This is the flow that makes FidClic sellable to a 45-client cabinet —
    nobody asks 45 bakery owners to sign up on their own.
    """
    actor = require_cabinet_role(token_data.email, ASSIGN_ROLES)
    siren = "".join(ch for ch in str(body.get("siren") or "") if ch.isdigit())
    legal_name = (body.get("legal_name") or "").strip()
    if len(siren) != 9 or not _luhn_ok(siren):
        raise HTTPException(422, "SIREN invalide (9 chiffres + clé).")
    if not legal_name:
        raise HTTPException(422, "La raison sociale est obligatoire.")

    # one dossier per SIREN per cabinet — a duplicate is a mistake, not a client
    for l in _db.cabinet_links.find({"cabinet_id": actor["cabinet_id"], "status": "active"}):
        t = _db.tenants.find_one({"id": l["tenant_id"]}) or {}
        if t.get("siren") == siren:
            raise HTTPException(409, f"Ce SIREN est déjà suivi par votre cabinet ({t.get('legal_name') or t.get('name')}).")

    owner_membership_id = body.get("owner_membership_id") or None
    if owner_membership_id:
        mem = _db.cabinet_memberships.find_one({"id": owner_membership_id,
                                                "cabinet_id": actor["cabinet_id"],
                                                "status": "active"})
        if not mem:
            raise HTTPException(422, "Responsable invalide ou inactif.")

    # ALL validation happens before ANY insert — a refused request must leave
    # zero trace, otherwise a failed attempt half-creates a dossier (found by
    # the test that tried a duplicate email after this block originally ran).
    email = _norm(body.get("client_email") or "")
    if email:
        if "@" not in email:
            raise HTTPException(422, "Email du client invalide.")
        if _db.users.find_one({"email": email}):
            raise HTTPException(409, "Cet email a déjà un compte — le client peut se connecter et vous retrouver dans « Mon comptable ».")

    tenant = {
        "id": str(uuid4()),
        "name": (body.get("name") or legal_name)[:60],
        "legal_name": legal_name,
        "siren": siren,
        "siret": "".join(ch for ch in str(body.get("siret") or "") if ch.isdigit()) or None,
        "naf_code": body.get("naf_code"),
        "address": body.get("address"), "postal_code": body.get("postal_code"),
        "city": body.get("city"),
        "facturation_enabled": True,
        "created_by_cabinet": actor["cabinet_id"],
        "created_at": _now(),
    }
    _db.tenants.insert_one(dict(tenant))
    _db.cabinet_links.insert_one({
        "id": str(uuid4()), "cabinet_id": actor["cabinet_id"],
        "comptable_email": _norm(token_data.email),
        "tenant_id": tenant["id"], "status": "active",
        "assignee_membership_id": owner_membership_id,
        "origin": "cabinet_onboarding", "created_at": _now(),
    })

    # optional client login — temp password shown ONCE, like member creation
    client_account = None
    if email:
        from services import password_policy
        temp = password_policy.generate()
        _db.users.insert_one({"email": email, "role": "business_owner",
                              "tenant_id": tenant["id"],
                              "hashed_password": hash_password(temp),
                              "created_at": _now()})
        client_account = {"email": email, "temp_password": temp}

    _audit("client.onboarded_by_cabinet", tenant_id=tenant["id"], actor=token_data,
           object_kind="tenant", object_id=tenant["id"],
           after={"legal_name": legal_name, "siren": siren,
                  "owner": owner_membership_id,
                  "client_account_created": bool(client_account)})
    return {"ok": True, "tenant_id": tenant["id"], "client_account": client_account}


@router.post("/api/cabinet/team/{membership_id}/reset-password")
def reset_member_password(membership_id: str,
                          token_data=Depends(require_role(["comptable"]))):
    """Forgot-password, cabinet edition — the EC resets it in person.

    No email infrastructure needed, and it matches how these accounts are
    born (the EC created them and handed over the first password). The new
    temp password is generated server-side (always policy-compliant), shown
    EXACTLY ONCE to the EC, and must_change_password forces the employee to
    replace it at next login — so the EC never knows the working password.
    Self-reset via this route is refused: the EC's own recovery will be the
    email flow (S3 backlog), not a self-serve loop that proves nothing.
    """
    from services import password_policy
    admin = require_cabinet_role(token_data.email, MANAGER_ROLES)
    mem = _db.cabinet_memberships.find_one({"id": membership_id,
                                            "cabinet_id": admin["cabinet_id"]})
    if not mem:
        raise HTTPException(404, "Membre introuvable.")
    if mem["id"] == admin["id"]:
        raise HTTPException(409, "Utilisez le changement de mot de passe classique pour votre propre compte.")
    if mem.get("status") != "active":
        raise HTTPException(409, "Réactivez d'abord ce compte.")

    temp = password_policy.generate()
    _db.users.update_one({"email": mem["user_email"]},
                         {"$set": {"hashed_password": hash_password(temp)}})
    _db.cabinet_memberships.update_one({"id": mem["id"]},
                                       {"$set": {"must_change_password": True}})
    _audit("cabinet.password_reset_by_admin", actor=token_data,
           object_kind="membership", object_id=mem["id"],
           detail={"member": mem["user_email"]})
    return {"ok": True, "temp_password": temp}


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
    admin = require_cabinet_role(token_data.email, ASSIGN_ROLES)
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
    m = require_cabinet_role(token_data.email, ASSIGN_ROLES)
    links = _db.cabinet_links.find({"cabinet_id": m["cabinet_id"], "status": "active",
                                    "assignee_membership_id": {"$in": [None, ""]}})
    out = []
    for l in links:
        t = _db.tenants.find_one({"id": l["tenant_id"]}) or {}
        out.append({"tenant_id": l["tenant_id"],
                    "name": t.get("legal_name") or t.get("name"),
                    "since": l.get("unassigned_at") or l.get("created_at")})
    return {"dossiers": out}
