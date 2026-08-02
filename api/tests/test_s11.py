"""
Tests for S11 — the agent seat.

Run:  cd api && python3 tests/test_s11.py

WHY THESE MATTER
    The agent is FidClic acting as an employee. Two failure modes would be
    fatal to trust:
      - agent work booked under a HUMAN's name (poisons the audit trail),
      - the agent validating anything, ever (the "outil dangereux" the
        profession explicitly rejects).
    So: its own identity on everything it makes, a hard 403 on validation
    with NO threshold, and its drafts flow through the same human queue.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from types import SimpleNamespace
import mongomock

import features.cabinet_os as CO
import features.cabinet as C
import features.facturation as F
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


def tok(email):
    return SimpleNamespace(email=email, role="comptable", tenant_id=None)


PW = "Cabinet-Test2026!"


def build():
    db = mongomock.MongoClient().db
    for mod in (CO, C, F, A):
        mod.init(db)
    CO.cabinet_signup({"email": "rousseau@cab.fr", "name": "Cabinet Rousseau",
                       "password": PW, "ordre_number": "140002200"})
    CO.cabinet_signup({"email": "other@cabB.fr", "name": "Cabinet B", "password": PW})
    r = tok("rousseau@cab.fr")
    CO.create_member({"email": "lea@cab.fr", "role": "collaborateur",
                      "password": PW, "full_name": "Léa"}, token_data=r)
    cab_a = CO._db.cabinets.find_one({"name": "Cabinet Rousseau"})["id"]
    cab_b = CO._db.cabinets.find_one({"name": "Cabinet B"})["id"]
    db.tenants.insert_one({"id": "t1", "legal_name": "Café Lumière SARL",
                           "name": "Café Lumière", "siren": "552100554",
                           "facturation_enabled": True, "dgfip_activated": True})
    db.tenants.insert_one({"id": "tB", "legal_name": "Client B",
                           "facturation_enabled": True})
    db.cabinet_links.insert_one({"id": "l1", "cabinet_id": cab_a, "tenant_id": "t1",
                                 "status": "active"})
    db.cabinet_links.insert_one({"id": "lB", "cabinet_id": cab_b, "tenant_id": "tB",
                                 "status": "active"})
    return db, cab_a, cab_b


def test_agent(db, cab_a, cab_b):
    r = tok("rousseau@cab.fr")

    print("\nS11 — the seat itself")
    a1 = CO.ensure_agent(cab_a)
    a2 = CO.ensure_agent(cab_a)
    check("agent seat is created once (idempotent)", a1["id"] == a2["id"])
    check("agent has role=agent and no password duty",
          a1["role"] == "agent" and a1["must_change_password"] is False)
    check("agent has NO users row (cannot log in)",
          db.users.find_one({"email": a1["user_email"]}) is None)
    team = CO.list_team(token_data=r)
    check("agent appears in the team list",
          any(m["role"] == "agent" for m in team["members"]))
    check("is_agent_email detects it", CO.is_agent_email(a1["user_email"]) is True)
    check("…and not a human", CO.is_agent_email("lea@cab.fr") is False)

    print("\nS11 — agent drafts, under its OWN name")
    res = CO.agent_draft_invoice("t1", {}, token_data=r)
    inv = res["invoice"]
    check("draft created", res["ok"] is True and inv["total_ttc"] == 600.0)
    check("created_by is the AGENT, not the human trigger",
          CO.is_agent_email(inv["created_by"]))
    check("draft is a DRAFT (agent never transmits alone)",
          inv["pa_status"] == "draft")
    q = C.review_queue(token_data=r)
    row = next((x for x in q["queue"] if x["id"] == inv["id"]), None)
    check("draft lands in the human review queue", row is not None)
    check("queue shows a readable label", row["created_by_label"] == "Agent FidClic")
    check("NOT four-eyes-blocked for the human reviewer",
          row["four_eyes_blocked_for_me"] is False)

    print("\nS11 — the hard rule: the agent NEVER validates")
    agent = CO.agent_actor(cab_a)
    expect_status("agent cannot validate its own draft (600 € < seuil — NO threshold)", 403,
                  lambda: F.set_review_status(inv["id"], {"target": "validated"},
                                              token_data=agent))
    rr = F.set_review_status(inv["id"], {"target": "validated"}, token_data=r)
    check("a human validates it fine (positive control)",
          rr["invoice"]["review_status"] == "validated")

    print("\nS11 — scope and audit")
    expect_status("agent of cabinet A cannot touch cabinet B's dossier", 403,
                  lambda: CO.assert_can_see_tenant(agent.email, "tB"))
    check("agent CAN see its own cabinet's dossier (positive control)",
          CO.assert_can_see_tenant(agent.email, "t1") is not None)
    entry = A._db.audit_log.find_one({"action": "agent.invoice_drafted"})
    check("draft is audited under the agent action", entry is not None)
    check("audit names the human trigger",
          (entry or {}).get("detail", {}).get("triggered_by") == "rousseau@cab.fr")
    created = A._db.audit_log.find_one({"action": "invoice.created",
                                        "object.id": inv["id"]}) or \
              A._db.audit_log.find_one({"action": "invoice.created"})
    check("invoice.created actor is the agent identity",
          CO.is_agent_email((created or {}).get("actor_email") or ""))


if __name__ == "__main__":
    db, cab_a, cab_b = build()
    test_agent(db, cab_a, cab_b)
    print("\n" + "=" * 62)
    print(f"PASSED: {len(PASS)}   FAILED: {len(FAIL)}")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  ✗", f)
        sys.exit(1)
    print("All green ✅")
