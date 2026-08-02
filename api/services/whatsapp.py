"""
WhatsApp Business wrapper (Meta WhatsApp Cloud API).

WHY WHATSAPP FOR RELANCES
    Research: French SMB owners read WhatsApp far faster than email — a document
    relance that sits unread in an inbox for a week gets answered in an hour on
    WhatsApp. The collection agent (S12) becomes materially more effective when
    it can reach the client on the channel they actually watch. So the agent
    picks the channel per client (see agent_collect._pick_channel).

CONFIG (Meta Cloud API — set on Vercel when the business account is verified)
    WHATSAPP_TOKEN            permanent access token
    WHATSAPP_PHONE_ID         the phone-number ID (not the phone number)
    WHATSAPP_TEMPLATE_RELANCE optional approved template name (defaults to a
                              free-form text message, only valid inside a
                              24-hour customer-service window)

HONEST STATUS
    Meta's WhatsApp Business API requires business verification and an approved
    message template before it will deliver to arbitrary numbers — that is a
    business/legal step, not code. Until WHATSAPP_TOKEN + WHATSAPP_PHONE_ID are
    set, send_whatsapp() NO-OPS cleanly (returns sent=False, no_op=True) exactly
    like the SMS wrapper. The channel abstraction, the agent's per-client
    routing, and the audit trail are all live and tested against a seam; only
    the final network hop waits on the Meta account.
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.request

logger = logging.getLogger("fidelitour.whatsapp")

_GRAPH = "https://graph.facebook.com/v20.0"

# Test seam — set to a callable(to, body) -> dict to intercept the network hop
# in tests without monkeypatching urllib. Mirrors mailer._post / pdp force hooks.
_force_transport = None


def _token() -> str:
    return os.environ.get("WHATSAPP_TOKEN", "").strip()


def _phone_id() -> str:
    return os.environ.get("WHATSAPP_PHONE_ID", "").strip()


def is_configured() -> bool:
    return bool(_token() and _phone_id())


def normalize_phone(phone: str) -> str:
    """French local formats -> E.164 digits WITHOUT the leading '+'
    (the Graph API wants a bare international number, e.g. '33612345678')."""
    if not phone:
        return ""
    p = re.sub(r"[\s\-\.\(\)]", "", str(phone))
    if not p:
        return ""
    if p.startswith("+"):
        p = p[1:]
    elif p.startswith("00"):
        p = p[2:]
    elif p.startswith("0") and len(p) == 10:
        p = "33" + p[1:]
    return p if p.isdigit() and len(p) >= 10 else ""


def _post(to: str, body: str) -> dict:
    """The real network hop. Isolated so a test can replace _force_transport."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    req = urllib.request.Request(
        f"{_GRAPH}/{_phone_id()}/messages",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {_token()}",
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:  # noqa: S310
        return json.loads(r.read().decode() or "{}")


def send_whatsapp(to: str, body: str) -> dict:
    """Send one WhatsApp message. Never raises.
    Shape: {sent: bool, message_id?: str, to?: str, error?: str, no_op?: bool}
    """
    if _force_transport is not None:
        return _force_transport(to, body)

    if not is_configured():
        return {"sent": False, "error": "whatsapp_not_configured", "no_op": True}

    to_norm = normalize_phone(to)
    if not to_norm:
        return {"sent": False, "error": "invalid_phone", "input": to}
    if not body or not str(body).strip():
        return {"sent": False, "error": "empty_body"}

    try:
        res = _post(to_norm, body)
        mid = (((res.get("messages") or [{}])[0]) or {}).get("id")
        logger.info("WhatsApp sent id=%s to=%s", mid, to_norm)
        return {"sent": True, "message_id": mid, "to": to_norm}
    except Exception as exc:  # noqa: BLE001
        logger.exception("WhatsApp send failed to %s: %s", to_norm, exc)
        return {"sent": False, "error": str(exc)[:200], "to": to_norm}
