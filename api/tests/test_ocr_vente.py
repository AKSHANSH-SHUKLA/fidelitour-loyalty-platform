"""
Tests — OCR VENTE: photograph an invoice the business itself issued (paper
history) → it becomes a SALES record, never transmitted (pa_status=imported).

Run:  cd api && python3 tests/test_ocr_vente.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.facturation as F
import features.agent_ocr as OCRF
import features.audit as A
from services import ocr

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


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, F, OCRF, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    cab = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Boulangerie Petit",
                           "facturation_enabled": True, "dgfip_activated": True})
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab, "tenant_id": "t1",
                                 "status": "active"})
    return db


def test_vente(db):
    r = tok("rousseau@cab.fr")
    print("\nOCR vente — la facture papier émise devient une VENTE")
    ocr._force_extract = lambda b, m: {"supplier_name": "Client Restaurant SARL",
                                       "supplier_siren": "552100554",
                                       "invoice_number": "P-2026-041",
                                       "date": "2026-06-10", "total_ttc": 360,
                                       "vat_rate": 20, "confidence": 0.92}
    out = OCRF.cabinet_ocr_vente("t1", {"image": "data:image/jpeg;base64,AAAA"}, token_data=r)
    inv = out["invoice"]
    check("vente créée dans fact_invoices",
          db.fact_invoices.find_one({"id": inv["id"]}) is not None)
    check("la contrepartie devient le CLIENT (buyer)",
          inv["buyer"]["name"] == "Client Restaurant SARL" and inv["buyer"]["siren"] == "552100554")
    check("montants recalculés (360 TTC → 300 HT + 60 TVA)",
          inv["total_ht"] == 300 and inv["total_vat"] == 60, inv)
    check("pa_status = imported (jamais transmise — déjà émise sur papier)",
          inv["pa_status"] == "imported")
    check("à revoir par un humain avant les livres (unreviewed)",
          inv["review_status"] == "unreviewed")
    check("haute confiance → pas de needs_review", out["needs_review"] is False)
    check("audité comme agent (ocr_vente)",
          A._db.audit_log.count_documents({"action": "agent.ocr_vente"}) == 1)

    print("\nOCR vente — numéro manquant → auto IMP-xxxx ; basse confiance → à vérifier")
    ocr._force_extract = lambda b, m: {"supplier_name": "Passant", "total_ttc": 60,
                                       "vat_rate": 20, "confidence": 0.4}
    out2 = OCRF.cabinet_ocr_vente("t1", {"image": "AAAA"}, token_data=r)
    check("numéro auto-généré IMP-", out2["invoice"]["number"].startswith("IMP-"),
          out2["invoice"]["number"])
    check("basse confiance → needs_review", out2["needs_review"] is True)

    expect_status("image manquante → 422", 422,
                  lambda: OCRF.cabinet_ocr_vente("t1", {}, token_data=r))
    ocr._force_extract = None
    for k in ("GROQ_API_KEY", "NVIDIA_API_KEY"):
        os.environ.pop(k, None)
    expect_status("OCR non configuré → 503", 503,
                  lambda: OCRF.cabinet_ocr_vente("t1", {"image": "AAAA"}, token_data=r))

    print("\nOCR — le prompt revient toujours à l'état achat (finally)")
    check("prompt restauré après un appel vente",
          "here: the CUSTOMER" not in ocr._PROMPT)


if __name__ == "__main__":
    db = build()
    test_vente(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
