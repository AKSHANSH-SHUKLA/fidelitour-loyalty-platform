"""
Tests — ticket numérique (B2C e-receipt) + Bouclier cash-sales signature.

Run:  cd api && python3 tests/test_receipts_cash.py

WHY THESE MATTER
    Ticket numérique: the receipt math must reconcile (TTC = HT + TVA), delivery
    is best-effort (a dead mailer must never lose the receipt), and it rides the
    SAME rail as offers (email + push) — no new infrastructure.
    Cash signature: undeclared cash sales show up as purchases implausibly close
    to declared sales. The check must fire on that pattern, stay quiet on a
    healthy ratio, count e-reported B2C sales as declared sales, and stay an
    INFORMATIVE amber (never an accusation, never red).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.facturation as F
import features.receipts as R
import features.cabinet as C
import features.audit as A
from services import mailer

PASS, FAIL = [], []
SENT = []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗'} {name}{('  → ' + str(extra)) if extra and not cond else ''}")


def expect_status(name, code, fn):
    try:
        fn()
        check(name, False, f"no error raised (expected {code})")
    except Exception as e:
        check(name, getattr(e, "status_code", None) == code, e)


def owner(tid="t1"):
    return SimpleNamespace(email="owner@shop.fr", role="business_owner", tenant_id=tid)


def fake_post(payload, key):
    SENT.append(payload)
    return {"messageId": f"m{len(SENT)}"}


def build():
    db = mongomock.MongoClient().db
    for mod in (F, R, C, A):
        mod.init(db)
    os.environ["BREVO_API_KEY"] = "test-key-not-real"
    mailer._post = fake_post
    db.tenants.insert_one({"id": "t1", "name": "L'Atelier du Boucher",
                           "legal_name": "L'Atelier du Boucher SARL",
                           "facturation_enabled": True, "dgfip_activated": True})
    db.customers.insert_one({"id": "c1", "tenant_id": "t1",
                             "email": "client@perso.fr", "first_name": "Marie"})
    return db


def sale(db, ttc, tid="t1"):
    db.fact_invoices.insert_one({"id": os.urandom(6).hex(), "tenant_id": tid,
                                 "total_ttc": ttc, "pa_status": "sent",
                                 "review_status": "validated", "buyer": {"is_company": True}})


def purchase(db, ttc, tid="t1"):
    db.fact_received_invoices.insert_one({"id": os.urandom(6).hex(), "tenant_id": tid,
                                          "total_ttc": ttc, "state": "accepted"})


def test_receipts(db):
    print("\nTicket numérique — création + envoi (email + push rail)")
    out = R.create_receipt({"amount_ttc": 24.0, "vat_rate": 20,
                            "label": "Côte de bœuf", "customer_id": "c1"},
                           token_data=owner())
    rec = out["receipt"]
    check("receipt created with number", rec["number"].startswith("TKT-"))
    check("math reconciles (24 TTC → 20 HT + 4 TVA)",
          rec["total_ht"] == 20.0 and rec["total_vat"] == 4.0, rec)
    check("email delivered on the offers rail", rec["delivery"]["email"] is True)
    check("email went to the loyalty customer", SENT[-1]["to"][0]["email"] == "client@perso.fr")
    check("receipt HTML names the shop and total",
          "L'Atelier du Boucher" in SENT[-1]["htmlContent"] and "24.00" in SENT[-1]["htmlContent"])
    check("audited", A._db.audit_log.count_documents({"action": "receipt.sent"}) == 1)

    # explicit email, no customer
    out2 = R.create_receipt({"amount_ttc": 10, "email": "passant@ex.fr"}, token_data=owner())
    check("works with a plain email (no loyalty account)",
          out2["receipt"]["delivery"]["email"] is True)

    # mailer dead → receipt still stored, delivery False, no crash
    os.environ.pop("BREVO_API_KEY", None)
    out3 = R.create_receipt({"amount_ttc": 5, "email": "x@y.fr"}, token_data=owner())
    check("dead mailer never loses the receipt",
          out3["ok"] and out3["receipt"]["delivery"]["email"] is False)
    os.environ["BREVO_API_KEY"] = "test-key-not-real"

    expect_status("zero amount refused (422)", 422,
                  lambda: R.create_receipt({"amount_ttc": 0}, token_data=owner()))
    check("list returns receipts (newest first)",
          len(R.list_receipts(token_data=owner())["receipts"]) == 3)


def test_cash_signature():
    print("\nBouclier — signature « ventes en espèces non déclarées »")
    db = build()
    t = db.tenants.find_one({"id": "t1"})

    # healthy: purchases 30% of sales → no alert
    sale(db, 1000); purchase(db, 300)
    b = F.compute_bouclier(t)
    check("healthy ratio (30 %) → no cash alert",
          not any("espèces" in a["message"] for a in b["alerts"]), b["alerts"])

    # suspicious: purchases ~95% of declared sales → amber alert
    db2 = build()
    t2 = db2.tenants.find_one({"id": "t1"})
    sale(db2, 1000); purchase(db2, 950)
    b2 = F.compute_bouclier(t2)
    cash = [a for a in b2["alerts"] if "espèces" in a["message"]]
    check("implausible ratio (95 %) → amber alert fires", len(cash) == 1, b2["alerts"])
    check("alert is INFORMATIVE amber, never red", cash and cash[0]["level"] == "amber")
    check("score penalised (-12)", any(x["points"] == -12 for x in b2["breakdown"]))
    check("ratio shown in the message (95 %)", cash and "95 %" in cash[0]["message"],
          cash and cash[0]["message"])

    # e-reported B2C sales COUNT as declared sales (no false alarm)
    db3 = build()
    t3 = db3.tenants.find_one({"id": "t1"})
    purchase(db3, 900)                       # purchases 900
    sale(db3, 200)                           # tiny B2B sales
    db3.fact_ereports.insert_one({"tenant_id": "t1",
                                  "totals_by_vat": {"20": 2800}})  # big declared B2C
    b3 = F.compute_bouclier(t3)
    check("e-reported B2C sales count as declared (900/3000 → quiet)",
          not any("espèces" in a["message"] for a in b3["alerts"]), b3["alerts"])

    # per-dossier threshold override
    db4 = build()
    t4 = db4.tenants.find_one({"id": "t1"})
    db4.tenants.update_one({"id": "t1"}, {"$set": {"achats_ventes_seuil": 0.5}})
    t4 = db4.tenants.find_one({"id": "t1"})
    sale(db4, 1000); purchase(db4, 600)      # 60% > custom 50% threshold
    b4 = F.compute_bouclier(t4)
    check("threshold is per-dossier adjustable (0.5 → fires at 60 %)",
          any("espèces" in a["message"] for a in b4["alerts"]), b4["alerts"])


if __name__ == "__main__":
    db = build()
    test_receipts(db)
    test_cash_signature()
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
