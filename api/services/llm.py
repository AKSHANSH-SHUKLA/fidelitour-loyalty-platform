"""
LLM text helper — one thin function to turn a prompt into text.

Used by Le Conseiller (advisory phrasing) and any feature that wants a natural
French sentence over deterministic facts. Deliberately tiny: detection logic
stays rule-based and testable; the LLM only *phrases* what the rules found, so a
missing key or a bad model reply degrades to the caller's template, never a crash.

CONFIG
    LLM_PROVIDER   "groq" (default) | "nvidia"
    GROQ_API_KEY / NVIDIA_API_KEY   (already on Vercel)
    LLM_MODEL      optional override

SEAM
    _force_complete = callable(system, user) -> str   for deterministic tests.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.request
from typing import Optional

logger = logging.getLogger("fidelitour.llm")

_force_complete = None

_ENDPOINTS = {
    "groq": ("https://api.groq.com/openai/v1/chat/completions",
             "GROQ_API_KEY", "llama-3.3-70b-versatile"),
    "nvidia": ("https://integrate.api.nvidia.com/v1/chat/completions",
               "NVIDIA_API_KEY", "meta/llama-3.3-70b-instruct"),
}


def _provider() -> tuple:
    p = os.environ.get("LLM_PROVIDER", "groq").strip().lower()
    return _ENDPOINTS.get(p, _ENDPOINTS["groq"])


def is_configured() -> bool:
    _url, key_env, _model = _provider()
    return bool(os.environ.get(key_env, "").strip())


def complete(system: str, user: str, *, max_tokens: int = 400,
             temperature: float = 0.4) -> Optional[str]:
    """Return the model's text, or None if unavailable (caller falls back)."""
    if _force_complete is not None:
        return _force_complete(system, user)
    if not is_configured():
        return None
    url, key_env, default_model = _provider()
    key = os.environ.get(key_env, "").strip()
    model = os.environ.get("LLM_MODEL", "").strip() or default_model
    payload = {
        "model": model, "temperature": temperature, "max_tokens": max_tokens,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
    }
    try:
        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310
            data = json.loads(r.read().decode() or "{}")
        txt = (((data.get("choices") or [{}])[0]).get("message") or {}).get("content")
        return (txt or "").strip() or None
    except Exception as exc:  # noqa: BLE001
        logger.exception("LLM completion failed: %s", exc)
        return None
