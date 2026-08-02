"""
Tests for S10 (four-eyes + review queue) and S6 (cabinet onboards clients).

Run:  cd api && python3 tests/test_s10_s6.py

WHY THESE MATTER
    S10 closes the chain: the person who PREPARES an invoice is not the person
    who CHECKS it, above a threshold the cabinet chooses. Failure modes:
      - too strict → a 2-person cabinet deadlocks (below-seuil must pass),
      - too loose  → self-validation slips through unmarked,
      - and the queue must show only YOUR dossiers (scoping, as always).
    S6 is the sales-critical path: a cabinet onboards a client with one SIREN,
    with government auto-fill — and never asks the client to sign up first.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.facturation as F
import features.audit as A
import services.statuses as ST

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


def tok(email, role="comptable", tenant_id=None):
    return SimpleNamespace(email=email, role=role, tenant_id=tenant_id)


PW = "Cabinet-Test2026!"


def invoice_payload(**over):
    """Legally complete invoice payload (same helper family as test_s1_s2)."""
    base = {
        "buyer": {"name": "Client Pro SARL", "is_company": True,
                  "siren": "552100554",
                  "address": "1 rue de la Paix, 75002 Paris"},
        "lines": [{"description": "Prestation conseil", "quantity": 1,
                   "unit_price": 100.0, "vat_rate": 20}],
        "date": "2026-08-01", "supply_date": "2026-08-01",
        "due_date": "2026-08-31", "payment_term": "30 jours",
        "operation_category": "services",
    }
    base.update(over)
    return base


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, F, A):
        mod.init(db)

    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "full_name": "Mme Rousseau",
                       "ordre_number": "140002200"})
    r = tok("rousseau@cab.fr")
    CO.create_member({"email": "sophie@cab.fr", "role": "superviseur",
                      "password": PW, "full_name": "Sophie"}, token_data=r)
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=r)
    CO.create_member({"email": "marc@cab.fr", "role": "assistant",
                      "password": PW, "full_name": "Marc"}, token_data=r)

    cab = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Café Lumière SARL",
                           "name": "Café Lumière", "siren": "552100554",
                           "siret": "55210055400013", "vat_number": "FR96552100554",
                           "address": "3 rue des Halles, 37000 Tours",
                           "facturation_enabled": True, "dgfip_activated": True,
                           "vat_regime": "reel_normal"})
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab, "tenant_id": "t1",
                                 "status": "active",
                                 "assignee_membership_id": mem_id("lea@cab.fr")})
    return db, cab


def mem_id(email):
    return CO._db.cabinet_memberships.find_one({"user_email": email})["id"]


# ==========================================================================
# S10 — four-eyes
# ==========================================================================

def test_four_eyes(db, cab):
    print("\nS10 — four-eyes (seuil-based)")
    lea = tok("lea@cab.fr")

    # default seuil = 1000 €
    small = F.create_invoice(invoice_payload(tenant_id="t1"), token_data=lea)["invoice"]
    check("invoice records its preparer", small["created_by"] == "lea@cab.fr")
    check("small invoice is 120 € TTC", small["total_ttc"] == 120.0)

    r = F.set_review_status(small["id"], {"target": "validated"}, token_data=lea)
    check("below seuil: self-validation ALLOWED (no deadlock)",
          r["invoice"]["review_status"] == "validated")
    check("…but permanently marked auto_validated",
          r["invoice"].get("auto_validated") is True)

    big = F.create_invoice(invoice_payload(
        tenant_id="t1",
        lines=[{"description": "Mission annuelle", "quantity": 1,
                "unit_price": 2000.0, "vat_rate": 20}]), token_data=lea)["invoice"]
    check("big invoice is 2400 € TTC", big["total_ttc"] == 2400.0)
    expect_status("at/above seuil: self-validation BLOCKED", 409,
                  lambda: F.set_review_status(big["id"], {"target": "validated"},
                                              token_data=lea))
    # positive control — ANOTHER validator may validate the same invoice
    r2 = F.set_review_status(big["id"], {"target": "validated"},
                             token_data=tok("sophie@cab.fr"))
    check("a DIFFERENT validator validates it fine (positive control)",
          r2["invoice"]["review_status"] == "validated")
    check("cross-validation is NOT marked auto_validated",
          r2["invoice"].get("auto_validated") is not True)

    # EC can tune the seuil; the rule follows it
    CO.update_settings({"review_threshold_eur": 100}, token_data=tok("rousseau@cab.fr"))
    tiny = F.create_invoice(invoice_payload(tenant_id="t1"), token_data=lea)["invoice"]
    expect_status("after lowering seuil to 100, a 120 € invoice now blocks", 409,
                  lambda: F.set_review_status(tiny["id"], {"target": "validated"},
                                              token_data=lea))
    expect_status("non-EC cannot change the seuil", 403,
                  lambda: CO.update_settings({"review_threshold_eur": 999999},
                                             token_data=tok("sophie@cab.fr")))
    expect_status("negative seuil refused", 422,
                  lambda: CO.update_settings({"review_threshold_eur": -5},
                                             token_data=tok("rousseau@cab.fr")))
    CO.update_settings({"review_threshold_eur": 1000}, token_data=tok("rousseau@cab.fr"))

    # business owner validating their own invoice: rule does not apply
    db.users.insert_one({"email": "owner@cafe.fr", "role": "business_owner",
                         "tenant_id": "t1"})
    own = F.create_invoice(invoice_payload(
        lines=[{"description": "Grosse vente", "quantity": 1,
                "unit_price": 5000.0, "vat_rate": 20}]),
        token_data=tok("owner@cafe.fr", role="business_owner", tenant_id="t1"))["invoice"]
    ro = F.set_review_status(own["id"], {"target": "validated"},
                             token_data=tok("owner@cafe.fr", role="business_owner",
                                            tenant_id="t1"))
    check("business owner unaffected by cabinet four-eyes",
          ro["invoice"]["review_status"] == "validated")


def test_review_queue(db, cab):
    print("\nS10 — review queue (the lab tray)")
    lea = tok("lea@cab.fr")

    q = C.review_queue(token_data=tok("sophie@cab.fr"))
    check("queue exists and exposes the seuil", q["seuil"] == 1000.0)
    check("validated invoices are NOT in the queue",
          all(r["review_status"] != "validated" for r in q["queue"]))
    before = q["count"]

    inv = F.create_invoice(invoice_payload(
        tenant_id="t1",
        lines=[{"description": "Audit flash", "quantity": 1,
                "unit_price": 1500.0, "vat_rate": 20}]), token_data=lea)["invoice"]
    q2 = C.review_queue(token_data=tok("sophie@cab.fr"))
    check("new invoice lands in the queue", q2["count"] == before + 1)
    row = next(r for r in q2["queue"] if r["id"] == inv["id"])
    check("row carries the preparer", row["created_by"] == "lea@cab.fr")
    check("row carries the client name", row["client_name"] == "Café Lumière SARL")
    check("for Sophie it is NOT four-eyes-blocked",
          row["four_eyes_blocked_for_me"] is False)

    qlea = C.review_queue(token_data=lea)
    rlea = next(r for r in qlea["queue"] if r["id"] == inv["id"])
    check("for Léa (the preparer) the same row IS flagged blocked",
          rlea["four_eyes_blocked_for_me"] is True)

    # scoping: an outsider cabinet sees an empty queue
    CO.cabinet_signup({"email": "other@cabB.fr", "name": "Cabinet B", "password": PW})
    qB = C.review_queue(token_data=tok("other@cabB.fr"))
    check("another cabinet's queue does not leak ours", qB["count"] == 0)

    # oldest first
    if len(q2["queue"]) >= 2:
        dates = [r.get("created_at") or "" for r in q2["queue"]]
        check("queue is oldest-first", dates == sorted(dates))


# ==========================================================================
# S6 — cabinet onboards clients
# ==========================================================================

def test_onboarding(db, cab):
    print("\nS6 — cabinet-initiated onboarding")
    r = tok("rousseau@cab.fr")

    # lookup validation runs BEFORE any network call
    expect_status("lookup refuses short SIREN", 422,
                  lambda: CO.siren_lookup(siren="123", token_data=r))
    expect_status("lookup refuses bad checksum", 422,
                  lambda: CO.siren_lookup(siren="123456789", token_data=r))
    expect_status("assistant cannot use lookup", 403,
                  lambda: CO.siren_lookup(siren="542107651", token_data=tok("marc@cab.fr")))

    # network isolated: swap the fetcher (single seam, by design)
    orig = CO._fetch_company
    CO._fetch_company = lambda s: {"siren": s, "legal_name": "BOULANGERIE PAUL",
                                   "siret": s + "00013", "naf_code": "10.71C",
                                   "address": "2 rue du Four, 37000 Tours",
                                   "postal_code": "37000", "city": "Tours",
                                   "active": True}
    try:
        found = CO.siren_lookup(siren="542107651", token_data=r)
        check("lookup returns the company", found["company"]["legal_name"] == "BOULANGERIE PAUL")

        res = CO.create_client_dossier({
            "siren": "542107651", "legal_name": "Boulangerie Paul",
            "siret": "54210765100013", "naf_code": "10.71C",
            "owner_membership_id": mem_id("lea@cab.fr"),
            "client_email": "paul@boulangerie.fr",
        }, token_data=r)
        check("dossier created", res["ok"] is True)
        check("client login created with a one-time temp password",
              bool(res["client_account"]["temp_password"]))

        t = db.tenants.find_one({"id": res["tenant_id"]})
        check("tenant carries the identity", t["siren"] == "542107651"
              and t["facturation_enabled"] is True)
        link = db.cabinet_links.find_one({"tenant_id": res["tenant_id"]})
        check("mandate exists, owned by Léa",
              link["status"] == "active"
              and link["assignee_membership_id"] == mem_id("lea@cab.fr"))
        check("new dossier visible to its owner",
              res["tenant_id"] in CO.visible_tenant_ids("lea@cab.fr"))
        check("new dossier NOT visible to Marc",
              res["tenant_id"] not in CO.visible_tenant_ids("marc@cab.fr"))

        expect_status("same SIREN twice → 409, names the existing dossier", 409,
                      lambda: CO.create_client_dossier(
                          {"siren": "542107651", "legal_name": "Doublon"},
                          token_data=r))
        expect_status("bad SIREN refused", 422,
                      lambda: CO.create_client_dossier(
                          {"siren": "111111111", "legal_name": "X"}, token_data=r))
        expect_status("assistant cannot onboard", 403,
                      lambda: CO.create_client_dossier(
                          {"siren": "732829320", "legal_name": "Y"},
                          token_data=tok("marc@cab.fr")))
        expect_status("existing email → 409 with guidance", 409,
                      lambda: CO.create_client_dossier(
                          {"siren": "732829320", "legal_name": "Garage Z",
                           "client_email": "owner@cafe.fr"}, token_data=r))
        check("onboarding is audited",
              A._db.audit_log.count_documents({"action": "client.onboarded_by_cabinet"}) == 1)

        # superviseur can onboard too (positive control)
        res2 = CO.create_client_dossier({"siren": "732829320", "legal_name": "Garage Neuf"},
                                        token_data=tok("sophie@cab.fr"))
        check("superviseur CAN onboard (positive control)", res2["ok"] is True)
    finally:
        CO._fetch_company = orig


if __name__ == "__main__":
    db, cab = build()
    test_four_eyes(db, cab)
    test_review_queue(db, cab)
    test_onboarding(db, cab)

    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
