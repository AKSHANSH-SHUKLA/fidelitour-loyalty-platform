"""
Tests for S5 (cabinet + memberships), S7 (assignment + scoping) and
S4 (Exception Centre).

Run:  cd api && python3 tests/test_s5_s7_s4.py

WHY THESE MATTER
    This batch turns a single shared login into a team with boundaries. The two
    ways it can fail are opposite and equally bad:
      - too loose  → an assistant reads a client that isn't theirs (a leak),
      - too strict → an accountant can't reach their own client (a dead product).
    So every blocking test here is paired with a positive control.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.exceptions_centre as EC
import features.cabinet as C
import features.audit as A
import features.facturation as F

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
    """Two cabinets, three people in the first, three client dossiers."""
    db = mongomock.MongoClient().db
    db.tenants.insert_many([
        {"id": "t1", "name": "ISIS", "legal_name": "Café Lumière SARL",
         "facturation_enabled": True, "siren": "552100554", "dgfip_activated": True},
        {"id": "t2", "name": "Dupont", "legal_name": "Boulangerie Dupont",
         "facturation_enabled": True, "siren": "542107651", "dgfip_activated": True},
        {"id": "t3", "name": "Martin", "legal_name": "Garage Martin",
         "facturation_enabled": True, "siren": "732829320", "dgfip_activated": True},
        {"id": "tX", "name": "Autre", "legal_name": "Client Cabinet B",
         "facturation_enabled": True, "siren": "552100554", "dgfip_activated": True},
    ])
    for mod in (CO, EC, C, A, F):
        mod.init(db)

    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "siren": "552100554", "password": PW, "full_name": "Mme Rousseau"})
    CO.cabinet_signup({"email": "other@cabB.fr", "name": "Cabinet B",
                       "siren": "542107651", "password": PW})
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=tok("rousseau@cab.fr"))
    CO.create_member({"email": "marc@cab.fr", "role": "assistant",
                      "password": PW, "full_name": "Marc"}, token_data=tok("rousseau@cab.fr"))

    cab_a = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    cab_b = CO._db.cabinets.find_one({"name": "Cabinet B"})["id"]
    for tid, cab in (("t1", cab_a), ("t2", cab_a), ("t3", cab_a), ("tX", cab_b)):
        db.cabinet_links.insert_one({"id": f"l_{tid}", "cabinet_id": cab,
                                     "comptable_email": "rousseau@cab.fr" if cab == cab_a else "other@cabB.fr",
                                     "tenant_id": tid, "status": "active"})
    return db, cab_a, cab_b


def mem_id(email):
    return CO._db.cabinet_memberships.find_one({"user_email": email})["id"]


# ==========================================================================
# S5 — cabinet + people
# ==========================================================================

def test_memberships(db):
    print("\nS5 — cabinet, roles and accounts")

    me = CO.cabinet_me(token_data=tok("rousseau@cab.fr"))
    check("founder is expert_comptable (v2 roles)",
          me["membership"]["role"] == "expert_comptable")
    check("admin can manage team", me["can"]["manage_team"] is True)

    lea = CO.cabinet_me(token_data=tok("lea@cab.fr"))
    check("collaborateur cannot manage team", lea["can"]["manage_team"] is False)
    check("collaborateur can validate", lea["can"]["validate"] is True)
    marc = CO.cabinet_me(token_data=tok("marc@cab.fr"))
    check("assistant cannot validate", marc["can"]["validate"] is False)
    check("assistant cannot export", marc["can"]["export"] is False)

    check("admin-created account must change password",
          CO._db.cabinet_memberships.find_one({"user_email": "lea@cab.fr"})["must_change_password"] is True)

    expect_status("non-admin cannot create members", 403,
                  lambda: CO.create_member({"email": "x@cab.fr", "role": "assistant",
                                            "password": PW}, token_data=tok("lea@cab.fr")))
    expect_status("weak password refused for new member", 422,
                  lambda: CO.create_member({"email": "y@cab.fr", "role": "assistant",
                                            "password": "weak"}, token_data=tok("rousseau@cab.fr")))
    expect_status("duplicate email refused", 409,
                  lambda: CO.create_member({"email": "lea@cab.fr", "role": "assistant",
                                            "password": PW}, token_data=tok("rousseau@cab.fr")))
    expect_status("someone with no membership is refused", 403,
                  lambda: CO.cabinet_me(token_data=tok("stranger@nowhere.fr")))

    # first-login password change clears the flag
    CO.change_own_password({"new_password": "Lea-Nouveau2026!"}, token_data=tok("lea@cab.fr"))
    check("password change clears must_change flag",
          CO._db.cabinet_memberships.find_one({"user_email": "lea@cab.fr"})["must_change_password"] is False)
    expect_status("cannot reuse the same password", 422,
                  lambda: CO.change_own_password({"current_password": "Lea-Nouveau2026!",
                                                  "new_password": "Lea-Nouveau2026!"},
                                                 token_data=tok("lea@cab.fr")))
    expect_status("wrong current password refused", 403,
                  lambda: CO.change_own_password({"current_password": "nope",
                                                  "new_password": "Autre-Chose2026!"},
                                                 token_data=tok("lea@cab.fr")))

    expect_status("admin cannot demote themselves", 409,
                  lambda: CO.update_member(mem_id("rousseau@cab.fr"), {"role": "assistant"},
                                           token_data=tok("rousseau@cab.fr")))


# ==========================================================================
# S7 — assignment and scoped visibility
# ==========================================================================

def test_scoping(db):
    print("\nS7 — assignment and role-scoped visibility")

    CO.assign_dossier("t1", {"membership_id": mem_id("lea@cab.fr")}, token_data=tok("rousseau@cab.fr"))
    CO.assign_dossier("t2", {"membership_id": mem_id("marc@cab.fr")}, token_data=tok("rousseau@cab.fr"))
    # t3 deliberately left unassigned

    check("admin sees the whole portfolio",
          sorted(CO.visible_tenant_ids("rousseau@cab.fr")) == ["t1", "t2", "t3"])
    check("collaborateur sees only her dossier",
          CO.visible_tenant_ids("lea@cab.fr") == ["t1"])
    check("assistant sees only his dossier",
          CO.visible_tenant_ids("marc@cab.fr") == ["t2"])

    # positive control — scoping must not over-block
    ok = C.cabinet_client_detail("t1", token_data=tok("lea@cab.fr"))
    check("collaborateur CAN open her own dossier", ok["summary"]["tenant_id"] == "t1")

    expect_status("collaborateur blocked from a colleague's dossier", 403,
                  lambda: C.cabinet_client_detail("t2", token_data=tok("lea@cab.fr")))
    expect_status("assistant blocked from an unassigned dossier", 403,
                  lambda: C.cabinet_client_detail("t3", token_data=tok("marc@cab.fr")))
    expect_status("cabinet B blocked from cabinet A's client", 403,
                  lambda: C.cabinet_client_detail("t1", token_data=tok("other@cabB.fr")))
    check("cabinet B sees only its own client",
          CO.visible_tenant_ids("other@cabB.fr") == ["tX"])

    lst = C.cabinet_clients(token_data=tok("lea@cab.fr"))
    check("portfolio listing is scoped too",
          [c["tenant_id"] for c in lst["clients"]] == ["t1"], lst["clients"])

    team = CO.list_team(token_data=tok("rousseau@cab.fr"))
    by_email = {m["user_email"]: m for m in team["members"]}
    check("team shows per-member workload",
          by_email["lea@cab.fr"]["dossiers"] == 1 and by_email["marc@cab.fr"]["dossiers"] == 1)
    check("unassigned pool is surfaced", team["unassigned_dossiers"] == 1, team)

    expect_status("non-admin cannot assign dossiers", 403,
                  lambda: CO.assign_dossier("t3", {"membership_id": mem_id("lea@cab.fr")},
                                            token_data=tok("lea@cab.fr")))
    expect_status("cannot assign to an inactive member", 422,
                  lambda: CO.assign_dossier("t3", {"membership_id": "does-not-exist"},
                                            token_data=tok("rousseau@cab.fr")))

    # removing a member frees their dossiers instead of orphaning them silently
    res = CO.update_member(mem_id("marc@cab.fr"), {"status": "removed"},
                           token_data=tok("rousseau@cab.fr"))
    check("removing a member frees their dossiers", res["dossiers_unassigned"] == 1, res)
    expect_status("removed member loses access immediately", 403,
                  lambda: CO.cabinet_me(token_data=tok("marc@cab.fr")))
    check("their dossier is now in the unassigned pool",
          CO.list_team(token_data=tok("rousseau@cab.fr"))["unassigned_dossiers"] == 2)
    check("their audit history survives removal",
          CO._db.cabinet_memberships.find_one({"user_email": "marc@cab.fr"}) is not None)

    # suspension blocks access but is reversible
    CO.update_member(mem_id("lea@cab.fr"), {"status": "suspended"}, token_data=tok("rousseau@cab.fr"))
    expect_status("suspended member is blocked", 403,
                  lambda: CO.cabinet_me(token_data=tok("lea@cab.fr")))
    CO.update_member(mem_id("lea@cab.fr"), {"status": "active"}, token_data=tok("rousseau@cab.fr"))
    check("reactivated member works again",
          CO.cabinet_me(token_data=tok("lea@cab.fr"))["membership"]["status"] == "active")

    # role change keeps the dossiers with the same person
    CO.update_member(mem_id("lea@cab.fr"), {"role": "admin"}, token_data=tok("rousseau@cab.fr"))
    check("promotion keeps her dossiers", "t1" in CO.visible_tenant_ids("lea@cab.fr"))
    check("promotion widens her view", len(CO.visible_tenant_ids("lea@cab.fr")) == 3)
    CO.update_member(mem_id("lea@cab.fr"), {"role": "collaborateur"}, token_data=tok("rousseau@cab.fr"))
    check("demotion narrows it back", CO.visible_tenant_ids("lea@cab.fr") == ["t1"])


# ==========================================================================
# S4 — Exception Centre
# ==========================================================================

def test_cases(db):
    print("\nS4 — Exception Centre")

    case = EC.open_case("t1", "pa_rejection", detail_fr="Facture FAC-1 refusée",
                        related_kind="invoice", related_id="inv-1", related_ref="FAC-1")
    check("case created for a rejection", case and case["status"] == "open", case)
    check("case gets a number", case["number"].startswith("CAS-"))
    check("red severity for a rejection", case["severity"] == "red")
    check("case auto-assigned to the dossier owner",
          case["assignee_membership_id"] == mem_id("lea@cab.fr"), case["assignee_membership_id"])
    check("case has a due date", bool(case.get("due_date")))

    again = EC.open_case("t1", "pa_rejection", related_id="inv-1", related_ref="FAC-1")
    check("same problem does not create a second case", again["id"] == case["id"])
    check("repeat occurrence is counted",
          EC._db.exception_cases.find_one({"id": case["id"]})["occurrences"] == 2)

    # unassigned dossier → escalate to admin, never ownerless
    c3 = EC.open_case("t3", "export_failed", related_id="batch-9")
    check("unassigned dossier escalates to admin",
          c3["assignee_membership_id"] == mem_id("rousseau@cab.fr"))

    check("no cabinet means no case (business still sees its own error)",
          EC.open_case("no-such-tenant", "pa_rejection") is None)

    lst = CO and EC.list_cases(token_data=tok("rousseau@cab.fr"))
    check("admin sees all cabinet cases", lst["counts"]["open"] == 2, lst["counts"])
    lea_list = EC.list_cases(token_data=tok("lea@cab.fr"))
    check("collaborateur sees only her client's cases",
          [c["tenant_id"] for c in lea_list["cases"]] == ["t1"], lea_list["cases"])
    check("case list carries client and assignee names",
          lea_list["cases"][0].get("client_name") and lea_list["cases"][0].get("assignee_name"))

    other = EC.list_cases(token_data=tok("other@cabB.fr"))
    check("another cabinet sees none of these cases", other["counts"]["open"] == 0)

    expect_status("cannot filter to a dossier you cannot see", 403,
                  lambda: EC.list_cases(tenant_id="t3", token_data=tok("lea@cab.fr")))

    # workflow
    EC.set_case_status(case["id"], {"status": "in_progress"}, token_data=tok("lea@cab.fr"))
    check("case can move to in_progress",
          EC._db.exception_cases.find_one({"id": case["id"]})["status"] == "in_progress")
    expect_status("dismissing without a reason is refused", 422,
                  lambda: EC.set_case_status(case["id"], {"status": "dismissed"},
                                             token_data=tok("lea@cab.fr")))
    out = EC.set_case_status(case["id"], {"status": "resolved", "note": "Avoir émis"},
                             token_data=tok("lea@cab.fr"))
    check("case can be resolved with a note", out["case"]["status"] == "resolved")
    check("resolution records who closed it", out["case"]["closed_by"] == "lea@cab.fr")
    check("closed case leaves the open queue",
          EC.list_cases(status="open", token_data=tok("rousseau@cab.fr"))["counts"]["open"] == 1)

    expect_status("cannot touch a case outside your scope", 403,
                  lambda: EC.set_case_status(c3["id"], {"status": "resolved"},
                                             token_data=tok("lea@cab.fr")))

    # reassignment rules
    EC.assign_case(c3["id"], {"membership_id": mem_id("lea@cab.fr")},
                   token_data=tok("rousseau@cab.fr"))
    check("admin can reassign any case",
          EC._db.exception_cases.find_one({"id": c3["id"]})["assignee_membership_id"] == mem_id("lea@cab.fr"))

    check("case actions are audited",
          EC._db.audit_log.count_documents({"action": "case.status_changed"}) > 0)


def test_invoice_creates_case(db):
    print("\nIntegration — a real rejection raises a real case")

    before = EC._db.exception_cases.count_documents({})
    F.create_invoice({
        "buyer": {"name": "byblos", "is_company": True, "siren": "552100554",
                  "address": "3 rue X, 75001 Paris"},
        "date": "2026-07-01", "supply_date": "2026-07-01", "due_date": "2026-07-31",
        "operation_category": "services",
        "lines": [{"description": "x", "quantity": 1, "unit_price": 900, "vat_rate": 20}],
        "send": True, "simulate": "reject",
    }, token_data=SimpleNamespace(tenant_id="t1", role="business_owner", email="owner@isis.fr"))
    after = EC._db.exception_cases.count_documents({})
    check("rejecting an invoice opens a case", after == before + 1, f"{before}→{after}")

    latest = list(EC._db.exception_cases.find({"type": "pa_rejection"}).sort("created_at", -1))[0]
    check("the case points back at the invoice", latest["related"]["kind"] == "invoice")
    check("the case landed on the dossier owner",
          latest["assignee_membership_id"] == mem_id("lea@cab.fr"))


if __name__ == "__main__":
    print("=" * 62)
    print("FidClic — S5 / S7 / S4 (cabinet as a team)")
    print("=" * 62)
    db, cab_a, cab_b = build()
    test_memberships(db)
    test_scoping(db)
    test_cases(db)
    test_invoice_creates_case(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
