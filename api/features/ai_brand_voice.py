"""
Brand-Voice Matching — additive AI feature module.

Status: 🟡 Stub with spec. Returns mock voice profile.
Mounts at: /api/owner/ai/brand-voice/*
Collections: reads `campaigns` and `card_templates`. Writes `brand_voice_profiles`.

Production implementation (estimated 8 hours):
- Nightly job per tenant: collect last 50 campaigns + card text + business
  description.
- Use LLM (Claude Haiku) to extract a structured profile:
    {tone: warm|formal|punchy, address_form: tu|vous, emoji_density,
     signature_phrases: [...], vocabulary_examples: [...], avoid: [...]}
- Stored in `brand_voice_profiles` keyed by tenant_id.
- All other AI features (campaign drafting, birthday, voice-to-campaign,
  complaint-deflection) include this profile as a system-prompt prefix.
- Cost: ~€0.002/tenant/day = €0.06/tenant/month.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["ai-brand-voice"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/owner/ai/brand-voice/profile")
def get_profile(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: read brand_voice_profiles or compute on-demand from campaign corpus.
    return {
        "stub": True,
        "tone": "warm_poetic",
        "address_form": "vous",
        "emoji_density": 0.3,
        "signature_phrases": ["un instant de douceur", "comme à la maison", "merci"],
        "avoid": ["limited time", "act now", "exclamation overload"],
        "voice_match_score": 0.94,
        "trained_on_messages": 12,
        "last_updated": None,
    }


@router.post("/api/owner/ai/brand-voice/retrain")
def retrain(token_data=Depends(require_role(["business_owner"]))):
    # TODO: enqueue background job to recompute profile from latest corpus.
    return {"stub": True, "queued": True}
