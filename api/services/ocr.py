"""
OCR — read a supplier receipt/invoice image into structured accounting fields.

WHY THIS EXISTS (research: Chapter 4, the "saisie" time-sink)
    A collaborateur retypes supplier invoices into the ledger by hand — Dext/
    Pennylane charge per document for exactly this. If FidClic reads the photo,
    the human only *checks* the numbers instead of *typing* them. This is the
    foundation the Saisie agent stands on: OCR proposes, a human validates.

HOW IT WORKS
    A vision LLM (Groq by default, NVIDIA NIM as fallback — both keys already in
    env) receives the image and a strict JSON schema, and returns the fields.
    We never trust it blindly: every extraction carries a `confidence` 0..1.
    High confidence can flow to a draft entry automatically; low confidence is
    flagged needs_review. The human is always the last gate (see agent_saisie).

CONFIG
    OCR_PROVIDER   "groq" (default) | "nvidia"
    GROQ_API_KEY   / NVIDIA_API_KEY   (already set on Vercel)
    OCR_MODEL      optional model override

SEAM
    _force_extract = callable(image_b64, mime) -> dict   lets tests exercise the
    whole pipeline (feature endpoint → received-invoice draft → Saisie entry)
    without a network call or an API key.
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.request

logger = logging.getLogger("fidelitour.ocr")

# Test seam — see module docstring.
_force_extract = None

_ENDPOINTS = {
    "groq": ("https://api.groq.com/openai/v1/chat/completions",
             "GROQ_API_KEY", "meta-llama/llama-4-scout-17b-16e-instruct"),
    "nvidia": ("https://integrate.api.nvidia.com/v1/chat/completions",
               "NVIDIA_API_KEY", "meta/llama-4-scout-17b-16e-instruct"),
}

_PROMPT = (
    "You are an accounting OCR. Read this French supplier invoice/receipt image "
    "and return ONLY a JSON object, no prose, with these keys: "
    "supplier_name (string), supplier_siren (9 digits or empty), "
    "invoice_number (string), date (YYYY-MM-DD or empty), "
    "total_ht (number), total_vat (number), total_ttc (number), "
    "vat_rate (number, the dominant rate e.g. 20), "
    "currency (ISO e.g. EUR), "
    "category_guess (one of: fournitures, services, restauration, transport, "
    "telecom, loyer, honoraires, autre), "
    "confidence (number 0..1 = how sure you are the amounts are correct). "
    "If a value is unreadable use empty string or 0 and lower the confidence."
)


def _provider() -> tuple:
    p = os.environ.get("OCR_PROVIDER", "groq").strip().lower()
    return _ENDPOINTS.get(p, _ENDPOINTS["groq"])


def is_configured() -> bool:
    _url, key_env, _model = _provider()
    return bool(os.environ.get(key_env, "").strip())


def _coerce_num(x) -> float:
    if isinstance(x, (int, float)):
        return float(x)
    if not x:
        return 0.0
    s = re.sub(r"[^\d,.\-]", "", str(x)).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _normalize(raw: dict) -> dict:
    """Coerce the model's JSON into a stable, self-consistent record."""
    ht = _coerce_num(raw.get("total_ht"))
    vat = _coerce_num(raw.get("total_vat"))
    ttc = _coerce_num(raw.get("total_ttc"))
    rate = _coerce_num(raw.get("vat_rate")) or 20.0
    # backfill any missing total from the other two (invoices must reconcile)
    if ttc and not ht and not vat:
        ht = round(ttc / (1 + rate / 100.0), 2)
        vat = round(ttc - ht, 2)
    elif ht and not ttc:
        vat = vat or round(ht * rate / 100.0, 2)
        ttc = round(ht + vat, 2)
    siren = "".join(ch for ch in str(raw.get("supplier_siren") or "") if ch.isdigit())
    conf = _coerce_num(raw.get("confidence"))
    if conf > 1:
        conf = conf / 100.0
    # if the arithmetic doesn't reconcile, trust it less
    if ht and ttc and abs((ht + vat) - ttc) > max(0.02, ttc * 0.02):
        conf = min(conf, 0.5)
    return {
        "ok": True,
        "supplier_name": (raw.get("supplier_name") or "").strip() or "Fournisseur inconnu",
        "supplier_siren": siren if len(siren) == 9 else "",
        "invoice_number": (raw.get("invoice_number") or "").strip(),
        "date": (str(raw.get("date") or "")[:10]),
        "total_ht": round(ht, 2), "total_vat": round(vat, 2), "total_ttc": round(ttc, 2),
        "vat_rate": rate,
        "currency": (raw.get("currency") or "EUR").strip().upper()[:3] or "EUR",
        "category_guess": (raw.get("category_guess") or "autre").strip().lower(),
        "confidence": round(max(0.0, min(1.0, conf)), 2),
    }


def _parse_json(text: str) -> dict:
    """Pull the first JSON object out of a model reply (it may wrap it in prose)."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?|\n?```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {}


def _call_vision(image_b64: str, mime: str) -> dict:
    url, key_env, default_model = _provider()
    key = os.environ.get(key_env, "").strip()
    model = os.environ.get("OCR_MODEL", "").strip() or default_model
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 700,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": _PROMPT},
                {"type": "image_url",
                 "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            ],
        }],
    }
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as r:  # noqa: S310
        data = json.loads(r.read().decode() or "{}")
    content = (((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or ""
    return _parse_json(content)


def extract_invoice(image_b64: str, mime: str = "image/jpeg") -> dict:
    """Read one image into structured fields. Never raises.

    Returns a normalized record with `ok` and `confidence`, or
    {ok: False, no_op: True} when no provider is configured.
    """
    if _force_extract is not None:
        return _normalize(_force_extract(image_b64, mime))

    if not is_configured():
        return {"ok": False, "no_op": True, "confidence": 0.0,
                "error": "ocr_not_configured"}
    if not image_b64:
        return {"ok": False, "confidence": 0.0, "error": "empty_image"}

    try:
        raw = _call_vision(image_b64, mime)
        if not raw:
            return {"ok": False, "confidence": 0.0, "error": "no_json_from_model"}
        return _normalize(raw)
    except Exception as exc:  # noqa: BLE001
        logger.exception("OCR extraction failed: %s", exc)
        return {"ok": False, "confidence": 0.0, "error": str(exc)[:200]}
