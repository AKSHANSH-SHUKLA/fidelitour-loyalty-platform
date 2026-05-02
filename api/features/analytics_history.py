"""
Analytics History — extended new-customers history with configurable range.

Status: ✅ Implemented.
Mounts at: /api/owner/analytics/history/*
Collections: reads `customers` only.

Why this exists:
  The default `/api/owner/analytics` endpoint returns the last 12 weeks of
  new-customer signups. Owners want to see further back. This module adds
  two new endpoints that take a flexible time range without modifying the
  existing analytics endpoint.

Endpoints accept `unit` (days|weeks|months) + `count`, e.g.:
  /api/owner/analytics/history/new-customers?unit=weeks&count=52
  /api/owner/analytics/history/new-customers?unit=months&count=24
  /api/owner/analytics/history/new-customers?unit=all
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from auth import require_role

router = APIRouter(tags=["analytics-history"])
_db = None


def init(db):
    global _db
    _db = db


def _bucket_label(dt: datetime, unit: str) -> str:
    if unit == "days":
        return dt.strftime("%Y-%m-%d")
    if unit == "weeks":
        # ISO week — Monday-anchored
        iso_year, iso_week, _ = dt.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    if unit == "months":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


@router.get("/api/owner/analytics/history/new-customers")
def new_customers_history(
    unit: str = "weeks",        # days | weeks | months | all
    count: Optional[int] = None,  # how many units back; ignored if unit='all'
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    if unit not in ("days", "weeks", "months", "all"):
        raise HTTPException(status_code=400, detail="unit must be one of days|weeks|months|all")

    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)

    # Build the time window
    cutoff = None
    if unit == "all":
        # First customer ever for this tenant
        first = _db.customers.find_one({"tenant_id": tid}, sort=[("created_at", 1)])
        if first and first.get("created_at"):
            cutoff = first["created_at"]
        else:
            cutoff = now - timedelta(days=1)
    else:
        n = count if count and count > 0 else 12
        if unit == "days":
            cutoff = now - timedelta(days=n)
        elif unit == "weeks":
            cutoff = now - timedelta(weeks=n)
        elif unit == "months":
            cutoff = now - timedelta(days=n * 31)

    customers = list(_db.customers.find({
        "tenant_id": tid,
        "created_at": {"$gte": cutoff},
    }).sort("created_at", 1))

    bucket_unit = "weeks" if unit == "all" else unit
    if unit == "all":
        # Choose granularity based on date span
        days_span = (now - cutoff).days
        if days_span > 365 * 2:
            bucket_unit = "months"
        elif days_span > 90:
            bucket_unit = "weeks"
        else:
            bucket_unit = "days"

    bucket_counts: dict[str, int] = {}
    for c in customers:
        ts = c.get("created_at")
        if not ts:
            continue
        key = _bucket_label(ts, bucket_unit)
        bucket_counts[key] = bucket_counts.get(key, 0) + 1

    series = [{"label": k, "count": v} for k, v in sorted(bucket_counts.items())]
    return {
        "unit_requested": unit,
        "bucket_unit": bucket_unit,
        "from": cutoff.isoformat(),
        "to": now.isoformat(),
        "total_new_customers": len(customers),
        "series": series,
    }


@router.get("/api/owner/analytics/history/visits")
def visits_history(
    unit: str = "weeks",
    count: Optional[int] = None,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    """Companion endpoint — visits over a configurable range (used by #6 chart)."""
    if unit not in ("days", "weeks", "months", "all"):
        raise HTTPException(status_code=400, detail="unit must be one of days|weeks|months|all")

    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)

    if unit == "all":
        first = _db.visits.find_one({"tenant_id": tid}, sort=[("visit_time", 1)])
        cutoff = (first.get("visit_time") if first else None) or (now - timedelta(days=1))
    else:
        n = count if count and count > 0 else 12
        if unit == "days":
            cutoff = now - timedelta(days=n)
        elif unit == "weeks":
            cutoff = now - timedelta(weeks=n)
        else:
            cutoff = now - timedelta(days=n * 31)

    visits = list(_db.visits.find({
        "tenant_id": tid,
        "visit_time": {"$gte": cutoff},
    }))

    bucket_unit = "weeks" if unit == "all" else unit
    if unit == "all":
        days_span = (now - cutoff).days
        bucket_unit = "months" if days_span > 365 * 2 else ("weeks" if days_span > 90 else "days")

    bucket_counts: dict[str, int] = {}
    for v in visits:
        ts = v.get("visit_time")
        if not ts:
            continue
        key = _bucket_label(ts, bucket_unit)
        bucket_counts[key] = bucket_counts.get(key, 0) + 1

    series = [{"label": k, "count": v} for k, v in sorted(bucket_counts.items())]
    return {
        "unit_requested": unit,
        "bucket_unit": bucket_unit,
        "from": cutoff.isoformat(),
        "to": now.isoformat(),
        "total_visits": len(visits),
        "series": series,
    }


@router.get("/api/owner/analytics/history/visits-with-campaigns")
def visits_with_campaigns(
    days: int = 30,
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    """Powers the visits-by-day chart with campaign send markers overlaid.

    Returns daily visit counts for the last N days plus every campaign sent in
    that window. The frontend draws bars for visits and a coloured marker on
    the day each campaign was sent — clicking the marker reveals the campaign.
    """
    if days <= 0 or days > 730:
        days = 30

    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    # Build daily buckets (always include zero-visit days so the chart is contiguous)
    buckets: dict[str, int] = {}
    for i in range(days, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        buckets[d] = 0

    visits = list(_db.visits.find({
        "tenant_id": tid,
        "visit_time": {"$gte": cutoff},
    }))
    for v in visits:
        ts = v.get("visit_time")
        if not ts:
            continue
        key = ts.strftime("%Y-%m-%d")
        if key in buckets:
            buckets[key] += 1

    visit_series = [{"date": k, "visits": v} for k, v in sorted(buckets.items())]

    # Campaigns with a sent_at in the window
    campaigns = list(_db.campaigns.find({
        "tenant_id": tid,
        "status": {"$in": ["sent", "delivered"]},
        "sent_at": {"$gte": cutoff},
    }).sort("sent_at", 1))

    campaign_markers = []
    for c in campaigns:
        sent_at = c.get("sent_at")
        if not sent_at:
            continue
        campaign_markers.append({
            "id": c.get("id"),
            "name": c.get("name") or "(untitled)",
            "sent_at": sent_at,
            "sent_date": sent_at.strftime("%Y-%m-%d"),
            "status": c.get("status"),
            "targeted_count": c.get("targeted_count", 0),
            "delivered_count": c.get("delivered_count", 0),
            "opens": c.get("opens", 0),
            "clicks": c.get("clicks", 0),
            "visits_from_campaign": c.get("visits_from_campaign", 0),
            "content_preview": (c.get("content") or "")[:200],
        })

    return {
        "from": cutoff.isoformat(),
        "to": now.isoformat(),
        "days": days,
        "visit_series": visit_series,
        "campaign_markers": campaign_markers,
        "totals": {
            "visits": sum(b["visits"] for b in visit_series),
            "campaigns_sent": len(campaign_markers),
        },
    }


@router.get("/api/owner/analytics/history/visits-on-day")
def visits_on_day(
    date: str,                                  # YYYY-MM-DD
    token_data=Depends(require_role(["business_owner", "manager"])),
):
    """List the customers who visited on a specific day.

    Powers the click-on-bar drill-down inside the "Visits with campaign markers"
    chart on the Analytics page. Returns one row per visit (so a single
    customer who visited twice that day shows up twice — sorted by visit_time).

    Each row includes enough customer data to render a useful list inline:
    name, email, phone, tier, total points, total visits, and the visit's
    own amount_paid + points_awarded.
    """
    if not date or len(date) != 10:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    try:
        day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid date format")
    day_end = day_start + timedelta(days=1)
    tid = token_data.tenant_id

    visits = list(_db.visits.find({
        "tenant_id": tid,
        "visit_time": {"$gte": day_start, "$lt": day_end},
    }).sort("visit_time", 1))

    # Hydrate customer info with one batched query (cheaper than N find_ones).
    cust_ids = list({v.get("customer_id") for v in visits if v.get("customer_id")})
    customers_by_id: dict[str, dict] = {}
    if cust_ids:
        for c in _db.customers.find({"id": {"$in": cust_ids}}):
            customers_by_id[c["id"]] = c

    rows = []
    total_revenue = 0.0
    for v in visits:
        cid = v.get("customer_id")
        c = customers_by_id.get(cid) or {}
        amount = float(v.get("amount_paid") or 0)
        total_revenue += amount
        ts = v.get("visit_time")
        rows.append({
            "visit_id": v.get("id"),
            "visit_time": ts.isoformat() if isinstance(ts, datetime) else None,
            "amount_paid": amount,
            "points_awarded": int(v.get("points_awarded") or 0),
            "customer_id": cid,
            "name": c.get("name") or "—",
            "email": c.get("email") or "",
            "phone": c.get("phone") or "",
            "tier": c.get("tier") or "bronze",
            "total_points": int(c.get("points") or 0),
            "total_visits": int(c.get("visits") or 0),
            "barcode_id": c.get("barcode_id") or "",
        })

    return {
        "date": date,
        "visits_count": len(rows),
        "unique_customers": len({r["customer_id"] for r in rows if r["customer_id"]}),
        "total_revenue": round(total_revenue, 2),
        "rows": rows,
    }
