"""
Competitive Heatmap — additive AI feature module.

Status: 🟡 Stub with spec. Returns mock report.
Mounts at: /api/owner/ai/competitive/*
Collections: writes `competitive_reports` (one per tenant per week).

Production implementation (estimated 14 hours):
- Inputs: tenant address (lat/lng) + customizable radius (default 1km).
- Sources:
    a) Google Places API: nearby businesses, ratings, review snippets.
       Cost: ~€0.02 per report (Google Places + Reviews fields).
    b) Optional Instagram public posts for the area (via a scraping service
       like ScraperAPI ~€20/mo flat, or skip if budget-constrained).
    c) Optional menu price scraping (per-merchant, fragile, defer).
- LLM (Claude Sonnet) summarizes findings into:
    {sentiment_trend, pricing_gap, trending_keywords, action_items}
- Generated weekly via cron, stored, served from cache.
- Cost: ~€0.05/tenant/week = €0.20/tenant/month.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import require_role

router = APIRouter(tags=["ai-competitive"])
_db = None


def init(db):
    global _db
    _db = db


class RadiusConfig(BaseModel):
    radius_meters: int = 1000


@router.get("/api/owner/ai/competitive/report")
def latest_report(token_data=Depends(require_role(["business_owner", "manager"]))):
    # TODO: replace with cached report from `competitive_reports` collection.
    return {
        "stub": True,
        "radius_meters": 1000,
        "competitor_count": 12,
        "headline": "Pumpkin spice trending in 4 nearby cafés this week.",
        "actions": [
            {"type": "pricing", "summary": "You charge €0.40 less than the area average for cappuccino."},
            {"type": "trend", "summary": "‘Wait time’ in 14 negative reviews of nearby cafés. Promote your speed."},
            {"type": "threat", "summary": "New café opened 200m away, gaining 50 reviews/week."},
        ],
        "sentiment_by_competitor": [
            {"name": "Le Croissant", "rating": 4.1, "trend": "down"},
            {"name": "Maison du Café", "rating": 4.6, "trend": "up"},
        ],
    }


@router.put("/api/owner/ai/competitive/config")
def update_config(
    cfg: RadiusConfig,
    token_data=Depends(require_role(["business_owner"])),
):
    # TODO: persist customizable radius in tenant config.
    return {"stub": True, "radius_meters": cfg.radius_meters}
