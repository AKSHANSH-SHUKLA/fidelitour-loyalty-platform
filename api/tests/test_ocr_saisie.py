"""
Tests — OCR ingestion (Chapter 4 reading), Saisie agent (Chapter 4 entry),
and the WhatsApp relance channel added to the collection agent.

Run:  cd api && python3 tests/test_ocr_saisie.py

WHY THESE MATTER
    OCR:    a wrong number typed into the books is worse than no number, so
            every extraction carries a confidence and low confidence is flagged
            needs_review — never auto-posted. The arithmetic must reconcile.
    Saisie: the agent PROPOSES a balanced purchase entry but NEVER validates —
            an agent identity is refused (403), only a human validator can sign.
            Débit == Crédit to the centime, always.
    WhatsApp: the agent picks the channel per client and degrades to email when
            WhatsApp isn't live — no message is ever lost to a missing channel.
    Both external hops (vision model, WhatsApp Graph API) are replaced by seams,
    so nothing leaves the machine and no API key is needed.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.facturation as F
import features.agent_collect as AC
import features.agent_ocr as OCRF
import features.agent_saisie as SA
import features.exceptions_centre as EC
import features.audit as A
from services import ocr, whatsapp, mailer

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


def tok(email, role="comptable", tenant_id=None):
    return SimpleNamespace(email=email, role=role, tenant_id=tenant_id)


PW = "Cabinet-Test2026!"


def fake_post(payload, key):
    SENT.append(payload)
    return {"messageId": f"test-{len(SENT)}"}


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, F, AC, OCRF, SA, EC, A):
        mod.init(db)
    os.environ["BREVO_API_KEY"] = "test-key-not-real"
    mailer._post = fake_post

    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    r = tok("rousseau@cab.fr")
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=r)
    CO.create_member({"email": "tom@cab.fr", "role": "assistant",
                      "password": PW, "full_name": "Tom"}, token_data=r)
    cab_a = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Boulangerie Petit",
                           "name": "Boulangerie Petit", "siren": "552100554",
                           "facturation_enabled": True, "dgfip_activated": True})
    lea_mid = CO._db.cabinet_memberships.find_one({"user_email": "lea@cab.fr"})["id"]
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab_a, "tenant_id": "t1",
                                 "status": "active", "assignee_membership_id": lea_mid})
    return db, cab_a


# --------------------------------------------------------------------------
def test_ocr_service():
    print("\nOCR service — normalisation & confidence")
    # backfill HT/VAT from TTC when only TTC is read
    ocr._force_extract = lambda b, m: {"supplier_name": "Metro", "total_ttc": 120,
                                       "vat_rate": 20, "confidence": 0.9}
    out = ocr.extract_invoice("x", "image/jpeg")
    check("HT backfilled from TTC", out["total_ht"] == 100.0, out["total_ht"])
    check("VAT backfilled from TTC", out["total_vat"] == 20.0, out["total_vat"])
    check("confidence in 0..1", out["confidence"] == 0.9)

    # confidence given as a percentage is rescaled
    ocr._force_extract = lambda b, m: {"supplier_name": "X", "total_ht": 50,
                                       "total_vat": 10, "total_ttc": 60,
                                       "vat_rate": 20, "confidence": 88}
    out = ocr.extract_invoice("x")
    check("percentage confidence rescaled to 0.88", out["confidence"] == 0.88, out["confidence"])

    # arithmetic that doesn't reconcile is distrusted
    ocr._force_extract = lambda b, m: {"total_ht": 100, "total_vat": 20,
                                       "total_ttc": 200, "confidence": 0.99}
    out = ocr.extract_invoice("x")
    check("bad arithmetic caps confidence at 0.5", out["confidence"] <= 0.5, out["confidence"])

    # 9-digit SIREN kept, junk dropped
    ocr._force_extract = lambda b, m: {"supplier_siren": "552 100 554",
                                       "total_ttc": 12, "confidence": 0.9}
    check("SIREN cleaned to 9 digits", ocr.extract_invoice("x")["supplier_siren"] == "552100554")

    # not configured, no seam → no-op
    ocr._force_extract = None
    for k in ("GROQ_API_KEY", "NVIDIA_API_KEY"):
        os.environ.pop(k, None)
    check("no provider → no_op", ocr.extract_invoice("x").get("no_op") is True)


# --------------------------------------------------------------------------
def test_ocr_ingest(db):
    r = tok("rousseau@cab.fr")
    print("\nOCR ingest — high confidence auto, low confidence needs_review")
    ocr._force_extract = lambda b, m: {"supplier_name": "Metro SAS",
                                       "supplier_siren": "444444444",
                                       "invoice_number": "M-2026-07",
                                       "date": "2026-07-10", "total_ttc": 240,
                                       "vat_rate": 20, "category_guess": "fournitures",
                                       "confidence": 0.95}
    res = OCRF.cabinet_ocr("t1", {"image": "data:image/png;base64,AAAA"}, token_data=r)
    check("ingest ok", res["ok"] is True)
    check("high confidence → auto (no review)", res["needs_review"] is False)
    rec = res["received"]
    check("stored as source=ocr", rec["source"] == "ocr")
    check("HT computed from TTC 240 → 200", rec["total_ht"] == 200.0, rec["total_ht"])
    check("saisie pending after ingest", rec["saisie_status"] == "pending")
    check("ingest audited under the AGENT",
          A._db.audit_log.count_documents({"action": "agent.ocr_ingested"}) == 1)
    agent_audit = A._db.audit_log.find_one({"action": "agent.ocr_ingested"})
    check("agent identity recorded, human as triggered_by",
          "@agent.fidclic" in (agent_audit.get("actor_email") or "")
          and agent_audit.get("detail", {}).get("triggered_by") == "rousseau@cab.fr",
          agent_audit)

    ocr._force_extract = lambda b, m: {"supplier_name": "Flou", "total_ttc": 60,
                                       "vat_rate": 20, "confidence": 0.4}
    res2 = OCRF.cabinet_ocr("t1", {"image": "AAAA"}, token_data=r)
    check("low confidence → needs_review", res2["needs_review"] is True)
    check("needs_review stored on record", res2["received"]["ocr_status"] == "needs_review")

    expect_status("no image → 422", 422,
                  lambda: OCRF.cabinet_ocr("t1", {}, token_data=r))
    # not configured (no seam, no key) → 503
    ocr._force_extract = None
    expect_status("OCR not configured → 503", 503,
                  lambda: OCRF.cabinet_ocr("t1", {"image": "AAAA"}, token_data=r))


# --------------------------------------------------------------------------
def test_saisie(db):
    r = tok("rousseau@cab.fr")
    print("\nSaisie — agent proposes a balanced purchase entry")
    # two OCR'd invoices to enter
    ocr._force_extract = lambda b, m: {"supplier_name": "Metro SAS", "total_ttc": 240,
                                       "vat_rate": 20, "category_guess": "fournitures",
                                       "confidence": 0.95}
    OCRF.cabinet_ocr("t1", {"image": "A"}, token_data=r)
    ocr._force_extract = lambda b, m: {"supplier_name": "SNCF", "total_ttc": 110,
                                       "vat_rate": 10, "category_guess": "transport",
                                       "confidence": 0.95}
    OCRF.cabinet_ocr("t1", {"image": "B"}, token_data=r)
    ocr._force_extract = None

    out = SA.run_saisie("t1", token_data=r)
    check("agent proposed an entry per invoice", out["entries_proposed"] == 2, out)
    entries = SA.list_entries("t1", token_data=r)["entries"]
    e = entries[0]
    check("entry is balanced (débit == crédit)", e["total_debit"] == e["total_credit"], e)
    check("entry status = proposed", e["status"] == "proposed")
    check("proposed by the agent", "@agent.fidclic" in e["proposed_by"])
    metro = next(x for x in entries if x["supplier"] == "Metro SAS")
    accts = {l["account"] for l in metro["lines"]}
    check("Metro entry hits 606400 (fournitures), 445660 (TVA déd.), 401000",
          {"606400", "445660", "401000"} <= accts, accts)
    check("supplier credited the TTC (240)",
          any(l["account"] == "401000" and l["credit"] == 240.0 for l in metro["lines"]))
    check("saisie proposed is audited as agent",
          A._db.audit_log.count_documents({"action": "agent.saisie_proposed"}) == 2)

    print("\nSaisie — only a HUMAN validator can sign; the agent cannot")
    from features import cabinet_os as co
    agent_email = co.agent_email_for(SA._db.saisie_entries.find_one()["cabinet_id"])
    expect_status("agent identity refused (403)", 403,
                  lambda: SA.validate_entry(metro["id"], token_data=tok(agent_email)))
    expect_status("assistant (non-validator) refused (403)", 403,
                  lambda: SA.validate_entry(metro["id"], token_data=tok("tom@cab.fr")))

    # collaborateur is a valid validator
    ok = SA.validate_entry(metro["id"], token_data=tok("lea@cab.fr"))
    check("human validator signs the entry", ok["status"] == "validated")
    check("received invoice flips to saisie done",
          db.fact_received_invoices.find_one({"id": metro["received_id"]})["saisie_status"] == "validated")
    expect_status("cannot validate twice (409)", 409,
                  lambda: SA.validate_entry(metro["id"], token_data=tok("lea@cab.fr")))


# --------------------------------------------------------------------------
def test_whatsapp_channel(db):
    r = tok("rousseau@cab.fr")
    print("\nWhatsApp — normalisation & seam")
    check("FR local → E.164 digits", whatsapp.normalize_phone("06 12 34 56 78") == "33612345678")
    check("not configured → no_op",
          whatsapp.send_whatsapp("0612345678", "hi").get("no_op") is True)

    print("\nWhatsApp — agent routes a relance over WhatsApp when live")
    wa_sent = []
    whatsapp._force_transport = lambda to, body: (wa_sent.append((to, body)) or
                                                  {"sent": True, "message_id": "wa-1", "to": to})
    os.environ["WHATSAPP_TOKEN"] = "t"
    os.environ["WHATSAPP_PHONE_ID"] = "p"           # is_configured() → True

    today = date.today()
    AC.create_request("t1", {"label": "Relevé bancaire",
                             "client_email": "patron@boul.fr",
                             "client_phone": "06 11 22 33 44", "channel": "auto",
                             "due_date": (today - timedelta(days=1)).isoformat()},
                      token_data=r)
    out = AC.run_collection(token_data=r)
    check("agent sent one relance", out["emails_sent"] == 1, out)
    check("it went over WhatsApp (not email)", len(wa_sent) == 1 and len(SENT) == 0, (wa_sent, SENT))
    check("message names the piece", "Relevé bancaire" in wa_sent[0][1])
    stamp = db.doc_requests.find_one({"label": "Relevé bancaire"})["reminders"][-1]
    check("reminder stamped with channel=whatsapp", stamp["channel"] == "whatsapp", stamp)
    au = A._db.audit_log.find_one({"action": "agent.reminder_sent",
                                   "after.channel": "whatsapp"})
    check("audit records the WhatsApp channel", au is not None)

    print("\nWhatsApp — falls back to email when the client pins email")
    AC.create_request("t1", {"label": "Facture EDF", "client_email": "patron@boul.fr",
                             "client_phone": "06 11 22 33 44", "channel": "email",
                             "due_date": (today - timedelta(days=1)).isoformat()},
                      token_data=r)
    # exhaust the whatsapp one so only EDF is due? both due; pick group is per email,
    # so both pieces share one group. channel_pref "email" present → email wins.
    SENT.clear(); wa_sent.clear()
    AC.run_collection(token_data=r)
    check("mixed group with an email-pin uses email", len(SENT) == 1 and len(wa_sent) == 0,
          (SENT, wa_sent))

    # cleanup env + seams
    whatsapp._force_transport = None
    for k in ("WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"):
        os.environ.pop(k, None)


if __name__ == "__main__":
    test_ocr_service()
    db, cab = build()
    test_ocr_ingest(db)
    db, cab = build()
    test_saisie(db)
    db, cab = build()
    test_whatsapp_channel(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
