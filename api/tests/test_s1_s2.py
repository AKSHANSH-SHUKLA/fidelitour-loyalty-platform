"""
Automated tests for S1 (4-status families) and S2 (audit log + tenant isolation).

Run:  cd api && python3 tests/test_s1_s2.py
Uses mongomock, so it needs NO database and NO network — safe in CI and safe to
run before every deploy.

WHY THESE TESTS EXIST
    S1 and S2 are the foundation every later Zone stands on. A silent break here
    (a status field that stops updating, a mandate check that stops blocking)
    would corrupt data for months before anyone noticed. These tests are the
    tripwire.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

from services import statuses as st
from services.statuses import ReviewStatus, PaymentStatus, ExportStatus
import features.facturation as F
import features.cabinet as C
import features.audit as A

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗'} {name}{('  → ' + str(extra)) if extra and not cond else ''}")


def fresh_db():
    """A clean in-memory DB with two tenants, two accountants, one invoice."""
    db = mongomock.MongoClient().db
    db.tenants.insert_many([
        {"id": "t1", "name": "ISIS", "legal_name": "Café Lumière SARL",
         "facturation_enabled": True, "siren": "123456789", "dgfip_activated": True},
        {"id": "t2", "name": "Autre", "legal_name": "Autre SARL",
         "facturation_enabled": True, "siren": "987654321", "dgfip_activated": True},
    ])
    # cabinet A has t1, cabinet B has t2 — the isolation fixture
    db.cabinet_links.insert_many([
        {"id": "l1", "comptable_email": "a@cab.fr", "tenant_id": "t1", "status": "active"},
        {"id": "l2", "comptable_email": "b@cab.fr", "tenant_id": "t2", "status": "active"},
        {"id": "l3", "comptable_email": "old@cab.fr", "tenant_id": "t1", "status": "revoked"},
    ])
    F.init(db); C.init(db); A.init(db)
    return db


OWNER = SimpleNamespace(tenant_id="t1", role="business_owner", email="owner@isis.fr")
CAB_A = SimpleNamespace(tenant_id=None, role="comptable", email="a@cab.fr")
CAB_B = SimpleNamespace(tenant_id=None, role="comptable", email="b@cab.fr")
CAB_OLD = SimpleNamespace(tenant_id=None, role="comptable", email="old@cab.fr")


def make_invoice(db, send=False, simulate=None):
    r = F.create_invoice({
        "buyer": {"name": "Client SARL", "is_company": True, "siren": "111222333"},
        "lines": [{"label": "Prestation", "quantity": 1, "unit_price": 1000, "vat_rate": 20}],
        "send": send, "simulate": simulate,
    }, token_data=OWNER)
    return r["invoice"]


# ==========================================================================
# S1 — four independent status families
# ==========================================================================

def test_s1(db):
    print("\nS1 — 4 status families")

    inv = make_invoice(db)
    check("new invoice has all 4 families",
          all(k in inv for k in ("pa_status", "review_status", "payment_status", "export_status")), inv.keys())
    check("defaults are correct",
          (inv["pa_status"], inv["review_status"], inv["payment_status"], inv["export_status"])
          == ("draft", ReviewStatus.UNREVIEWED, PaymentStatus.UNPAID, ExportStatus.NOT_READY))

    # THE key scenario: a REFUSED invoice can still be reviewed & validated.
    ref = F.create_invoice({
        "buyer": {"name": "byblos", "is_company": True},
        "lines": [{"label": "x", "quantity": 1, "unit_price": 2500, "vat_rate": 20}],
        "send": True, "simulate": "reject",
    }, token_data=OWNER)["invoice"]
    check("simulated reject sets pa_status=refused", ref["pa_status"] == "refused", ref["pa_status"])

    out = F.set_review_status(ref["id"], {"target": ReviewStatus.VALIDATED,
                                          "account_code": "706000"}, token_data=OWNER)["invoice"]
    check("refused invoice CAN be validated (impossible before S1)",
          out["review_status"] == ReviewStatus.VALIDATED and out["pa_status"] == "refused")
    check("validation makes it export-ready", out["export_status"] == ExportStatus.READY)

    out = F.set_payment_status(ref["id"], {"status": PaymentStatus.PARTIALLY_PAID,
                                           "amount_paid": 1200}, token_data=OWNER)["invoice"]
    check("payment status independent of pa/review",
          out["payment_status"] == PaymentStatus.PARTIALLY_PAID
          and out["review_status"] == ReviewStatus.VALIDATED
          and out["pa_status"] == "refused", out)
    check("partial amount stored", out.get("amount_paid") == 1200)

    # un-validating pulls export back, but never un-exports a sent entry
    db.fact_invoices.update_one({"id": ref["id"]}, {"$set": {"export_status": ExportStatus.EXPORTED}})
    F.set_review_status(ref["id"], {"target": ReviewStatus.CORRECTION_REQUIRED}, token_data=OWNER)
    after = db.fact_invoices.find_one({"id": ref["id"]})
    check("already-exported entry is never downgraded", after["export_status"] == ExportStatus.EXPORTED)

    # illegal transition is rejected
    try:
        F.set_review_status(inv["id"], {"target": "nonsense"}, token_data=OWNER)
        check("illegal review transition rejected", False, "no exception raised")
    except Exception as e:
        check("illegal review transition rejected", getattr(e, "status_code", None) == 409)

    # two-step review enforcement
    db.tenants.update_one({"id": "t1"}, {"$set": {"require_two_step_review": True}})
    inv2 = make_invoice(db)
    try:
        F.set_review_status(inv2["id"], {"target": ReviewStatus.VALIDATED}, token_data=OWNER)
        check("two-step mode blocks direct validation", False, "no exception")
    except Exception as e:
        check("two-step mode blocks direct validation", getattr(e, "status_code", None) == 409)
    F.set_review_status(inv2["id"], {"target": ReviewStatus.PENDING_VALIDATION}, token_data=OWNER)
    ok = F.set_review_status(inv2["id"], {"target": ReviewStatus.VALIDATED}, token_data=OWNER)["invoice"]
    check("two-step mode allows propose→validate", ok["review_status"] == ReviewStatus.VALIDATED)
    db.tenants.update_one({"id": "t1"}, {"$set": {"require_two_step_review": False}})

    # legacy rows (only `state`) get backfilled on read
    db.fact_invoices.insert_one({"id": "legacy1", "tenant_id": "t1", "number": "OLD-1",
                                 "state": "paid", "total_ttc": 100, "buyer": {"name": "x"}})
    legacy = st.ensure(db.fact_invoices.find_one({"id": "legacy1"}))
    check("legacy row backfills pa_status from state", legacy["pa_status"] == "paid")
    check("legacy 'paid' also implies payment_status", legacy["payment_status"] == PaymentStatus.PAID)
    check("legacy row defaults review to unreviewed", legacy["review_status"] == ReviewStatus.UNREVIEWED)

    # bouclier now reads pa_status and exposes workload counters
    b = F.compute_bouclier(db.tenants.find_one({"id": "t1"}))
    check("bouclier counts refused via pa_status", b["counts"]["refused"] >= 1, b["counts"])
    check("bouclier exposes unreviewed counter", "unreviewed" in b["counts"])
    check("bouclier exposes ready_to_export counter", "ready_to_export" in b["counts"])


# ==========================================================================
# S2 — tenant isolation
# ==========================================================================

def test_isolation(db):
    print("\nS2 — tenant isolation (the 5 mandated cases)")

    def expect_403(label, fn):
        try:
            fn()
            check(label, False, "NO 403 — LEAK!")
        except Exception as e:
            check(label, getattr(e, "status_code", None) == 403, e)

    # 1. cabinet A cannot read cabinet B's client
    expect_403("1. accountant A blocked from tenant t2",
               lambda: C.cabinet_client_detail("t2", token_data=CAB_A))
    # 2. and vice-versa
    expect_403("2. accountant B blocked from tenant t1",
               lambda: C.cabinet_client_detail("t1", token_data=CAB_B))
    # 3. revoked mandate = no access
    expect_403("3. revoked mandate blocked",
               lambda: C.cabinet_client_detail("t1", token_data=CAB_OLD))
    # 4. own client works (positive control — isolation must not over-block)
    ok = C.cabinet_client_detail("t1", token_data=CAB_A)
    check("4. accountant A CAN read own client t1", ok["summary"]["tenant_id"] == "t1")
    # 5. portfolio listing only returns mandated tenants
    lst = C.cabinet_clients(token_data=CAB_A)
    check("5. portfolio lists only mandated tenants",
          [c["tenant_id"] for c in lst["clients"]] == ["t1"], lst["clients"])
    # 6. cross-tenant write via the invoice endpoints is blocked too
    other = F.create_invoice({
        "buyer": {"name": "y", "is_company": True},
        "lines": [{"label": "y", "quantity": 1, "unit_price": 50, "vat_rate": 20}],
    }, token_data=SimpleNamespace(tenant_id="t2", role="business_owner", email="o2@x.fr"))["invoice"]
    expect_403("6. accountant A cannot review an invoice of t2",
               lambda: F.set_review_status(other["id"], {"target": ReviewStatus.VALIDATED},
                                           token_data=CAB_A))
    # 7. accountant CAN review their own client's invoice
    mine = make_invoice(db)
    r = F.set_review_status(mine["id"], {"target": ReviewStatus.VALIDATED}, token_data=CAB_A)
    check("7. accountant CAN review own client's invoice",
          r["invoice"]["review_status"] == ReviewStatus.VALIDATED)
    # 8. export honours mandates
    csv_body = C.cabinet_export(token_data=CAB_A).body.decode()
    check("8. export contains only mandated client", "Autre SARL" not in csv_body)


# ==========================================================================
# S2 — audit log
# ==========================================================================

def test_audit(db):
    print("\nS2 — audit log")

    before = db.audit_log.count_documents({})
    inv = make_invoice(db, send=True)
    F.set_review_status(inv["id"], {"target": ReviewStatus.VALIDATED}, token_data=CAB_A)
    F.set_payment_status(inv["id"], {"status": PaymentStatus.PAID}, token_data=OWNER)
    F.create_credit_note(inv["id"], {"reason": "test"}, token_data=OWNER)
    after = db.audit_log.count_documents({})
    check("actions produce audit entries", after > before, f"{before}→{after}")

    actions = {d["action"] for d in db.audit_log.find({})}
    for a in ("invoice.sent", "invoice.review_changed", "invoice.payment_changed",
              "credit_note.created"):
        check(f"logged: {a}", a in actions, actions)

    # the review just done above was performed by accountant A on THIS invoice
    entry = db.audit_log.find_one({"action": "invoice.review_changed",
                                   "object.id": inv["id"]})
    check("audit records the actor", entry.get("actor_email") == "a@cab.fr", entry.get("actor_email"))
    check("audit records before/after", entry.get("before") and entry.get("after"))
    check("audit is tenant-scoped", entry.get("tenant_id") == "t1")

    # owner sees only their own tenant's history
    own = A.owner_audit(token_data=OWNER)
    check("owner audit scoped to own tenant",
          all(e["tenant_id"] == "t1" for e in own["entries"]), own["entries"][:1])

    # accountant audit is mandate-scoped, and a foreign tenant_id is refused
    cab = A.cabinet_audit(token_data=CAB_A)
    check("accountant audit returns entries", len(cab["entries"]) > 0)
    try:
        A.cabinet_audit(tenant_id="t2", token_data=CAB_A)
        check("accountant audit blocks foreign tenant_id", False, "no 403")
    except Exception as e:
        check("accountant audit blocks foreign tenant_id", getattr(e, "status_code", None) == 403)

    # the "who did what" summary that powers the cabinet's live view
    summ = A.activity_summary(token_data=CAB_A)
    check("activity summary groups by actor", len(summ["actors"]) >= 1, summ)
    check("activity summary counts actions",
          summ["actors"][0]["total"] >= 1 and summ["actors"][0]["by_action"])

    # audit never breaks the business action, even if the log write explodes
    orig = A._db
    A._db = None
    try:
        ok_inv = make_invoice(db)
        check("business action survives a dead audit log", bool(ok_inv["id"]))
    finally:
        A._db = orig


if __name__ == "__main__":
    print("=" * 62)
    print("FidClic — S1 + S2 foundation tests")
    print("=" * 62)
    db = fresh_db()
    test_s1(db)
    test_isolation(db)
    test_audit(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
