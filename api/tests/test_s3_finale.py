"""
Tests for the S3 finale — email password reset + weekly backup.

Run:  cd api && python3 tests/test_s3_finale.py

WHY THESE MATTER
    A reset flow is an attack surface pretending to be a feature. Each test
    maps to an attack: enumeration, token theft from a DB leak, replay,
    expiry bypass, inbox flooding. The backup test proves the parachute
    actually opens (real dump, real send path) and that the door is locked.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import hashlib
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace
import mongomock

import features.auth_reset as AR
import features.cabinet_os as CO
import features.cron as CRON
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


def fake_post(payload, key):
    SENT.append(payload)
    return {"messageId": f"test-{len(SENT)}"}


def build():
    db = mongomock.MongoClient().db
    for mod in (AR, CO, CRON, A):
        mod.init(db)
    os.environ["BREVO_API_KEY"] = "test-key"
    mailer._post = fake_post
    from auth import hash_password
    db.users.insert_one({"email": "owner@cafe.fr", "role": "business_owner",
                         "tenant_id": "t1",
                         "hashed_password": hash_password("Ancien-Pass2026!")})
    db.tenants.insert_one({"id": "t1", "name": "Café"})
    return db


def _token_from_last_email():
    link = [l for l in SENT[-1]["htmlContent"].split('"') if "/reinitialiser" in l][0]
    return link.split("token=")[1]


def test_reset(db):
    print("\nS3 — forgot password: the neutral front")
    r1 = AR.forgot_password({"email": "owner@cafe.fr"})
    r2 = AR.forgot_password({"email": "ghost@nowhere.fr"})
    check("known email → ok:true + email sent", r1["ok"] and len(SENT) == 1)
    check("UNKNOWN email → identical ok:true, NO email (no enumeration)",
          r2["ok"] and len(SENT) == 1)
    check("email contains the magic link", "/reinitialiser?token=" in SENT[0]["htmlContent"])
    row = db.password_resets.find_one({"email": "owner@cafe.fr", "used": False})
    tok = _token_from_last_email()
    check("DB stores only the SHA-256, never the token",
          row["token_hash"] == hashlib.sha256(tok.encode()).hexdigest()
          and tok not in str(row))

    print("\nS3 — flood protection")
    AR.forgot_password({"email": "owner@cafe.fr"})
    AR.forgot_password({"email": "owner@cafe.fr"})
    n_before = len(SENT)
    AR.forgot_password({"email": "owner@cafe.fr"})          # 4th within an hour
    check("4th request in an hour sends nothing", len(SENT) == n_before)
    check("each new request voids the previous token",
          db.password_resets.count_documents({"email": "owner@cafe.fr", "used": False}) == 1)

    print("\nS3 — the reset itself")
    tok = _token_from_last_email()
    expect_status("weak new password refused", 422,
                  lambda: AR.reset_password({"token": tok, "new_password": "weak"}))
    res = AR.reset_password({"token": tok, "new_password": "Nouveau-Pass2026!"})
    check("reset succeeds with a compliant password", res["ok"] is True)
    from auth import verify_password
    u = db.users.find_one({"email": "owner@cafe.fr"})
    check("password actually changed",
          verify_password("Nouveau-Pass2026!", u["hashed_password"]))
    expect_status("token cannot be REPLAYED", 410,
                  lambda: AR.reset_password({"token": tok, "new_password": "Autre-Pass2026!"}))
    expect_status("garbage token → 410, no information", 410,
                  lambda: AR.reset_password({"token": "AAAA", "new_password": "Autre-Pass2026!"}))

    print("\nS3 — expiry")
    AR.forgot_password({"email": "owner@cafe.fr"})           # hour window: still blocked?
    # force a fresh token bypassing the rate window
    db.password_resets.delete_many({"email": "owner@cafe.fr"})
    AR.forgot_password({"email": "owner@cafe.fr"})
    tok2 = _token_from_last_email()
    db.password_resets.update_many(
        {"email": "owner@cafe.fr"},
        {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()}})
    expect_status("expired token refused", 410,
                  lambda: AR.reset_password({"token": tok2, "new_password": "Encore-Un2026!"}))

    print("\nS3 — reset clears the cabinet forced-change flag")
    from auth import hash_password
    db.users.insert_one({"email": "lea@cab.fr", "role": "comptable",
                         "hashed_password": hash_password("Temp-Pass2026!")})
    db.cabinet_memberships.insert_one({"id": "m1", "cabinet_id": "c1",
                                       "user_email": "lea@cab.fr", "role": "collaborateur",
                                       "status": "active", "must_change_password": True})
    AR.forgot_password({"email": "lea@cab.fr"})
    tok3 = _token_from_last_email()
    AR.reset_password({"token": tok3, "new_password": "Choisi-Par-Lea26!"})
    check("must_change_password cleared (she chose it herself)",
          db.cabinet_memberships.find_one({"id": "m1"})["must_change_password"] is False)


def test_backup(db):
    print("\nS3 — the weekly parachute")
    os.environ["CRON_SECRET"] = "s3cret"
    expect_status("backup door locked (401 on wrong secret)", 401,
                  lambda: CRON.backup_weekly(authorization="Bearer nope"))
    n = len(SENT)
    out = CRON.backup_weekly(authorization="Bearer s3cret")
    check("backup runs and reports counts", out["ok"] and out["documents"] >= 2, out)
    check("backup email sent with attachment",
          len(SENT) == n + 1 and SENT[-1].get("attachment")
          and SENT[-1]["attachment"][0]["name"].endswith(".json.gz"))
    import base64, gzip, json as _json
    blob = _json.loads(gzip.decompress(base64.b64decode(SENT[-1]["attachment"][0]["content"])))
    check("attachment decompresses back to real data",
          any(u["email"] == "owner@cafe.fr" for u in blob["users"]))


if __name__ == "__main__":
    db = build()
    test_reset(db)
    test_backup(db)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
