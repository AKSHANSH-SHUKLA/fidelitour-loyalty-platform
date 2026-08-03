"""
Tests — bulk imports (clients CSV, invoices CSV/FEC, bank CSV/OFX) + PA
reception sync (pull, works for any PA).

Run:  cd api && python3 tests/test_imports.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.facturation as F
import features.fec as FEC
import features.data_import as IMP
import features.audit as A
from services import pdp_connector
from services.pdp_connector import get_pdp_connector, reset_pdp_connector, InvoiceState

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗'} {name}{('  → ' + str(extra)) if extra and not cond else ''}")


def tok(email, role="comptable", tenant_id=None):
    return SimpleNamespace(email=email, role=role, tenant_id=tenant_id)


def owner(tid="t1"):
    return SimpleNamespace(email="owner@cafe.fr", role="business_owner", tenant_id=tid)


PW = "Cabinet-Test2026!"


def build():
    db = mongomock.MongoClient().db
    reset_pdp_connector()
    os.environ.pop("PDP_PROVIDER", None)
    for mod in (CO, C, F, FEC, IMP, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    return db


# valid SIRENs (Luhn-ok): Danone 552100554, Michelin 855200507, Carrefour 652014051
CLIENTS_CSV = """raison sociale,siren,email,pa
Boulangerie Petit,552100554,,b2brouter
Garage Moreau,855200507,,iopole
Pharmacie Blanc,652014051,,
"""


def test_clients(db):
    r = tok("rousseau@cab.fr")
    print("\nImport clients (CSV) — bulk onboarding")
    out = IMP.import_clients({"content": CLIENTS_CSV}, token_data=r)
    check("3 clients created", out["created"] == 3, out)
    check("no errors", out["skipped"] == 0, out.get("errors"))
    check("dossiers exist as tenants", db.tenants.count_documents({}) == 3)
    check("mandates (links) created", db.cabinet_links.count_documents({"status": "active"}) == 3)
    gar = db.tenants.find_one({"siren": "855200507"})
    check("per-client PA tagged from CSV (Garage → iopole)", gar.get("pdp_provider") == "iopole",
          gar.get("pdp_provider"))
    bou = db.tenants.find_one({"siren": "552100554"})
    check("Boulangerie → b2brouter", bou.get("pdp_provider") == "b2brouter")
    # a bad SIREN row is skipped, not fatal
    out2 = IMP.import_clients({"content": "raison sociale,siren\nMauvais,123\n"}, token_data=r)
    check("bad SIREN row skipped with error", out2["created"] == 0 and out2["skipped"] == 1, out2)
    return bou["id"]


def test_invoices_csv(db, tid):
    r = tok("rousseau@cab.fr")
    print("\nImport invoices (CSV) — history → fact_invoices")
    csv_txt = ("number,date,client,client_siren,ht,vat_rate\n"
               "FAC-H1,2026-01-15,Client A,552100554,1000,20\n"
               "FAC-H2,15/02/2026,Client B,,500,10\n")
    out = IMP.import_invoices(tid, {"content": csv_txt}, token_data=r)
    check("2 invoices imported", out["imported"] == 2, out)
    inv = db.fact_invoices.find_one({"number": "FAC-H1", "tenant_id": tid})
    check("HT/VAT/TTC computed (1000 → 200 → 1200)",
          inv["total_ht"] == 1000 and inv["total_vat"] == 200 and inv["total_ttc"] == 1200, inv)
    check("date normalised (DD/MM/YYYY → ISO)",
          db.fact_invoices.find_one({"number": "FAC-H2"})["date"] == "2026-02-15")
    check("imported as validated (visible in FEC/TVA)", inv["review_status"] == "validated")


def test_invoices_fec_roundtrip(db, tid):
    r = tok("rousseau@cab.fr")
    print("\nImport invoices (FEC) — round-trips our own export")
    # build a FEC from an existing validated invoice, then import it into a 2nd dossier
    fec_text = FEC.render_fec(FEC.build_fec_lines(list(db.fact_invoices.find({"tenant_id": tid}))))
    # a fresh dossier to import into
    db.tenants.insert_one({"id": "tfec", "legal_name": "FEC Cible", "facturation_enabled": True})
    db.cabinet_links.insert_one({"id": "lfec", "cabinet_id":
        CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"],
        "tenant_id": "tfec", "status": "active"})
    out = IMP.import_invoices("tfec", {"content": fec_text, "format": "fec"}, token_data=r)
    check("FEC rows reconstructed into invoices", out["imported"] >= 1, out)
    any_inv = db.fact_invoices.find_one({"tenant_id": "tfec"})
    check("reconstructed invoice balances (ttc = ht + vat)",
          abs((any_inv["total_ht"] + any_inv["total_vat"]) - any_inv["total_ttc"]) <= 0.02, any_inv)


def test_bank(db, tid):
    r = tok("rousseau@cab.fr")
    print("\nImport bank (CSV + OFX) — feeds Le Lettrage")
    csv_txt = ("date,amount,label,reference\n"
               "2026-03-01,1200.00,VIR Client A,FAC-H1\n"
               "01/03/2026,600,VIR Client B,FAC-H2\n")
    out = IMP.import_bank(tid, {"content": csv_txt}, token_data=r)
    check("2 CSV transactions imported", out["imported"] == 2, out)
    tx = db.bank_transactions.find_one({"reference": "FAC-H1", "tenant_id": tid})
    check("amount parsed", tx["amount"] == 1200.0)
    check("unmatched by default (ready for Lettrage)", tx["matched"] is False)

    ofx = ("<OFX><BANKMSGSRSV1><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260305<TRNAMT>350.00"
           "<FITID>OFX1<NAME>VIR Metro</STMTTRN></BANKMSGSRSV1></OFX>")
    out2 = IMP.import_bank(tid, {"content": ofx, "format": "ofx"}, token_data=r)
    check("1 OFX transaction imported", out2["imported"] == 1, out2)
    check("OFX amount + label parsed",
          db.bank_transactions.find_one({"reference": "OFX1"})["amount"] == 350.0)


def test_reception_sync_any_pa(db):
    print("\nReception SYNC (pull) — works whatever the client's PA")
    # tenant on 'iopole' (Model B); its connector is a distinct instance
    db.tenants.insert_one({"id": "tio", "legal_name": "Iopole Client",
                           "facturation_enabled": True, "pdp_provider": "iopole"})
    db.cabinet_links.insert_one({"id": "lio", "cabinet_id":
        CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"],
        "tenant_id": "tio", "status": "active"})
    conn = get_pdp_connector(db.tenants.find_one({"id": "tio"}))
    check("routed to the client's own PA", conn.provider == "iopole")
    # seed a supplier invoice INTO that PA's inbox, then pull it
    conn._seed_received("tio", {"supplier": {"name": "Metro SAS", "siren": "444444444"},
                                "number": "SUP-9", "total_ht": 900})
    out = F.sync_received({"tenant_id": "tio"}, token_data=tok("rousseau@cab.fr"))
    check("pulled from the iopole inbox", out["synced"] == 1 and out["pa_provider"] == "iopole", out)
    rec = db.fact_received_invoices.find_one({"tenant_id": "tio"})
    check("supplier invoice stored for the cabinet", rec and rec["supplier"]["name"] == "Metro SAS")
    # idempotent — second sync adds nothing
    out2 = F.sync_received({"tenant_id": "tio"}, token_data=tok("rousseau@cab.fr"))
    check("sync is idempotent", out2["synced"] == 0, out2)


if __name__ == "__main__":
    db = build()
    tid = test_clients(db)
    test_invoices_csv(db, tid)
    test_invoices_fec_roundtrip(db, tid)
    test_bank(db, tid)
    test_reception_sync_any_pa(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
