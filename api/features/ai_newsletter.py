"""
Auto-Generated Monthly Newsletter — additive AI feature module.

Status: 🟡 Stub with spec.
Mounts at: /api/owner/ai/newsletter/*
Collections: reads many; writes draft into `campaigns` (existing) when sent.

Production implementation (estimated 10 hours):
- Monthly cron compiles for each tenant:
    {visits_total, new_customers, top_reviews, milestones,
     hero_image_from_card_template}
- LLM composes a warm one-page newsletter in the merchant's brand voice.
- Owner sees a draft in their inbox dashboard; one tap to send to all
  customers, or schedule, or discard.
- Cost: ~€0.01/tenant/month.
"""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from auth import require_role

router = APIRouter(tags=["ai-newsletter"])
_db = None


def init(db):
    global _db
    _db = db


@router.get("/api/owner/ai/newsletter/preview")
def preview(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: assemble real stats from owner analytics + reviews + LLM compose.
    return {
        "stub": True,
        "month_label": datetime.now(timezone.utc).strftime("%B %Y"),
        "headline": "Your business this month",
        "stats": {"visits": 0, "new_customers": 0, "revenue": 0},
        "draft_html": "<p>[Stub] When live, an LLM will assemble a "
                      "personalized monthly recap from your data + reviews.</p>",
    }
