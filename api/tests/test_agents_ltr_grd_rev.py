"""
Tests — Le Lettrage (rapprochement), Le Gardien (anomalies), Le Réviseur (revue).

Run:  cd api && python3 tests/test_agents_ltr_grd_rev.py

WHY THESE MATTER
    Lettrage : l'agent PROPOSE un rapprochement ; seul un HUMAIN valide et fait
      passer la facture « payée ». L'agent est refusé (403). Le matcher doit
      relier le bon encaissement à la bonne facture (montant + référence).
    Gardien : détection DÉTERMINISTE d'anomalies (rejet PA, SIREN manquant,
      numéro en double, impayé ancien, TVA inhabituelle, saisie manquante),
      dédupliquée pour ne pas répéter.
    Réviseur : check-list de conformité par facture, verdict prêt/à corriger ;
      il prépare la revue, il ne valide jamais.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.agent_lettrage as LT
import features.agent_gardien as GD
import features.agent_reviseur as RV
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


def tok(email, role="comptable", tenant_id=None):
    return SimpleNamespace(email=email, role=role, tenant_id=tenant_id)


PW = "Cabinet-Test2026!"
TODAY = date.today()


def inv(db, **f):
    base = {"id": os.urandom(6).hex(), "tenant_id": "t1", "number": "FAC-1",
            "date": TODAY.isoformat(), "due_date": TODAY.isoformat(),
            "review_status": "validated", "payment_status": "unpaid",
            "pa_status": "sent", "total_ht": 100.0, "total_vat": 20.0, "total_ttc": 120.0,
            "buyer": {"name": "Client Pro SARL", "is_company": True,
                      "siren": "552100554", "address": "1 rue de la Paix, Paris"},
            "lines": [{"vat_rate": 20, "line_total_ht": 100.0, "quantity": 1, "unit_price": 100.0}]}
    base.update(f)
    db.fact_invoices.insert_one(dict(base))
    return base


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, LT, GD, RV, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    r = tok("rousseau@cab.fr")
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=r)
    CO.create_member({"email": "tom@cab.fr", "role": "assistant",
                      "password": PW, "full_name": "Tom"}, token_data=r)
    cab = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    lea_mid = CO._db.cabinet_memberships.find_one({"user_email": "lea@cab.fr"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Boulangerie Petit",
                           "name": "Boulangerie Petit", "facturation_enabled": True})
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab, "tenant_id": "t1",
                                 "status": "active", "assignee_membership_id": lea_mid})
    return db, cab


# --------------------------------------------------------------------------
def test_lettrage(db):
    r = tok("rousseau@cab.fr")
    print("\nLe Lettrage — matcher & validation humaine")
    v = inv(db, number="FAC-100", total_ttc=120.0)           # validated, unpaid
    inv(db, number="FAC-200", total_ttc=999.0)               # no matching txn
    LT.seed_transactions("t1", {"transactions": [
        {"amount": 120.0, "label": "VIR Client Pro", "reference": "FAC-100"},
        {"amount": 55.0, "label": "VIR inconnu", "reference": "XX"}]}, token_data=r)

    out = LT.run_lettrage("t1", token_data=r)
    check("one match proposed (120 ↔ FAC-100)", out["matches_proposed"] == 1, out)
    matches = LT.list_matches("t1", token_data=r)["matches"]
    mt = matches[0]
    check("match points to FAC-100", mt["invoice_number"] == "FAC-100")
    check("high confidence (montant + référence)", mt["confidence"] == 0.95, mt["confidence"])
    check("proposed by the agent", "@agent.fidclic" in mt["proposed_by"])
    check("proposal audited as agent",
          A._db.audit_log.find_one({"action": "agent.lettrage_proposed"}) is not None)

    print("\nLe Lettrage — only a human validates → invoice becomes paid")
    agent_email = CO.agent_email_for(mt["cabinet_id"])
    expect_status("agent refused (403)", 403,
                  lambda: LT.validate_match(mt["id"], token_data=tok(agent_email)))
    expect_status("assistant refused (403)", 403,
                  lambda: LT.validate_match(mt["id"], token_data=tok("tom@cab.fr")))
    ok = LT.validate_match(mt["id"], token_data=tok("lea@cab.fr"))
    check("human validated → payment_status paid", ok["payment_status"] == "paid")
    check("invoice actually marked paid",
          db.fact_invoices.find_one({"id": v["id"]})["payment_status"] == "paid")
    check("bank transaction marked matched",
          db.bank_transactions.find_one({"reference": "FAC-100"})["matched"] is True)
    expect_status("cannot validate twice (409)", 409,
                  lambda: LT.validate_match(mt["id"], token_data=tok("lea@cab.fr")))


# --------------------------------------------------------------------------
def test_gardien(db):
    r = tok("rousseau@cab.fr")
    print("\nLe Gardien — anomaly detection (deterministic)")
    inv(db, number="R-1", pa_status="refused")                       # facture_rejetee
    inv(db, number="S-1", buyer={"name": "X", "is_company": True, "siren": "", "address": "a"})  # siren_manquant
    inv(db, number="DUP")                                            # numero_double (x2)
    inv(db, number="DUP")
    inv(db, number="O-1", due_date=(TODAY - timedelta(days=90)).isoformat(),
        payment_status="unpaid")                                     # impaye_ancien
    inv(db, number="T-1", lines=[{"vat_rate": 15, "line_total_ht": 100.0,
                                  "quantity": 1, "unit_price": 100.0}])  # tva_inhabituelle
    db.fact_received_invoices.insert_one({"id": "rec1", "tenant_id": "t1", "source": "ocr",
                                          "saisie_status": "pending",
                                          "supplier": {"name": "Metro"}})  # saisie_manquante

    out = GD.run_gardien("t1", token_data=r)
    types = {f["type"] for f in GD.list_findings("t1", token_data=r)["findings"]}
    for t in ["facture_rejetee", "siren_manquant", "numero_double", "impaye_ancien",
              "tva_inhabituelle", "saisie_manquante"]:
        check(f"detected: {t}", t in types, types)
    check("findings created (agent)", out["findings_created"] >= 6, out)
    check("findings audited as agent",
          A._db.audit_log.find_one({"action": "agent.gardien_finding"}) is not None)

    print("\nLe Gardien — dedupe: second run adds nothing new")
    out2 = GD.run_gardien("t1", token_data=r)
    check("no new findings on re-run", out2["findings_created"] == 0, out2)

    print("\nLe Gardien — resolve")
    fid = GD.list_findings("t1", token_data=r)["findings"][0]["id"]
    GD.resolve_finding(fid, token_data=r)
    check("finding resolved",
          GD._db.gardien_findings.find_one({"id": fid})["status"] == "resolved")


# --------------------------------------------------------------------------
def test_reviseur(db):
    r = tok("rousseau@cab.fr")
    print("\nLe Réviseur — per-invoice checklist & verdict")
    inv(db, number="OK-1", review_status="unreviewed")               # complete → prêt
    inv(db, number="BAD-1", review_status="unreviewed",
        buyer={"name": "Y", "is_company": True, "siren": "", "address": ""})  # à corriger
    inv(db, number="DONE-1", review_status="validated")              # excluded (already validated)

    out = RV.run_revision("t1", token_data=r)
    rep = out["report"]
    check("only non-validated invoices reviewed (2)", rep["reviewed"] == 2, rep["reviewed"])
    check("one ready, one to fix", rep["ready"] == 1 and rep["to_fix"] == 1, rep)
    ok_item = next(i for i in rep["items"] if i["number"] == "OK-1")
    bad_item = next(i for i in rep["items"] if i["number"] == "BAD-1")
    check("complete invoice → prêt à valider", ok_item["verdict"] == "pret_a_valider")
    check("incomplete invoice → à corriger", bad_item["verdict"] == "a_corriger")
    check("failing check named (SIREN)",
          any(("SIREN" in c["label"]) and not c["ok"] for c in bad_item["checks"]))
    check("revision audited as agent",
          A._db.audit_log.find_one({"action": "agent.revision_run"}) is not None)
    check("report retrievable", len(RV.list_reports("t1", token_data=r)["reports"]) == 1)


if __name__ == "__main__":
    db, cab = build(); test_lettrage(db)
    db, cab = build(); test_gardien(db)
    db, cab = build(); test_reviseur(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
