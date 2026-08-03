"""
Tests — Multi-PA routing (Model B): one cabinet, clients on ANY platform.

Run:  cd api && python3 tests/test_multi_pa.py

WHY THIS MATTERS (the USP)
    A cabinet's clients are NOT all on the same Plateforme Agréée. Client A is on
    B2Brouter, Client B on Iopole, Client C on Pennylane. FidClic must route each
    client's e-invoicing to ITS OWN PA — automatically, from one dashboard.
    The factory get_pdp_connector(tenant) is that router: it reads the tenant's
    pdp_provider and returns the right connector, cached per provider. The rest
    of the app is PA-agnostic, so nothing else changes.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.facturation as F
import features.cabinet as C
import features.cabinet_os as CO
import features.exceptions_centre as EC
import features.audit as A
from services import pdp_connector
from services.pdp_connector import get_pdp_connector, reset_pdp_connector, InvoiceState

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


def owner(tid):
    return SimpleNamespace(email=f"owner@{tid}.fr", role="business_owner", tenant_id=tid)


def payload(**over):
    base = {"buyer": {"name": "Client Pro SARL", "is_company": True, "siren": "552100554",
                      "address": "1 rue de la Paix, Paris"},
            "lines": [{"description": "Prestation", "quantity": 1, "unit_price": 100.0, "vat_rate": 20}],
            "date": "2026-07-15", "supply_date": "2026-07-15", "due_date": "2026-08-15",
            "payment_term": "net30", "operation_category": "services"}
    base.update(over)
    return base


def build():
    db = mongomock.MongoClient().db
    reset_pdp_connector()
    for k in ("PDP_PROVIDER", "B2BROUTER_API_KEY", "IOPOLE_API_KEY"):
        os.environ.pop(k, None)
    for mod in (F, C, CO, EC, A):
        mod.init(db)
    # two clients, two different platforms
    db.tenants.insert_one({"id": "t1", "legal_name": "Boulangerie", "siren": "552100554",
                           "facturation_enabled": True, "dgfip_activated": True,
                           "pdp_provider": "b2brouter"})
    db.tenants.insert_one({"id": "t2", "legal_name": "Garage", "siren": "542107651",
                           "facturation_enabled": True, "dgfip_activated": True,
                           "pdp_provider": "iopole"})
    db.tenants.insert_one({"id": "t3", "legal_name": "Défaut", "siren": "652014051",
                           "facturation_enabled": True, "dgfip_activated": True})  # no PA set
    db.users.insert_one({"email": "owner@t1.fr", "role": "business_owner", "tenant_id": "t1"})
    db.users.insert_one({"email": "owner@t2.fr", "role": "business_owner", "tenant_id": "t2"})
    db.users.insert_one({"email": "owner@t3.fr", "role": "business_owner", "tenant_id": "t3"})
    return db


def test_router():
    print("\nMulti-PA — the router picks each client's own PA")
    reset_pdp_connector()
    for k in ("PDP_PROVIDER", "B2BROUTER_API_KEY", "IOPOLE_API_KEY"):
        os.environ.pop(k, None)
    ca = get_pdp_connector({"pdp_provider": "b2brouter"})
    cb = get_pdp_connector({"pdp_provider": "iopole"})
    cc = get_pdp_connector({"pdp_provider": "pennylane"})
    cd = get_pdp_connector(None)
    check("client on b2brouter → b2brouter connector", ca.provider == "b2brouter", ca.provider)
    check("client on iopole → iopole connector", cb.provider == "iopole", cb.provider)
    check("client on pennylane → pennylane connector", cc.provider == "pennylane", cc.provider)
    check("no PA set → default (mock)", cd.provider == "mock", cd.provider)
    check("different clients get different connectors", ca is not cb and cb is not cc)
    check("same provider is cached (same instance)",
          get_pdp_connector({"pdp_provider": "iopole"}) is cb)
    reset_pdp_connector()
    check("reset clears the cache",
          get_pdp_connector({"pdp_provider": "iopole"}) is not cb)


def test_end_to_end_routing(db):
    print("\nMulti-PA — send for each client goes through ITS platform, isolated")
    r1 = F.create_invoice(payload(send=True), token_data=owner("t1"))["invoice"]
    r2 = F.create_invoice(payload(send=True), token_data=owner("t2"))["invoice"]
    check("client A invoice transmitted", r1["pa_status"] == InvoiceState.SENT)
    check("client B invoice transmitted", r2["pa_status"] == InvoiceState.SENT)

    conn1 = get_pdp_connector(db.tenants.find_one({"id": "t1"}))
    conn2 = get_pdp_connector(db.tenants.find_one({"id": "t2"}))
    check("A routed to b2brouter", conn1.provider == "b2brouter")
    check("B routed to iopole", conn2.provider == "iopole")
    check("the two PAs are separate connectors", conn1 is not conn2)
    # isolation: each mock PA only holds its own client's invoice
    check("A's invoice lives only in A's PA",
          r1["pdp_invoice_id"] in conn1._invoices and r1["pdp_invoice_id"] not in conn2._invoices)
    check("B's invoice lives only in B's PA",
          r2["pdp_invoice_id"] in conn2._invoices and r2["pdp_invoice_id"] not in conn1._invoices)


def test_set_pa(db):
    print("\nMulti-PA — choose/set a client's platform")
    prov = F.pa_providers()["providers"]
    check("provider list exposed", "b2brouter" in prov and "iopole" in prov, prov)
    out = F.set_pa({"pdp_provider": "pennylane"}, token_data=owner("t3"))
    check("PA set for the dossier", out["pa_provider"] == "pennylane")
    check("stored on the tenant",
          db.tenants.find_one({"id": "t3"})["pdp_provider"] == "pennylane")
    # now t3 routes to pennylane
    check("t3 now routes to pennylane",
          get_pdp_connector(db.tenants.find_one({"id": "t3"})).provider == "pennylane")
    expect_status("unknown platform refused (422)", 422,
                  lambda: F.set_pa({"pdp_provider": "banque-magique"}, token_data=owner("t3")))


if __name__ == "__main__":
    test_router()
    db = build(); test_end_to_end_routing(db)
    db = build(); test_set_pa(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
