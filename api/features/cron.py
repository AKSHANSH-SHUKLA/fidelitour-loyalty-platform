"""
Cron — the agent's alarm clock (S13).

Status: 🟢 Core.
Mounts at: /api/cron/agent-daily
Trigger: Vercel Cron (vercel.json), daily 07:00 UTC = 08:00/09:00 Paris —
         early enough that relances/drafts sit in the team's queues when the
         cabinet opens, late enough to count "today" correctly.

SECURITY
    No user auth here — the caller is Vercel's scheduler. Vercel sends
    `Authorization: Bearer $CRON_SECRET` automatically when the CRON_SECRET
    env var exists on the project. We refuse anything else with 401, so a
    random visitor cannot make the agent run on demand (that would let an
    outsider control WHEN emails leave, a spam/abuse lever).

DESIGN
    One pass over every active cabinet; each cabinet is isolated in its own
    try/except so one broken cabinet cannot stop the others' relances.
    Everything the agent does inside is already audited per-cabinet with
    triggered_by="cron".
"""
from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(tags=["cron"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/cron/agent-daily")
@router.post("/api/cron/agent-daily")
def agent_daily(authorization: str = Header(default="")):
    secret = os.getenv("CRON_SECRET")
    if not secret:
        raise HTTPException(503, "CRON_SECRET non configuré.")
    if authorization != f"Bearer {secret}":
        raise HTTPException(401, "Non autorisé.")

    from features.agent_collect import run_collection_for_cabinet
    from features.agent_billing import run_billing_for_cabinet

    summary: Dict[str, Any] = {"cabinets": 0, "emails_sent": 0,
                               "cases_opened": 0, "invoices_drafted": 0,
                               "failures": []}
    for cab in _db.cabinets.find({"status": "active"}):
        summary["cabinets"] += 1
        try:
            c = run_collection_for_cabinet(cab["id"], "cron")
            summary["emails_sent"] += c.get("emails_sent", 0)
            summary["cases_opened"] += c.get("cases_opened", 0)
        except Exception as e:                                   # noqa: BLE001
            summary["failures"].append({"cabinet": cab.get("name"),
                                        "step": "collect", "error": str(e)[:120]})
        try:
            b = run_billing_for_cabinet(cab["id"], "cron")
            summary["invoices_drafted"] += b.get("invoices_drafted", 0)
        except Exception as e:                                   # noqa: BLE001
            summary["failures"].append({"cabinet": cab.get("name"),
                                        "step": "billing", "error": str(e)[:120]})
    return summary
