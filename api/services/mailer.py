"""
Transactional email via Brevo (HTTP API, no SDK dependency).

WHY BREVO
    French provider (CNIL-friendly story for a French SMB product), free tier
    300 emails/day — plenty for relances at this stage.

KEY RESOLUTION
    env BREVO_API_KEY only (set in the Vercel project env — never in the
    repo; GitHub push protection rightly blocks it, including base64'd).
    Without it → disabled mode: send() returns {"sent": False} and the
    caller carries on. Email must never be able to break business logic.

TESTABILITY
    Tests monkeypatch `_post` (single network seam) — no network, no key.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Any, Dict, List, Optional

SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "akshanshshukla963@gmail.com")
SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "FidClic")


def _api_key() -> Optional[str]:
    return os.getenv("BREVO_API_KEY") or None


def _post(payload: Dict[str, Any], key: str) -> Dict[str, Any]:
    """The single network seam (tests replace this)."""
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode(),
        headers={"api-key": key, "Content-Type": "application/json",
                 "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode() or "{}")


def send(to: str, subject: str, html: str,
         text: Optional[str] = None,
         to_name: Optional[str] = None) -> Dict[str, Any]:
    """Send one email. Never raises — a failed relance is a log line and a
    retry on the next agent run, not a crashed request."""
    key = _api_key()
    if not key:
        return {"sent": False, "reason": "mailer_disabled"}
    payload = {
        "sender": {"email": SENDER_EMAIL, "name": SENDER_NAME},
        "to": [{"email": to, **({"name": to_name} if to_name else {})}],
        "subject": subject,
        "htmlContent": html,
        **({"textContent": text} if text else {}),
    }
    try:
        res = _post(payload, key)
        return {"sent": True, "message_id": res.get("messageId")}
    except Exception as e:                                   # noqa: BLE001
        return {"sent": False, "reason": str(e)[:200]}
