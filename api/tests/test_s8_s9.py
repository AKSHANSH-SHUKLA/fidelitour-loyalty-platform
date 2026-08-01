"""
Tests for S8 (roles v2 — two axes) and S9 (grille de répartition).

Run:  cd api && python3 tests/test_s8_s9.py

WHY THESE MATTER
    S8 turns a permission ladder into a responsibility chain; S9 turns
    "one dossier = one owner" into "one dossier = a duty roster". The failure
    modes to guard:
      - legacy v1 rows (role="admin") must keep working untouched (migration),
      - the EC signing gate must depend on the Ordre number, not just the role,
      - a task assignment must GRANT sight of the dossier (else the pôle social
        can't work), but must NOT leak any other dossier (positive control),
      - the grille must fall back to the dossier owner when nothing is chosen.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.grille as G
import features.audit as A

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗'} {name}{('  → ' + str(extra)) if extra and not cond else ''}")


def expect_status(name, code, fn):
    try:
        fn()
        check(name, False, f"no error raised (expected {code})")
    except Exception as e:
        check(name, getattr(e, "status_code", None) == code, e)


def tok(email):
    return SimpleNamespace(email=email, role="comptable", tenant_id=None)


PW = "Cabinet-Test2026!"


def build():
    """Cabinet Rousseau: EC + superviseur + collaborateur + assistant +
    gestionnaire de paie (= collaborateur/social). Three dossiers, plus one in
    a second cabinet as the isolation control."""
    db = mongomock.MongoClient().db
    db.tenants.insert_many([
        {"id": "t1", "legal_name": "Café Lumière SARL"},
        {"id": "t2", "legal_name": "Boulangerie Dupont"},
        {"id": "t3", "legal_name": "Garage Martin"},
        {"id": "tX", "legal_name": "Client Cabinet B"},
    ])
    for mod in (CO, G, A):
        mod.init(db)

    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "full_name": "Mme Rousseau",
                       "ordre_number": "140002200"})
    CO.cabinet_signup({"email": "other@cabB.fr", "name": "Cabinet B", "password": PW})
    r = tok("rousseau@cab.fr")
    CO.create_member({"email": "sophie@cab.fr", "role": "superviseur",
                      "password": PW, "full_name": "Sophie"}, token_data=r)
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=r)
    CO.create_member({"email": "marc@cab.fr", "role": "assistant",
                      "password": PW, "full_name": "Marc"}, token_data=r)
    CO.create_member({"email": "hugo@cab.fr", "role": "collaborateur",
                      "domains": ["social"], "password": PW,
                      "full_name": "Hugo (paie)"}, token_data=r)

    cab_a = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    cab_b = CO._db.cabinets.find_one({"name": "Cabinet B"})["id"]
    for tid, cab in (("t1", cab_a), ("t2", cab_a), ("t3", cab_a), ("tX", cab_b)):
        db.cabinet_links.insert_one({"id": f"l_{tid}", "cabinet_id": cab,
                                     "tenant_id": tid, "status": "active"})
    # Léa owns t1, t2; t3 unowned.
    lea_id = mem_id("lea@cab.fr")
    db.cabinet_links.update_many({"tenant_id": {"$in": ["t1", "t2"]}},
                                 {"$set": {"assignee_membership_id": lea_id}})
    return db, cab_a, cab_b


def mem_id(email):
    return CO._db.cabinet_memberships.find_one({"user_email": email})["id"]


# ==========================================================================
# S8 — roles v2
# ==========================================================================

def test_roles_v2(db):
    print("\nS8 — two-axis roles")

    me = CO.cabinet_me(token_data=tok("rousseau@cab.fr"))
    check("founder is expert_comptable", me["membership"]["role"] == "expert_comptable")
    check("founder carries the LAB referent duty", me["membership"]["is_lab_referent"] is True)
    check("EC with Ordre number can sign", me["can"]["sign"] is True)

    # can_sign is role AND ordre_number, not role alone
    other = CO.cabinet_me(token_data=tok("other@cabB.fr"))
    check("EC WITHOUT Ordre number cannot sign", other["can"]["sign"] is False)

    sophie = CO.cabinet_me(token_data=tok("sophie@cab.fr"))
    check("superviseur can validate", sophie["can"]["validate"] is True)
    check("superviseur can assign dossiers", sophie["can"]["assign"] is True)
    check("superviseur canNOT sign", sophie["can"]["sign"] is False)
    check("superviseur canNOT manage team", sophie["can"]["manage_team"] is False)

    hugo = CO.cabinet_me(token_data=tok("hugo@cab.fr"))
    check("gestionnaire de paie = collaborateur + social domain",
          hugo["membership"]["role"] == "collaborateur"
          and hugo["membership"]["domains"] == ["social"])

    marc = CO.cabinet_me(token_data=tok("marc@cab.fr"))
    check("assistant cannot validate", marc["can"]["validate"] is False)

    expect_status("superviseur cannot create members (EC only)", 403,
                  lambda: CO.create_member({"email": "x@cab.fr", "role": "assistant",
                                            "password": PW}, token_data=tok("sophie@cab.fr")))
    expect_status("cannot create an 'agent' member by hand", 422,
                  lambda: CO.create_member({"email": "bot@cab.fr", "role": "agent",
                                            "password": PW}, token_data=tok("rousseau@cab.fr")))
    expect_status("invalid domain refused", 422,
                  lambda: CO.create_member({"email": "y@cab.fr", "role": "assistant",
                                            "domains": ["astrologie"],
                                            "password": PW}, token_data=tok("rousseau@cab.fr")))

    # ---- v1 legacy row migration (normalize-on-read) ----
    db.users.insert_one({"email": "legacy@cab.fr", "role": "comptable"})
    db.cabinet_memberships.insert_one({
        "id": "legacy-m", "cabinet_id": CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"],
        "user_email": "legacy@cab.fr", "full_name": "Legacy Admin",
        "role": "admin", "status": "active", "must_change_password": False})
    lg = CO.cabinet_me(token_data=tok("legacy@cab.fr"))
    check("legacy 'admin' reads as expert_comptable", lg["membership"]["role"] == "expert_comptable")
    check("legacy row backfilled in DB",
          db.cabinet_memberships.find_one({"id": "legacy-m"})["role"] == "expert_comptable")
    check("legacy admin got default domain",
          db.cabinet_memberships.find_one({"id": "legacy-m"})["domains"] == ["compta"])
    check("legacy admin has no Ordre number → cannot sign", lg["can"]["sign"] is False)
    # old call sites passing ("admin",) keep working
    m = CO.require_cabinet_role("legacy@cab.fr", ("admin",))
    check("require_cabinet_role accepts legacy alias", m["role"] == "expert_comptable")

    # EC can set the Ordre number later
    CO.update_member("legacy-m", {"ordre_number": "140009999"},
                     token_data=tok("rousseau@cab.fr"))
    check("Ordre number can be added later → sign unlocked",
          CO.cabinet_me(token_data=tok("legacy@cab.fr"))["can"]["sign"] is True)
    db.cabinet_memberships.delete_one({"id": "legacy-m"})


def test_scoping_v2(db):
    print("\nS8 — portfolio-wide vs assigned visibility")

    check("EC sees whole portfolio", sorted(CO.visible_tenant_ids("rousseau@cab.fr")) == ["t1", "t2", "t3"])
    check("superviseur sees whole portfolio (their job IS oversight)",
          sorted(CO.visible_tenant_ids("sophie@cab.fr")) == ["t1", "t2", "t3"])
    check("collaborateur sees only her dossiers",
          sorted(CO.visible_tenant_ids("lea@cab.fr")) == ["t1", "t2"])
    check("assistant with nothing sees nothing", CO.visible_tenant_ids("marc@cab.fr") == [])
    expect_status("collaborateur blocked on foreign dossier", 403,
                  lambda: CO.assert_can_see_tenant("lea@cab.fr", "t3"))
    check("collaborateur allowed on own dossier (positive control)",
          CO.assert_can_see_tenant("lea@cab.fr", "t1") is not None)
    expect_status("nobody crosses cabinets", 403,
                  lambda: CO.assert_can_see_tenant("rousseau@cab.fr", "tX"))


# ==========================================================================
# S9 — grille de répartition
# ==========================================================================

def test_grille(db):
    print("\nS9 — grille: defaults, assignment, visibility grant")

    r = tok("rousseau@cab.fr")

    # defaults: nothing stored yet → member-tasks default to dossier owner Léa
    g = G.get_grille("t1", token_data=r)
    by = {t["task_type"]: t for t in g["tasks"]}
    check("grille lists the full catalogue", len(g["tasks"]) == len(G.TASK_TYPES))
    check("saisie defaults to dossier owner (Léa)",
          by["saisie"]["assignee_name"] == "Léa" and by["saisie"]["explicit"] is False)
    check("inventaire defaults to the CLIENT",
          by["inventaire"]["assignee_kind"] == "client")
    check("EC can edit the grille", g["can_edit"] is True)

    # assign paie to Hugo (social domain — no warning)
    res = G.set_grille_task("t1", {"task_type": "paie_dsn", "assignee_kind": "member",
                                   "membership_id": mem_id("hugo@cab.fr")}, token_data=r)
    check("paie assigned to gestionnaire without domain warning",
          res["ok"] and res["domain_warning"] is False)

    # assign saisie to Hugo (compta task, social member — warning, not block)
    res = G.set_grille_task("t1", {"task_type": "saisie", "assignee_kind": "member",
                                   "membership_id": mem_id("hugo@cab.fr")}, token_data=r)
    check("domain mismatch warns but does not block", res["domain_warning"] is True)
    G.set_grille_task("t1", {"task_type": "saisie", "assignee_kind": "none"}, token_data=r)
    g = G.get_grille("t1", token_data=r)
    by = {t["task_type"]: t for t in g["tasks"]}
    check("'none' clears back to the owner default",
          by["saisie"]["assignee_name"] == "Léa" and by["saisie"]["explicit"] is False)

    # THE important behaviour: a task grants sight of the dossier…
    check("task assignment GRANTS Hugo sight of t1",
          "t1" in CO.visible_tenant_ids("hugo@cab.fr"))
    check("…and single-dossier guard agrees (positive control)",
          CO.assert_can_see_tenant("hugo@cab.fr", "t1") is not None)
    # …but ONLY that dossier (the leak check)
    check("Hugo still cannot see t2", "t2" not in CO.visible_tenant_ids("hugo@cab.fr"))
    expect_status("Hugo blocked on t2 directly", 403,
                  lambda: CO.assert_can_see_tenant("hugo@cab.fr", "t2"))

    # third-party + client assignments
    res = G.set_grille_task("t1", {"task_type": "juridique_ag", "assignee_kind": "tiers",
                                   "label": "Cabinet juridique Durand"}, token_data=r)
    check("tiers assignment stores its label", res["ok"])
    expect_status("tiers without a name refused", 422,
                  lambda: G.set_grille_task("t1", {"task_type": "juridique_ag",
                                                   "assignee_kind": "tiers"}, token_data=r))
    G.set_grille_task("t1", {"task_type": "collecte_pieces", "assignee_kind": "client"},
                      token_data=r)
    g = G.get_grille("t1", token_data=r)
    by = {t["task_type"]: t for t in g["tasks"]}
    check("client assignment renders as Client",
          by["collecte_pieces"]["assignee_name"] == "Client" and by["collecte_pieces"]["explicit"])

    # permissions: writing is EC/superviseur only; reading follows dossier sight
    expect_status("collaborateur cannot edit the grille", 403,
                  lambda: G.set_grille_task("t1", {"task_type": "tva",
                                                   "assignee_kind": "client"},
                                            token_data=tok("lea@cab.fr")))
    ok = G.set_grille_task("t1", {"task_type": "tva", "assignee_kind": "member",
                                  "membership_id": mem_id("lea@cab.fr")},
                           token_data=tok("sophie@cab.fr"))
    check("superviseur CAN edit the grille (positive control)", ok["ok"])
    g = G.get_grille("t1", token_data=tok("lea@cab.fr"))
    check("dossier owner can READ the grille", g["can_edit"] is False and len(g["tasks"]) > 0)
    expect_status("no grille read on a dossier you cannot see", 403,
                  lambda: G.get_grille("t2", token_data=tok("hugo@cab.fr")))
    expect_status("no cross-cabinet grille access", 403,
                  lambda: G.get_grille("tX", token_data=r))

    expect_status("unknown task type refused", 422,
                  lambda: G.set_grille_task("t1", {"task_type": "sorcellerie",
                                                   "assignee_kind": "client"}, token_data=r))
    expect_status("inactive member refused", 422,
                  lambda: G.set_grille_task("t1", {"task_type": "tva",
                                                   "assignee_kind": "member",
                                                   "membership_id": "ghost"}, token_data=r))

    # workload now counts tasks
    team = CO.list_team(token_data=r)
    hugo_row = next(m for m in team["members"] if m["user_email"] == "hugo@cab.fr")
    check("team workload counts grille tasks", hugo_row["tasks"] >= 1)

    # audit trail exists for grille changes
    check("grille changes are audited",
          A._db.audit_log.count_documents({"action": "grille.task_assigned"}) >= 3)


def test_owner_change_moves_defaults(db):
    print("\nS9 — owner change instantly moves defaulted tasks")
    r = tok("rousseau@cab.fr")
    CO.assign_dossier("t2", {"membership_id": mem_id("marc@cab.fr")}, token_data=r)
    g = G.get_grille("t2", token_data=r)
    by = {t["task_type"]: t for t in g["tasks"]}
    check("defaulted tasks follow the new owner",
          by["saisie"]["assignee_name"] == "Marc" and by["saisie"]["explicit"] is False)
    check("new owner sees the dossier", "t2" in CO.visible_tenant_ids("marc@cab.fr"))


def test_duplicate_cabinet_merge(db):
    print("\nSelf-heal — duplicate cabinets from a signup double-submit")
    # simulate the race: same founder, two cabinets, split team + links
    import features.cabinet_os as co
    cabA = {"id": "dupA", "name": "Cabinet Dup", "status": "active", "created_at": "2026-08-01T10:00:00"}
    cabB = {"id": "dupB", "name": "Cabinet Dup", "status": "active", "created_at": "2026-08-01T10:00:05"}
    db.cabinets.insert_many([dict(cabA), dict(cabB)])
    db.users.insert_one({"email": "dup@cab.fr", "role": "comptable"})
    db.cabinet_memberships.insert_many([
        {"id": "m-dupA", "cabinet_id": "dupA", "user_email": "dup@cab.fr",
         "full_name": "Dup", "role": "expert_comptable", "status": "active",
         "created_at": "2026-08-01T10:00:00"},
        {"id": "m-dupB", "cabinet_id": "dupB", "user_email": "dup@cab.fr",
         "full_name": "Dup", "role": "expert_comptable", "status": "active",
         "created_at": "2026-08-01T10:00:05"},
        {"id": "m-emp", "cabinet_id": "dupB", "user_email": "emp@cab.fr",
         "full_name": "Emp", "role": "assistant", "status": "active",
         "created_at": "2026-08-01T10:01:00"},
    ])
    db.tenants.insert_one({"id": "tdup", "legal_name": "Client Dup"})
    db.cabinet_links.insert_one({"id": "l-dup", "cabinet_id": "dupB",
                                 "tenant_id": "tdup", "status": "active"})

    m = CO.current_membership("dup@cab.fr")
    check("resolves to the OLDEST membership", m["id"] == "m-dupA")
    check("duplicate membership marked merged",
          db.cabinet_memberships.find_one({"id": "m-dupB"})["status"] == "merged")
    check("duplicate cabinet marked merged",
          db.cabinets.find_one({"id": "dupB"})["status"] == "merged")
    check("links moved to the surviving cabinet",
          db.cabinet_links.find_one({"id": "l-dup"})["cabinet_id"] == "dupA")
    check("stranded employee moved to the surviving cabinet",
          db.cabinet_memberships.find_one({"id": "m-emp"})["cabinet_id"] == "dupA")
    check("founder now sees the portfolio", "tdup" in CO.visible_tenant_ids("dup@cab.fr"))
    m2 = CO.current_membership("dup@cab.fr")
    check("second resolution is stable (no flapping)", m2["id"] == "m-dupA")


def test_password_reset(db):
    print("\nForgot password — EC resets a member (no email needed)")
    r = tok("rousseau@cab.fr")
    res = CO.reset_member_password(mem_id("marc@cab.fr"), token_data=r)
    check("reset returns a temp password once", bool(res.get("temp_password")))
    from services import password_policy
    check("temp password is policy-compliant",
          password_policy.check(res["temp_password"])[0] is True)
    check("member must change it at next login",
          CO._db.cabinet_memberships.find_one({"user_email": "marc@cab.fr"})["must_change_password"] is True)
    expect_status("EC cannot self-reset via this route", 409,
                  lambda: CO.reset_member_password(mem_id("rousseau@cab.fr"), token_data=r))
    expect_status("non-EC cannot reset anyone", 403,
                  lambda: CO.reset_member_password(mem_id("marc@cab.fr"),
                                                   token_data=tok("sophie@cab.fr")))
    check("reset is audited",
          A._db.audit_log.count_documents({"action": "cabinet.password_reset_by_admin"}) >= 1)


if __name__ == "__main__":
    db, cab_a, cab_b = build()
    test_roles_v2(db)
    test_scoping_v2(db)
    test_grille(db)
    test_owner_change_moves_defaults(db)
    test_duplicate_cabinet_merge(db)
    test_password_reset(db)

    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
