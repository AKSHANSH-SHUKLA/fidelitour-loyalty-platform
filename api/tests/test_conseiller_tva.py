"""
Tests — La Mémoire + Le Conseiller (Chapter 8) and the TVA/CA3 agent.

Run:  cd api && python3 tests/test_conseiller_tva.py

WHY THESE MATTER
    Conseiller: detection must be DETERMINISTIC (rule-based) so the same books
    always raise the same advisory — the LLM only phrases it, and a missing model
    must fall back to a template, never crash. A conseil is a draft for a human,
    deduped so the agent doesn't nag. It reads La Mémoire so advice respects
    what the cabinet already knows.
    TVA: collectée counts ONLY validated sales, déductible ONLY accepted
    purchases, both inside the period — the same books discipline as the FEC.
    The agent drafts; it never télédéclare.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.conseiller as CONS
import features.agent_tva as TVA
import features.audit as A
from services import llm

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
TODAY = date.today()


def _iso(days):
    return (TODAY + timedelta(days=days)).isoformat()


def sale(db, tid, dt, ht, rate=20, review="validated", pay="unpaid", due=None):
    vat = round(ht * rate / 100.0, 2)
    db.fact_invoices.insert_one({
        "id": os.urandom(6).hex(), "tenant_id": tid,
        "date": dt, "due_date": due or dt,
        "review_status": review, "payment_status": pay,
        "total_ht": ht, "total_vat": vat, "total_ttc": round(ht + vat, 2),
        "lines": [{"vat_rate": rate, "line_total_ht": ht,
                   "quantity": 1, "unit_price": ht}]})


def purchase(db, tid, dt, ht, rate=20, state="accepted"):
    vat = round(ht * rate / 100.0, 2)
    db.fact_received_invoices.insert_one({
        "id": os.urandom(6).hex(), "tenant_id": tid, "date": dt,
        "state": state, "total_ht": ht, "total_vat": vat,
        "total_ttc": round(ht + vat, 2)})


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, CONS, TVA, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    cab = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Boulangerie Petit",
                           "name": "Boulangerie Petit", "facturation_enabled": True})
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab, "tenant_id": "t1",
                                 "status": "active"})
    return db, cab


# --------------------------------------------------------------------------
def test_memoire(db):
    r = tok("rousseau@cab.fr")
    print("\nLa Mémoire — persist what lives in a collaborateur's head")
    n = CONS.add_memory("t1", {"text": "Le gérant préfère WhatsApp", "kind": "preference"},
                        token_data=r)
    check("note stored", n["ok"] and n["note"]["kind"] == "preference")
    CONS.add_memory("t1", {"text": "Clôture décalée au 30/06", "kind": "deadline"}, token_data=r)
    check("both notes listed", len(CONS.list_memory("t1", token_data=r)["notes"]) == 2)
    expect_status("empty note refused", 422,
                  lambda: CONS.add_memory("t1", {"text": "  "}, token_data=r))
    bad = CONS.add_memory("t1", {"text": "x", "kind": "nonsense"}, token_data=r)
    check("unknown kind normalised to 'fact'", bad["note"]["kind"] == "fact")


# --------------------------------------------------------------------------
def test_conseiller(db, cab):
    r = tok("rousseau@cab.fr")
    llm._force_complete = lambda s, u: None            # force template phrasing

    print("\nLe Conseiller — cash-flow signal from overdue unpaid invoices")
    sale(db, "t1", _iso(-5), 1000, due=_iso(-3))        # validated, unpaid, overdue
    sale(db, "t1", _iso(-4), 2000, due=_iso(-2))        # ditto
    sale(db, "t1", _iso(-3), 500, pay="paid", due=_iso(-1))  # paid → ignored
    out = CONS.run_conseiller("t1", token_data=r)
    check("cash-flow conseil created", out["conseils_created"] >= 1, out)
    cons = CONS.list_conseils("t1", token_data=r)["conseils"]
    cf = next((c for c in cons if c["type"] == "cashflow"), None)
    check("cashflow conseil present", cf is not None)
    check("evidence counts the 2 overdue (not the paid one)",
          cf and cf["evidence"]["overdue_count"] == 2, cf)
    check("conseil is a draft (status open)", cf and cf["status"] == "open")
    check("phrased via template fallback names the overdue amount (3600 TTC)",
          cf and "3600" in cf["message"] and cf["evidence"]["overdue_ttc"] == 3600.0,
          (cf or {}).get("message"))
    check("conseil created under the agent identity",
          A._db.audit_log.find_one({"action": "agent.conseil_created"}) is not None)

    print("\nLe Conseiller — dedupe: a second run doesn't nag")
    out2 = CONS.run_conseiller("t1", token_data=r)
    check("no duplicate cashflow conseil", all(
        CONS._db.conseils.count_documents({"tenant_id": "t1", "type": "cashflow",
                                           "status": "open"}) == 1 for _ in [0]), out2)

    print("\nLe Conseiller — LLM phrasing is used when available")
    db2, cab2 = build()
    sale(db2, "t1", _iso(-5), 1000, due=_iso(-3))
    sale(db2, "t1", _iso(-4), 1000, due=_iso(-2))
    llm._force_complete = lambda s, u: "Note LLM: relancer le client."
    CONS.run_conseiller("t1", token_data=r)
    cf2 = next(c for c in CONS.list_conseils("t1", token_data=r)["conseils"]
               if c["type"] == "cashflow")
    check("message comes from the LLM when configured", cf2["message"] == "Note LLM: relancer le client.")

    print("\nLe Conseiller — dismiss")
    ok = CONS.dismiss_conseil(cf2["id"], token_data=r)
    check("conseil dismissed", ok["ok"] is True)
    check("dismissed status persisted",
          CONS._db.conseils.find_one({"id": cf2["id"]})["status"] == "dismissed")
    llm._force_complete = None


def test_conseiller_growth_dormant():
    r = tok("rousseau@cab.fr")
    llm._force_complete = lambda s, u: None

    print("\nLe Conseiller — growth signal (90j vs previous 90j, +30%)")
    db, cab = build()
    sale(db, "t1", _iso(-120), 1000)                   # previous window
    sale(db, "t1", _iso(-30), 2000)                    # current window (+100%)
    out = CONS.run_conseiller("t1", token_data=r)
    types = {c["type"] for c in CONS.list_conseils("t1", token_data=r)["conseils"]}
    check("growth conseil raised", "growth" in types, types)

    print("\nLe Conseiller — dormant signal (nothing for 60+ days)")
    db, cab = build()
    sale(db, "t1", _iso(-90), 1000, pay="paid")        # last activity 90 days ago
    CONS.run_conseiller("t1", token_data=r)
    types = {c["type"] for c in CONS.list_conseils("t1", token_data=r)["conseils"]}
    check("dormant conseil raised", "dormant" in types, types)
    llm._force_complete = None


# --------------------------------------------------------------------------
def test_tva(db, cab):
    r = tok("rousseau@cab.fr")
    print("\nTVA/CA3 — collectée (validated sales) − déductible (accepted purchases)")
    sale(db, "t1", "2026-07-05", 1000, rate=20)        # collectée 200
    sale(db, "t1", "2026-07-20", 500, rate=10)         # collectée 50
    sale(db, "t1", "2026-07-25", 800, rate=20, review="unreviewed")  # excluded (draft)
    sale(db, "t1", "2026-08-05", 400, rate=20)         # out of period → excluded
    purchase(db, "t1", "2026-07-10", 600, rate=20)     # déductible 120
    purchase(db, "t1", "2026-07-15", 300, rate=20, state="received")  # not accepted → excluded

    ca3 = TVA.compute_ca3("t1", "2026-07-01", "2026-07-31")
    check("collectée = 200 + 50 = 250 (draft & out-of-period excluded)",
          ca3["tva_collectee"] == 250.0, ca3["tva_collectee"])
    check("déductible = 120 (unaccepted excluded)", ca3["tva_deductible"] == 120.0,
          ca3["tva_deductible"])
    check("nette = 250 − 120 = 130 à payer", ca3["tva_nette"] == 130.0 and ca3["sens"] == "a_payer")
    check("per-rate breakdown has 20% and 10%",
          set(ca3["collectee_par_taux"].keys()) == {"20", "10"}, ca3["collectee_par_taux"])

    print("\nTVA/CA3 — credit case (déductible > collectée)")
    db2, _ = build()
    sale(db2, "t1", "2026-07-05", 100, rate=20)        # collectée 20
    purchase(db2, "t1", "2026-07-06", 1000, rate=20)   # déductible 200
    ca3c = TVA.compute_ca3("t1", "2026-07-01", "2026-07-31")
    check("credit sens when déductible wins", ca3c["sens"] == "credit"
          and ca3c["credit_a_reporter"] == 180.0, ca3c)

    print("\nTVA/CA3 — the agent drafts, audited, never files")
    run = TVA.run_tva("t1", {"period_start": "2026-07-01", "period_end": "2026-07-31"},
                      token_data=r)
    check("declaration stored as draft", run["declaration"]["status"] == "draft")
    check("drafted by the agent identity", "@agent.fidclic" in run["declaration"]["created_by"])
    check("draft is audited as agent",
          A._db.audit_log.find_one({"action": "agent.tva_drafted"}) is not None)
    check("declaration listed", len(TVA.list_tva("t1", token_data=r)["declarations"]) == 1)
    expect_status("missing period → 422", 422,
                  lambda: TVA.run_tva("t1", {}, token_data=r))
    expect_status("end before start → 422", 422,
                  lambda: TVA.run_tva("t1", {"period_start": "2026-07-31",
                                             "period_end": "2026-07-01"}, token_data=r))


if __name__ == "__main__":
    db, cab = build()
    test_memoire(db)
    test_conseiller(db, cab)
    test_conseiller_growth_dormant()
    db, cab = build()
    test_tva(db, cab)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
