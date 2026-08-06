"""
Tests — coefficients sectoriels (defaults, self-learning, reconstitution in the
bouclier) + new import formats (.xlsx, Factur-X/UBL/CII XML).

Run:  cd api && python3 tests/test_coefficients_formats.py
"""
import sys, os, io, zipfile, base64
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.coefficients as CF
import features.data_import as IMP
import features.facturation as F
import features.cabinet as C
import features.cabinet_os as CO
import features.audit as A

PASS, FAIL = [], []


def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗'} {name}{('  → ' + str(extra)) if extra and not cond else ''}")


def tok(email, role="comptable", tenant_id=None):
    return SimpleNamespace(email=email, role=role, tenant_id=tenant_id)


PW = "Cabinet-Test2026!"


def build():
    db = mongomock.MongoClient().db
    for mod in (CF, IMP, F, C, CO, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    cab = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    return db, cab


def add_dossier(db, cab, tid, naf, achats, ventes):
    db.tenants.insert_one({"id": tid, "legal_name": tid, "naf_code": naf,
                           "facturation_enabled": True})
    db.cabinet_links.insert_one({"id": "l" + tid, "cabinet_id": cab,
                                 "tenant_id": tid, "status": "active"})
    if achats:
        db.fact_received_invoices.insert_one({"id": "r" + tid, "tenant_id": tid,
                                              "total_ttc": achats, "state": "accepted"})
    if ventes:
        db.fact_invoices.insert_one({"id": "v" + tid, "tenant_id": tid,
                                     "total_ttc": ventes, "pa_status": "sent",
                                     "review_status": "validated",
                                     "buyer": {"is_company": True}})


def test_defaults():
    print("\nCoefficients — table nationale par NAF")
    b = CF.default_coefficient("10.71C")
    check("boulangerie 1071 → 3.0-3.5", b and b["min"] == 3.0 and b["max"] == 3.5, b)
    check("restauration 5610 reconnue", CF.default_coefficient("5610A")["label"] == "Restauration")
    check("NAF inconnu → None", CF.default_coefficient("8299Z") is None)
    check("généraliste 47 → commerces de détail",
          CF.default_coefficient("4759B")["label"] == "Autres commerces de détail")


def test_learning(db, cab):
    print("\nCoefficients — self-learning (médiane des dossiers du cabinet)")
    # three boulangeries with real ratios 3.0, 3.4, 4.0 → median 3.4
    add_dossier(db, cab, "b1", "1071C", 10000, 30000)
    add_dossier(db, cab, "b2", "1071C", 10000, 34000)
    add_dossier(db, cab, "b3", "1071C", 10000, 40000)
    # one garage — below MIN_DOSSIERS, must NOT be learned
    add_dossier(db, cab, "g1", "4520A", 8000, 16000)
    out = CF.learn(db, cab)
    check("1 secteur appris (boulangerie), garage ignoré (<3 dossiers)",
          out["sectors_learned"] == 1, out)
    row = db.cabinet_coefficients.find_one({"cabinet_id": cab, "naf_prefix": "1071"})
    check("médiane = 3.4", row and row["coef_median"] == 3.4, row)
    check("bande ±20 % (2.72 - 4.08)",
          row and row["coef_min"] == 2.72 and row["coef_max"] == 4.08, row)
    # learned beats default
    c = CF.coefficient_for(db, db.tenants.find_one({"id": "b1"}))
    check("le coefficient APPRIS bat le défaut national", c["source"] == "appris cabinet", c)
    # override beats learned
    db.tenants.update_one({"id": "b1"}, {"$set": {"coefficient_override": [2.5, 2.9]}})
    c2 = CF.coefficient_for(db, db.tenants.find_one({"id": "b1"}))
    check("le réglage dossier bat tout", c2["source"] == "réglage dossier" and c2["min"] == 2.5)


def test_reconstitution(db, cab):
    print("\nReconstitution simulée — le contrôle avant le contrôle")
    # boulangerie: achats 10 000, déclaré 14 000 → attendu ≥ 27 200 (bande apprise) → flag
    add_dossier(db, cab, "s1", "1071C", 10000, 14000)
    r = CF.reconstitution(db, db.tenants.find_one({"id": "s1"}))
    check("écart détecté (déclaré 14k < attendu min)", r and r["flag"] is True, r)
    check("l'écart est chiffré", r and r["gap"] > 10000, r and r["gap"])
    # healthy: déclaré 33k dans la bande → pas de flag
    add_dossier(db, cab, "s2", "1071C", 10000, 33000)
    r2 = CF.reconstitution(db, db.tenants.find_one({"id": "s2"}))
    check("dossier sain → pas de flag", r2 and r2["flag"] is False, r2)

    print("\nBouclier — la ligne « reconstitution » remplace le ratio brut")
    t = db.tenants.find_one({"id": "s1"})
    b = F.compute_bouclier(t)
    recon_alerts = [a for a in b["alerts"] if "Reconstitution" in a["message"]]
    check("alerte reconstitution présente (NAF connu)", len(recon_alerts) == 1, b["alerts"])
    check("alerte amber informative", recon_alerts and recon_alerts[0]["level"] == "amber")
    check("le CA attendu est chiffré dans le message",
          recon_alerts and "27" in recon_alerts[0]["message"])
    b2 = F.compute_bouclier(db.tenants.find_one({"id": "s2"}))
    check("dossier sain → aucune alerte espèces/reconstitution",
          not any("Reconstitution" in a["message"] or "espèces" in a["message"]
                  for a in b2["alerts"]), b2["alerts"])


def _mini_xlsx(rows):
    """Build a tiny real .xlsx in memory (zip + xml) for the parser test."""
    def col(i):
        return chr(65 + i)
    shared, sidx = [], {}
    def sref(s):
        if s not in sidx:
            sidx[s] = len(shared); shared.append(s)
        return sidx[s]
    xml_rows = []
    for rn, row in enumerate(rows, start=1):
        cells = []
        for ci, val in enumerate(row):
            if isinstance(val, (int, float)):
                cells.append(f'<c r="{col(ci)}{rn}"><v>{val}</v></c>')
            else:
                cells.append(f'<c r="{col(ci)}{rn}" t="s"><v>{sref(str(val))}</v></c>')
        xml_rows.append(f'<row r="{rn}">{"".join(cells)}</row>')
    sheet = ('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
             f'<sheetData>{"".join(xml_rows)}</sheetData></worksheet>')
    sst = ('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
           + "".join(f"<si><t>{s}</t></si>" for s in shared) + "</sst>")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/worksheets/sheet1.xml", sheet)
        z.writestr("xl/sharedStrings.xml", sst)
    return base64.b64encode(buf.getvalue()).decode()


def test_xlsx(db, cab):
    print("\nImport .xlsx — sans nouvelle dépendance (zip+xml stdlib)")
    add_dossier(db, cab, "tx", "4711B", 0, 0)
    b64 = _mini_xlsx([["number", "date", "client", "ht", "vat_rate"],
                      ["FAC-X1", "2026-03-01", "Client Xlsx", 1000, 20],
                      ["FAC-X2", "2026-03-15", "Client Deux", 500, 10]])
    out = IMP.import_invoices("tx", {"content_b64": b64, "format": "xlsx"},
                              token_data=tok("rousseau@cab.fr"))
    check("2 factures importées depuis xlsx", out["imported"] == 2, out)
    inv = db.fact_invoices.find_one({"number": "FAC-X1", "tenant_id": "tx"})
    check("montants recalculés (1000 HT → 1200 TTC)", inv and inv["total_ttc"] == 1200, inv)


UBL = """<?xml version="1.0"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
 <cbc:ID>UBL-777</cbc:ID><cbc:IssueDate>2026-04-02</cbc:IssueDate>
 <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity>
   <cbc:RegistrationName>Fournisseur UBL SARL</cbc:RegistrationName>
 </cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
 <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">40.00</cbc:TaxAmount></cac:TaxTotal>
 <cac:LegalMonetaryTotal>
   <cbc:TaxExclusiveAmount currencyID="EUR">200.00</cbc:TaxExclusiveAmount>
   <cbc:TaxInclusiveAmount currencyID="EUR">240.00</cbc:TaxInclusiveAmount>
 </cac:LegalMonetaryTotal>
</Invoice>"""

CII = """<?xml version="1.0"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
 xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
 xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
 <rsm:ExchangedDocument><ram:ID>FX-2026-009</ram:ID>
  <ram:IssueDateTime><udt:DateTimeString format="102">20260405</udt:DateTimeString></ram:IssueDateTime>
 </rsm:ExchangedDocument>
 <rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeAgreement>
  <ram:SellerTradeParty><ram:Name>Factur-X Fournisseur SAS</ram:Name></ram:SellerTradeParty>
 </ram:ApplicableHeaderTradeAgreement>
 <ram:ApplicableHeaderTradeSettlement>
  <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
   <ram:TaxBasisTotalAmount>500.00</ram:TaxBasisTotalAmount>
   <ram:TaxTotalAmount currencyID="EUR">100.00</ram:TaxTotalAmount>
   <ram:GrandTotalAmount>600.00</ram:GrandTotalAmount>
  </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
 </ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""


def test_einvoice_xml(db, cab):
    r = tok("rousseau@cab.fr")
    print("\nImport e-facture XML — UBL et Factur-X/CII (formats 2026)")
    add_dossier(db, cab, "te", "4711B", 0, 0)
    o1 = IMP.import_einvoice("te", {"content": UBL}, token_data=r)
    check("UBL importée", o1["imported"] == 1, o1)
    rec = db.fact_received_invoices.find_one({"number": "UBL-777"})
    check("UBL montants (200/40/240)", rec and rec["total_ht"] == 200
          and rec["total_vat"] == 40 and rec["total_ttc"] == 240, rec)
    check("fournisseur lu", rec and rec["supplier"]["name"] == "Fournisseur UBL SARL")
    o2 = IMP.import_einvoice("te", {"content": CII}, token_data=r)
    check("Factur-X/CII importée", o2["imported"] == 1, o2)
    rec2 = db.fact_received_invoices.find_one({"number": "FX-2026-009"})
    check("CII montants (500/100/600) + date 2026-04-05",
          rec2 and rec2["total_ttc"] == 600 and rec2["date"] == "2026-04-05", rec2)
    check("saisie_status pending → l'agent Saisie la prendra",
          rec2 and rec2["saisie_status"] == "pending")
    o3 = IMP.import_einvoice("te", {"content": UBL}, token_data=r)
    check("doublon ignoré (même fournisseur + numéro)", o3.get("duplicate") is True, o3)
    try:
        IMP.import_einvoice("te", {"content": "<foo/>"}, token_data=r)
        check("XML inconnu refusé (422)", False)
    except Exception as e:
        check("XML inconnu refusé (422)", getattr(e, "status_code", None) == 422, e)


if __name__ == "__main__":
    test_defaults()
    db, cab = build(); test_learning(db, cab)
    db, cab = build(); test_learning(db, cab); test_reconstitution(db, cab)
    db, cab = build(); test_xlsx(db, cab)
    db, cab = build(); test_einvoice_xml(db, cab)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:"); [print("  ✗", f) for f in FAIL]
        sys.exit(1)
    print("All green ✅")
