"""
Twilio SMS wrapper.

Reads three env vars on Render:
    TWILIO_ACCOUNT_SID
    TWILIO_AUTH_TOKEN
    TWILIO_FROM_NUMBER   (must be E.164, e.g. "+33756123456")

If ANY of those are missing, send_sms() no-ops and returns
{"sent": False, "error": "twilio_not_configured", "no_op": True}.
The platform never crashes; messages just don't leave the server.

Costs (April 2026, Twilio rate card):
    France SMS:        ~€0.04 / message
    Free trial credit: $15.50 (about 350 test SMS to verified numbers)
"""
from __future__ import annotations
import os
import logging
import re

logger = logging.getLogger("fidelitour.sms")

_SID   = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
_FROM  = os.environ.get("TWILIO_FROM_NUMBER", "").strip()

_client_cache = None
_client_failed = False


def is_configured() -> bool:
    return bool(_SID and _TOKEN and _FROM)


def _get_client():
    """Lazy import + initialise — keeps cold-start fast and avoids
    a hard dependency on `twilio` when env vars aren't set."""
    global _client_cache, _client_failed
    if _client_cache is not None:
        return _client_cache
    if _client_failed:
        return None
    if not is_configured():
        return None
    try:
        from twilio.rest import Client                     # noqa: WPS433 (lazy import is intentional)
        _client_cache = Client(_SID, _TOKEN)
        return _client_cache
    except Exception as exc:                                # noqa: BLE001
        logger.exception("Twilio client init failed: %s", exc)
        _client_failed = True
        return None


def normalize_phone(phone: str) -> str:
    """Convert common French local formats to E.164.
    Examples:
        "06 12 34 56 78"  -> "+33612345678"
        "06.12.34.56.78"  -> "+33612345678"
        "0033612345678"   -> "+33612345678"
        "+33612345678"    -> "+33612345678" (passthrough)
    Returns "" if the input doesn't look like a phone at all.
    """
    if not phone:
        return ""
    p = re.sub(r"[\s\-\.\(\)]", "", str(phone))
    if not p:
        return ""
    if p.startswith("+"):
        return p
    if p.startswith("00"):
        return "+" + p[2:]
    if p.startswith("0") and len(p) == 10:
        return "+33" + p[1:]
    # Bare digits with country code already
    if p.isdigit() and len(p) >= 10:
        return "+" + p
    return ""


def send_sms(to: str, body: str) -> dict:
    """Send an SMS. Returns a result dict — never raises.
    Shape: {sent: bool, sid?: str, to?: str, error?: str, no_op?: bool}
    """
    if not is_configured():
        return {"sent": False, "error": "twilio_not_configured", "no_op": True}

    client = _get_client()
    if not client:
        return {"sent": False, "error": "twilio_init_failed"}

    to_e164 = normalize_phone(to)
    if not to_e164:
        return {"sent": False, "error": "invalid_phone", "input": to}

    if not body or not str(body).strip():
        return {"sent": False, "error": "empty_body"}

    try:
        msg = client.messages.create(body=body[:1600], from_=_FROM, to=to_e164)
        logger.info("SMS sent sid=%s to=%s len=%s", msg.sid, to_e164, len(body))
        return {"sent": True, "sid": msg.sid, "to": to_e164, "status": msg.status}
    except Exception as exc:                                # noqa: BLE001
        logger.exception("Twilio send failed to %s: %s", to_e164, exc)
        return {"sent": False, "error": str(exc), "to": to_e164}
