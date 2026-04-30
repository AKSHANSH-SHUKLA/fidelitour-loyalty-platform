"""
Multi-Language Auto-Localization — additive AI feature module.

Status: 🟡 Stub with spec. Detects locale + returns mock translation.
Mounts at: /api/owner/ai/translate
Collections: reads `customer_extras` for stored locale preferences.

Production implementation (estimated 4 hours):
- Customer locale comes from one of:
    a) `customer_extras.values.preferred_language` (if merchant added that field)
    b) Accept-Language header captured at signup
    c) Phone country code heuristic
- Translation: any of DeepL (€20/mo flat), Google Translate (€20 / 1M chars),
  or LLM-as-translator (~€0.0002 per short message).
- Cache (text_hash, target_lang) → translation in `translation_cache` collection.
- Cost for typical merchant (5 campaigns/month × 500 customers × 30% non-French): ~€0.40/month.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict
from auth import require_role

router = APIRouter(tags=["ai-translate"])
_db = None


def init(db):
    global _db
    _db = db


class TranslateRequest(BaseModel):
    text: str
    target_languages: List[str] = ["en", "ar", "es"]


@router.post("/api/owner/ai/translate")
def translate(
    req: TranslateRequest,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    # TODO: call DeepL / Google Translate / LLM and cache by (hash, lang).
    return {
        "stub": True,
        "source": req.text,
        "translations": {lang: f"[{lang}] {req.text}" for lang in req.target_languages},
    }


@router.get("/api/owner/ai/translate/customer-locales")
def customer_locales(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: aggregate over customer_extras.values.preferred_language
    return {
        "stub": True,
        "by_locale": [
            {"locale": "fr", "customers": 412},
            {"locale": "en", "customers": 38},
            {"locale": "ar", "customers": 24},
        ],
    }
