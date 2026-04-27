from datetime import datetime, timezone, timedelta
import uuid
import random
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    UserInDB, UserCreate, Tenant, Customer, Visit, CardTemplate, Campaign, PaymentTransaction, AIQueryRequest,
    PLAN_FEATURES, PLAN_PRICES, TierDesign,
    CardPromotion, CardDetails, CardTypedNotification,
    Review,
)
from auth import (
    hash_password, verify_password, create_access_token, get_current_user_data,
    require_role, check_plan_feature, TokenData, ACCESS_TOKEN_EXPIRE_MINUTES
)

import os
import pymongo
import hashlib
import base64
from io import BytesIO

# Setup FastAPI App
app = FastAPI(title="FidéliTour API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Initialization — synchronous pymongo for Vercel serverless reliability
MONGODB_URI = os.environ.get("MONGODB_URI", "")

if MONGODB_URI:
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True)
    db = client.fidelitour_db
else:
    client = pymongo.MongoClient(tz_aware=True)
    db = client.fidelitour_db

# SendGrid email config
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDGRID_FROM_EMAIL = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@fidelitour.com")

# ============================================================
# France-wide postal code → (lat, lng, department_name) mapping
# Keyed by 2-digit department prefix. Covers all 96 metropolitan departments.
# Individual well-known city postal codes override at full-5-digit granularity.
# ============================================================
FRENCH_DEPARTMENTS = {
    "01": ("Ain", 46.20, 5.22), "02": ("Aisne", 49.56, 3.62), "03": ("Allier", 46.39, 3.19),
    "04": ("Alpes-de-Haute-Provence", 44.10, 6.24), "05": ("Hautes-Alpes", 44.66, 6.42),
    "06": ("Alpes-Maritimes", 43.93, 7.21), "07": ("Ardèche", 44.75, 4.42),
    "08": ("Ardennes", 49.61, 4.62), "09": ("Ariège", 42.93, 1.52), "10": ("Aube", 48.32, 4.17),
    "11": ("Aude", 43.11, 2.45), "12": ("Aveyron", 44.28, 2.57),
    "13": ("Bouches-du-Rhône", 43.50, 5.10), "14": ("Calvados", 49.08, -0.28),
    "15": ("Cantal", 45.06, 2.65), "16": ("Charente", 45.73, 0.24),
    "17": ("Charente-Maritime", 45.82, -0.69), "18": ("Cher", 47.06, 2.46),
    "19": ("Corrèze", 45.36, 1.87), "21": ("Côte-d'Or", 47.50, 4.85),
    "22": ("Côtes-d'Armor", 48.47, -2.98), "23": ("Creuse", 46.08, 2.03),
    "24": ("Dordogne", 45.14, 0.72), "25": ("Doubs", 47.22, 6.48),
    "26": ("Drôme", 44.74, 5.26), "27": ("Eure", 49.17, 1.16),
    "28": ("Eure-et-Loir", 48.46, 1.35), "29": ("Finistère", 48.22, -4.10),
    "2A": ("Corse-du-Sud", 41.93, 8.94), "2B": ("Haute-Corse", 42.35, 9.29),
    "30": ("Gard", 44.04, 4.22), "31": ("Haute-Garonne", 43.45, 1.34),
    "32": ("Gers", 43.64, 0.58), "33": ("Gironde", 44.85, -0.57),
    "34": ("Hérault", 43.61, 3.55), "35": ("Ille-et-Vilaine", 48.17, -1.52),
    "36": ("Indre", 46.75, 1.52), "37": ("Indre-et-Loire", 47.29, 0.68),
    "38": ("Isère", 45.25, 5.75), "39": ("Jura", 46.75, 5.69),
    "40": ("Landes", 43.93, -0.73), "41": ("Loir-et-Cher", 47.58, 1.37),
    "42": ("Loire", 45.57, 4.27), "43": ("Haute-Loire", 45.10, 3.83),
    "44": ("Loire-Atlantique", 47.35, -1.73), "45": ("Loiret", 47.83, 2.38),
    "46": ("Lot", 44.62, 1.60), "47": ("Lot-et-Garonne", 44.35, 0.62),
    "48": ("Lozère", 44.56, 3.49), "49": ("Maine-et-Loire", 47.37, -0.49),
    "50": ("Manche", 49.11, -1.30), "51": ("Marne", 48.97, 4.37),
    "52": ("Haute-Marne", 48.11, 5.14), "53": ("Mayenne", 48.14, -0.72),
    "54": ("Meurthe-et-Moselle", 48.70, 6.20), "55": ("Meuse", 48.97, 5.37),
    "56": ("Morbihan", 47.87, -2.79), "57": ("Moselle", 49.02, 6.66),
    "58": ("Nièvre", 47.12, 3.59), "59": ("Nord", 50.47, 3.15),
    "60": ("Oise", 49.42, 2.42), "61": ("Orne", 48.63, 0.12),
    "62": ("Pas-de-Calais", 50.52, 2.50), "63": ("Puy-de-Dôme", 45.77, 3.08),
    "64": ("Pyrénées-Atlantiques", 43.30, -0.77), "65": ("Hautes-Pyrénées", 43.07, 0.15),
    "66": ("Pyrénées-Orientales", 42.60, 2.66), "67": ("Bas-Rhin", 48.58, 7.73),
    "68": ("Haut-Rhin", 47.91, 7.30), "69": ("Rhône", 45.75, 4.85),
    "70": ("Haute-Saône", 47.62, 6.15), "71": ("Saône-et-Loire", 46.65, 4.52),
    "72": ("Sarthe", 48.00, 0.20), "73": ("Savoie", 45.57, 6.52),
    "74": ("Haute-Savoie", 46.00, 6.43), "75": ("Paris", 48.8566, 2.3522),
    "76": ("Seine-Maritime", 49.67, 1.00), "77": ("Seine-et-Marne", 48.62, 2.95),
    "78": ("Yvelines", 48.80, 1.90), "79": ("Deux-Sèvres", 46.55, -0.23),
    "80": ("Somme", 49.92, 2.30), "81": ("Tarn", 43.79, 2.15),
    "82": ("Tarn-et-Garonne", 44.08, 1.35), "83": ("Var", 43.47, 6.27),
    "84": ("Vaucluse", 44.00, 5.15), "85": ("Vendée", 46.67, -1.35),
    "86": ("Vienne", 46.57, 0.47), "87": ("Haute-Vienne", 45.84, 1.26),
    "88": ("Vosges", 48.20, 6.46), "89": ("Yonne", 47.85, 3.55),
    "90": ("Territoire de Belfort", 47.62, 6.87), "91": ("Essonne", 48.53, 2.25),
    "92": ("Hauts-de-Seine", 48.85, 2.23), "93": ("Seine-Saint-Denis", 48.92, 2.47),
    "94": ("Val-de-Marne", 48.77, 2.47), "95": ("Val-d'Oise", 49.08, 2.17),
    "97": ("Outre-mer", 16.25, -61.55), "98": ("Outre-mer", -21.11, 55.53),
}

# Fine-grained overrides for major city postal codes (lat, lng)
POSTAL_CODE_OVERRIDES = {
    "37000": (47.3941, 0.6848), "37100": (47.4210, 0.6840),
    "37200": (47.3741, 0.6900), "37300": (47.3800, 0.7000),
    "75001": (48.8606, 2.3376), "75008": (48.8722, 2.3108),
    "69001": (45.7678, 4.8336), "13001": (43.2976, 5.3810),
    "33000": (44.8378, -0.5792), "59000": (50.6292, 3.0573),
    "44000": (47.2184, -1.5536), "31000": (43.6047, 1.4442),
    "06000": (43.7102, 7.2620), "34000": (43.6108, 3.8767),
    "67000": (48.5734, 7.7521),
}

def get_postal_coords(postal_code: str):
    """Return (lat, lng) for a French postal code. Falls back through overrides → department → Paris."""
    if not postal_code:
        return (48.8566, 2.3522)
    postal_code = str(postal_code).strip()
    # 1. Exact override (major cities)
    if postal_code in POSTAL_CODE_OVERRIDES:
        return POSTAL_CODE_OVERRIDES[postal_code]
    # 2. Department-level (first 2 chars). Corsica handled specially (20xxx → 2A/2B).
    if len(postal_code) >= 2:
        prefix = postal_code[:2]
        if prefix == "20":
            # Corsica: 200xx-201xx are 2A (Corse-du-Sud), 202xx-206xx are 2B (Haute-Corse)
            try:
                n = int(postal_code[:3])
                prefix = "2A" if n < 202 else "2B"
            except ValueError:
                prefix = "2A"
        elif postal_code[:2] in ("97", "98"):
            prefix = postal_code[:2]
        if prefix in FRENCH_DEPARTMENTS:
            _, lat, lng = FRENCH_DEPARTMENTS[prefix]
            return (lat, lng)
    # 3. Default to Paris
    return (48.8566, 2.3522)

def get_department_info(postal_code: str):
    """Return (department_code, department_name) for a French postal code."""
    if not postal_code:
        return ("75", "Paris")
    postal_code = str(postal_code).strip()
    if len(postal_code) < 2:
        return ("75", "Paris")
    prefix = postal_code[:2]
    if prefix == "20":
        try:
            n = int(postal_code[:3])
            prefix = "2A" if n < 202 else "2B"
        except ValueError:
            prefix = "2A"
    if prefix in FRENCH_DEPARTMENTS:
        name, _, _ = FRENCH_DEPARTMENTS[prefix]
        return (prefix, name)
    return ("75", "Paris")

# Backward-compat alias (used by legacy code paths)
POSTAL_CODE_CENTROIDS = POSTAL_CODE_OVERRIDES

# 1x1 transparent PNG (base64)
PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
PIXEL_PNG_BYTES = base64.b64decode(PIXEL_PNG_BASE64)

# ============================================================
# Template variable renderer — substitutes {name}, {first_name},
# {tier}, {points}, {points_to_next_reward}, {business_name},
# {visits}, {amount_paid}. Used by every email / push send path
# so personalised offers ("Bonjour {first_name}, il te reste
# {points_to_next_reward} points pour une récompense !") work.
# ============================================================
def _compute_points_to_next_reward(customer: dict, tenant_id: str) -> int:
    """How many more visits (≈ points) until the next reward for this customer."""
    try:
        tpl = db.card_templates.find_one({"tenant_id": tenant_id}) or {}
        visits_per_stamp = max(int(tpl.get("visits_per_stamp", 1) or 1), 1)
        reward_threshold_stamps = max(int(tpl.get("reward_threshold_stamps", 10) or 10), 1)
        visits_needed = visits_per_stamp * reward_threshold_stamps
        visits = int(customer.get("visits", 0) or 0)
        remaining_visits = visits_needed - (visits % visits_needed)
        # When exactly on threshold, remaining_visits == visits_needed (fresh card).
        return remaining_visits
    except Exception:
        return 0


def render_template(content: str, customer: dict, tenant: dict = None) -> str:
    """Replace curly-brace placeholders in a campaign body with per-customer values.
    Missing values are silently replaced with a neutral fallback so the message never
    renders a literal `{name}` to the recipient.
    """
    if not content:
        return ""
    try:
        name = customer.get("name") or "cher client"
        first_name = name.split(" ")[0] if name else "cher client"
        tier = (customer.get("tier") or "bronze").title()
        points = int(customer.get("points", customer.get("visits", 0) * 10) or 0)
        visits = int(customer.get("visits", 0) or 0)
        amount_paid = round(float(customer.get("total_amount_paid", 0) or 0), 2)
        business_name = (tenant or {}).get("name") or "notre boutique"
        ptnr = _compute_points_to_next_reward(customer, customer.get("tenant_id") or (tenant or {}).get("id"))

        replacements = {
            "{name}": name,
            "{first_name}": first_name,
            "{tier}": tier,
            "{points}": str(points),
            "{points_remaining}": str(ptnr),
            "{points_to_next_reward}": str(ptnr),
            "{visits}": str(visits),
            "{amount_paid}": f"{amount_paid:.2f}€",
            "{business_name}": business_name,
            "{sector}": (tenant or {}).get("sector", ""),
        }
        rendered = content
        for token, value in replacements.items():
            rendered = rendered.replace(token, str(value))
        return rendered
    except Exception:
        return content


def send_email_to_customer(to_email: str, from_name: str, subject: str, body_html: str) -> bool:
    """Best-effort SendGrid dispatch. Returns True on successful send or on missing
    SendGrid config (treat as mock-delivered for dashboards). Returns False only on
    an actual network error during send.
    """
    if not to_email:
        return False
    if not SENDGRID_API_KEY:
        return True  # mock delivery
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To
        sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
        message = Mail(
            from_email=Email(SENDGRID_FROM_EMAIL, from_name),
            to_emails=To(to_email),
            subject=subject,
            html_content=body_html,
        )
        sg.send(message)
        return True
    except Exception as e:
        print(f"send_email_to_customer error to {to_email}: {e}")
        return False


def _campaign_html(tenant_name: str, subject: str, rendered_body: str, customer: dict, image_url: Optional[str] = None) -> str:
    """Consistent branded email wrapper used by every campaign dispatch path.

    Optional `image_url` renders a hero image at the top of the email — either
    a full URL (https://...) or a data URL from a local upload.
    """
    tier_title = (customer.get("tier") or "bronze").title()
    points = int(customer.get("points", customer.get("visits", 0) * 10) or 0)
    visits = int(customer.get("visits", 0) or 0)
    # Preserve newlines as <br>
    body_html = (rendered_body or "").replace("\n", "<br>")

    image_block = ""
    if image_url:
        image_block = f"""
    <div style="margin:-30px -30px 25px -30px;border-top-left-radius:12px;border-top-right-radius:12px;overflow:hidden;">
      <img src="{image_url}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover;" />
    </div>"""

    return f"""
<div style="font-family:'Manrope',Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;background:#FDFBF7;">
  <div style="text-align:center;margin-bottom:30px;">
    <h1 style="font-family:'Georgia',serif;color:#1C1917;font-size:28px;margin-bottom:5px;">{tenant_name}</h1>
    <div style="width:50px;height:3px;background:#B85C38;margin:0 auto;"></div>
  </div>
  <div style="background:white;border-radius:12px;padding:30px;border:1px solid #E7E5E4;overflow:hidden;">{image_block}
    <h2 style="color:#B85C38;font-size:22px;margin-bottom:15px;">{subject}</h2>
    <p style="color:#57534E;line-height:1.6;font-size:16px;">{body_html}</p>
    <div style="margin-top:25px;padding:15px;background:#F3EFE7;border-radius:8px;text-align:center;">
      <p style="color:#B85C38;font-weight:600;font-size:14px;">Statut fidélité : {tier_title}</p>
      <p style="color:#57534E;font-size:13px;">Points: {points} | Visites: {visits}</p>
    </div>
  </div>
  <p style="text-align:center;color:#A8A29E;font-size:12px;margin-top:25px;">Envoyé via FidéliTour</p>
</div>
"""

class LoginRequest(BaseModel):
    email: str
    password: str

NAMES_POOL = [
    "Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Laurent", "Luc Moreau", "Emma Petit",
    "Thomas Dubois", "Julie Mercier", "Olivier Fontaine", "Isabelle Arnould", "David Rousseau",
    "Claire Leblanc", "Marc Renard", "Francoise Deschamps", "Philippe Marchand",
    "Antoine Leroy", "Camille Faure", "Nicolas Girard", "Léa Bonnet", "Hugo Lefevre",
    "Chloé Moreau", "Maxime Durand", "Inès Fontaine", "Lucas Blanc", "Sarah Meyer",
    "Paul Robert", "Louise Perrin", "Gabriel Noël", "Alice Chevalier", "Raphaël Bertrand",
    "Manon Garnier", "Jules Perez", "Zoé Lambert", "Arthur Henry", "Juliette Rolland",
    "Théo Roche", "Jade Simon", "Nathan Muller", "Rose Nicolas", "Ethan Carpentier",
    "Adèle Vasseur", "Liam Mercadier", "Mila Charpentier", "Tom Fournier", "Eva Pasquier",
    "Sacha Boulanger", "Anaïs Thibault", "Léon Boucher", "Margaux Ferrand", "Noah Dumont",
]

# Sector-specific archetypes — drives realistic visit cadence, ticket size and
# tier distribution per business type. The numbers reflect French SMB norms
# (café avg ticket ≈ €5, fine dining ≈ €45, gym monthly cadence, etc).
SECTOR_PROFILES = {
    "cafe":       {"visits_per_year": (40, 120), "avg_ticket": (3.5, 7.0),  "open_hours": (7, 19)},
    "boulangerie":{"visits_per_year": (60, 200), "avg_ticket": (3.0, 6.5),  "open_hours": (6, 19)},
    "restaurant": {"visits_per_year": (3,  10),  "avg_ticket": (28, 55),    "open_hours": (12, 22)},
    "brasserie":  {"visits_per_year": (4,  14),  "avg_ticket": (22, 42),    "open_hours": (12, 23)},
    "creperie":   {"visits_per_year": (4,  12),  "avg_ticket": (15, 28),    "open_hours": (12, 22)},
    "burger":     {"visits_per_year": (6,  18),  "avg_ticket": (12, 22),    "open_hours": (11, 23)},
    "kebab":      {"visits_per_year": (10, 30),  "avg_ticket": (8,  14),    "open_hours": (11, 23)},
    "pizzeria":   {"visits_per_year": (6,  20),  "avg_ticket": (14, 26),    "open_hours": (11, 23)},
    "spa":        {"visits_per_year": (3,  10),  "avg_ticket": (55, 110),   "open_hours": (10, 19)},
    "gym":        {"visits_per_year": (60, 180), "avg_ticket": (40, 60),    "open_hours": (6, 22)},
    "juice_bar":  {"visits_per_year": (12, 40),  "avg_ticket": (5.5, 11),   "open_hours": (8, 19)},
    "ice_cream":  {"visits_per_year": (3,  12),  "avg_ticket": (4.5, 9),    "open_hours": (12, 22)},
    "chocolatier":{"visits_per_year": (4,  12),  "avg_ticket": (12, 28),    "open_hours": (10, 19)},
    "florist":    {"visits_per_year": (3,   9),  "avg_ticket": (18, 45),    "open_hours": (9, 19)},
    "bookstore":  {"visits_per_year": (4,  12),  "avg_ticket": (15, 30),    "open_hours": (10, 19)},
    "wine_bar":   {"visits_per_year": (8,  24),  "avg_ticket": (16, 38),    "open_hours": (17, 23)},
    "default":    {"visits_per_year": (5,  15),  "avg_ticket": (10, 22),    "open_hours": (9, 20)},
}

def _profile_for_tenant(tenant_id: str, sector: Optional[str] = None) -> dict:
    """Pick a sector profile, falling back to a slug-based heuristic."""
    if sector and sector in SECTOR_PROFILES:
        return SECTOR_PROFILES[sector]
    slug = (tenant_id or "").lower()
    for key in SECTOR_PROFILES:
        if key in slug:
            return SECTOR_PROFILES[key]
    return SECTOR_PROFILES["default"]


def generate_varied_customers(
    tenant_id: str,
    count: int = 15,
    *,
    sector: Optional[str] = None,
    branch_ids: Optional[List[str]] = None,
    months_history: int = 14,
) -> List[dict]:
    """Generate hyper-realistic customers for one tenant.

    Visit counts and avg tickets follow real French SMB norms per sector
    (a café customer comes 40-120×/yr at €3-7; a restaurant regular comes
    3-10×/yr at €28-55). Tier distribution follows the long-tail pattern
    seen in real loyalty programs: roughly 65% bronze / 25% silver /
    8% gold / 2% VIP.
    """
    customers = []
    profile = _profile_for_tenant(tenant_id, sector)
    branch_ids = branch_ids or []

    # Postal-code mix — Tours-heavy with Paris/Lyon spillover, matching
    # the platform's primary launch geography.
    postal_codes = (
        ["37000"] * 5 + ["37100"] * 4 + ["37200"] * 3 + ["37300"] * 2 +
        ["75001", "75008", "75011"] +
        ["69001", "69002"] +
        ["13001", "33000", "44000", "31000", "59000", "06000", "67000", "34000"]
    )
    # Acquisition mix — heavy on QR (in-store sign-up dominates), then
    # social channels in declining order. Matches the realistic split
    # owners report when surveyed.
    acquisition_sources = (
        ["qr_store"] * 50 + ["instagram"] * 30 + ["facebook"] * 15 + ["tiktok"] * 5
    )

    now = datetime.now(timezone.utc)
    history_days = months_history * 30
    annual_min, annual_max = profile["visits_per_year"]
    ticket_min, ticket_max = profile["avg_ticket"]

    for i in range(count):
        # Years on the program — exponential-ish: most are recent joiners,
        # a few are veterans. Capped at the history window.
        days_since_signup = int(min(
            history_days,
            random.expovariate(1 / (history_days / 3))
        ))
        years_active = max(days_since_signup / 365.0, 0.05)

        # Engagement multiplier per customer — most are average, some are
        # superfans. Long-tail with Pareto-like skew.
        engagement = random.choices(
            [0.2, 0.4, 0.7, 1.0, 1.4, 2.0, 3.0],
            weights=[10, 18, 22, 22, 14, 9, 5],
            k=1,
        )[0]

        annual_visits = random.uniform(annual_min, annual_max) * engagement
        visits = max(0, int(round(annual_visits * years_active)))

        avg_ticket = random.uniform(ticket_min, ticket_max)
        # Add per-customer ticket noise so spend doesn't perfectly track visits.
        spend_noise = random.uniform(0.85, 1.15)
        total_spent = round(visits * avg_ticket * spend_noise, 2)

        # Tier — driven by visits AND ticket size, matching realistic
        # loyalty cohorts (frequent + premium = VIP).
        if visits >= 40 or (visits >= 12 and avg_ticket >= 60):
            tier = "vip"
        elif visits >= 20 or (visits >= 8 and avg_ticket >= 45):
            tier = "gold"
        elif visits >= 8:
            tier = "silver"
        else:
            tier = "bronze"

        pass_issued = visits >= 3 and random.random() < 0.85

        last_visit = None
        if visits > 0:
            # Recently-active customers cluster in the last 30 days; quieter
            # ones drift back. Linear distribution roughly captures that.
            recency_bias = random.choices(
                [7, 21, 60, 120, 300],
                weights=[30, 30, 22, 12, 6],
                k=1,
            )[0]
            last_visit = now - timedelta(days=random.randint(1, recency_bias))

        join_date = now - timedelta(days=days_since_signup)
        primary_branch = random.choice(branch_ids) if branch_ids else None

        customers.append(Customer(
            id=f"c-{tenant_id}-{i:03d}" if not tenant_id.startswith("tenant-") else f"c-{i}",
            tenant_id=tenant_id,
            barcode_id=f"FT-{uuid.uuid4().hex[:8].upper()}",
            name=NAMES_POOL[i % len(NAMES_POOL)],
            email=f"customer{i}@{(tenant_id or 'demo').replace('_','-')}.fr",
            phone=f"06{random.randint(10000000, 99999999)}",
            postal_code=random.choice(postal_codes),
            birthday=f"{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            points=visits * 10,
            visits=visits,
            total_amount_paid=total_spent,
            tier=tier,
            pass_issued=pass_issued,
            last_visit_date=last_visit,
            acquisition_source=random.choices(acquisition_sources, k=1)[0],
            branch_id=primary_branch,
            created_at=join_date,
        ).model_dump())

    return customers


def generate_visits(
    tenant_id: str,
    customer_ids: List[str],
    days_back: int = 365,
    *,
    sector: Optional[str] = None,
    branch_ids: Optional[List[str]] = None,
    customers: Optional[List[dict]] = None,
) -> List[dict]:
    """Generate realistic visit history.

    Visits are scheduled within the customer's actual visit count (not
    randomly across everyone), spread across a 12-month window with a
    natural weekday/weekend curve. Hours follow the sector's typical
    open hours, with lunch and dinner peaks for food businesses.
    """
    visits = []
    profile = _profile_for_tenant(tenant_id, sector)
    open_h, close_h = profile["open_hours"]
    branch_ids = branch_ids or []

    # Map customer_id → visit count + avg ticket so we can reproduce the
    # totals stored on each customer doc.
    by_id = {}
    if customers:
        for c in customers:
            by_id[c["id"]] = c

    now = datetime.now(timezone.utc)
    ticket_min, ticket_max = profile["avg_ticket"]

    for cid in customer_ids:
        cust = by_id.get(cid)
        n_visits = (cust or {}).get("visits", random.randint(0, 8))
        if n_visits <= 0:
            continue

        # Spread the customer's visits over the days_back window with a
        # weekly-cycle bias — roughly +25% likelihood Fri/Sat for hospitality.
        for _ in range(n_visits):
            day_offset = int(random.triangular(0, days_back, days_back * 0.4))
            visit_day = now - timedelta(days=day_offset)
            # Lunch / dinner peaks for food sectors
            if open_h <= 12 and close_h >= 14 and random.random() < 0.4:
                hour = random.choice([12, 13])
            elif open_h <= 19 and close_h >= 21 and random.random() < 0.3:
                hour = random.choice([19, 20])
            else:
                hour = random.randint(open_h, max(open_h, close_h - 1))
            visit_time = visit_day.replace(
                hour=hour,
                minute=random.randint(0, 59),
                second=0,
                microsecond=0,
            )
            amount = round(random.uniform(ticket_min, ticket_max) * random.uniform(0.85, 1.2), 2)
            visits.append(Visit(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                customer_id=cid,
                points_awarded=max(1, int(amount / 5)),
                amount_paid=amount,
                branch_id=random.choice(branch_ids) if branch_ids else None,
                visit_time=visit_time,
                created_at=visit_time,
            ).model_dump())

    return visits

def mock_seed_data():
    # Check and seed admin user
    if not db.users.find_one({"email": "admin@fidelitour.com"}):
        admin_user = UserInDB(
            email="admin@fidelitour.com",
            role="super_admin",
            hashed_password=hash_password("Fidelit0ur!Adm")
        )
        db.users.insert_one(admin_user.model_dump())

    # === Café Lumière (tenant-1, Gold plan) ===
    # Check and seed tenant
    if not db.tenants.find_one({"slug": "cafe-lumiere"}):
        t1 = Tenant(
            slug="cafe-lumiere",
            name="Café Lumière",
            plan="gold",
            address="123 Rue de Paris, Tours",
            phone="01-23-45-67-89",
            website="cafe-lumiere.fr",
            id="tenant-1",
            geo_enabled=True,
            geo_radius_meters=500,
            geo_cooldown_days=1,
            branches=[
                {
                    "id": "branch-lumiere-main",
                    "name": "Café Lumière - Main",
                    "address": "123 Rue de Paris, Tours",
                    "postal_code": "37100",
                    "phone": "01-23-45-67-89",
                    "is_main": True
                },
                {
                    "id": "branch-lumiere-plumereau",
                    "name": "Café Lumière - Plumereau",
                    "address": "456 Place Plumereau, Tours",
                    "postal_code": "37000",
                    "phone": "01-23-45-67-90",
                    "is_main": False
                }
            ]
        )
        db.tenants.insert_one(t1.model_dump())

    # Check and seed owner user
    if not db.users.find_one({"email": "owner@cafelumiere.fr"}):
        u1 = UserInDB(
            email="owner@cafelumiere.fr",
            role="business_owner",
            tenant_id="tenant-1",
            hashed_password=hash_password("CafeLum!2026")
        )
        db.users.insert_one(u1.model_dump())

    # Check and seed customers — Café Lumière is a 2-branch café in Tours.
    # Reseed when count is low OR when the customers haven't been tagged to a
    # branch yet (legacy data from before branch_id was wired into the seed).
    cafe_branches = ["branch-lumiere-main", "branch-lumiere-plumereau"]
    needs_cafe_reseed = (
        db.customers.count_documents({"tenant_id": "tenant-1"}) < 80
        or db.customers.count_documents({"tenant_id": "tenant-1", "branch_id": {"$in": cafe_branches}}) == 0
    )
    if needs_cafe_reseed:
        db.customers.delete_many({"tenant_id": "tenant-1"})
        # 110 customers — realistic for a busy independent café in central Tours.
        customers_data = generate_varied_customers(
            "tenant-1",
            110,
            sector="cafe",
            branch_ids=cafe_branches,
            months_history=14,
        )
        # Branch volume split — main flagship gets 65% of customers, the
        # second location 35%. Reflects how multi-site cafés actually balance.
        for i, c in enumerate(customers_data):
            c["branch_id"] = cafe_branches[0] if i % 100 < 65 else cafe_branches[1]
        db.customers.insert_many(customers_data)

        customer_ids = [c["id"] for c in customers_data]
        db.visits.delete_many({"tenant_id": "tenant-1"})
        visits_data = generate_visits(
            "tenant-1",
            customer_ids,
            days_back=420,                # 14 months of history
            sector="cafe",
            branch_ids=cafe_branches,
            customers=customers_data,
        )
        if visits_data:
            db.visits.insert_many(visits_data)

    # Check and seed campaigns (at least 3 with proper dates)
    # Reseed when:
    #  • there aren't enough demo campaigns (fresh tenant), OR
    #  • the existing camp-1 was seeded before the image_url field landed —
    #    detected by camp-1 missing image_url. This one-time refresh is what
    #    makes the "Promo Printemps" example actually visible to existing
    #    deploys instead of being permanently shadowed by old seed data.
    existing_camp1 = db.campaigns.find_one({"id": "camp-1", "tenant_id": "tenant-1"})
    needs_reseed = (
        db.campaigns.count_documents({"tenant_id": "tenant-1"}) < 3
        or (existing_camp1 is not None and not existing_camp1.get("image_url"))
    )
    if needs_reseed:
        db.campaigns.delete_many({"tenant_id": "tenant-1"})
        # Wipe stale per-recipient tracking rows for the demo campaigns so
        # opens/visits aggregates rebuild from a clean slate when reseeding.
        db.campaign_opens.delete_many({"campaign_id": {"$in": ["camp-1", "camp-2", "camp-3"]}})

        now = datetime.now(timezone.utc)
        # Hero image — Unsplash CDN (free for commercial use). Coffee + pastries
        # is a believable demo for the Café Lumière tenant. Persists across deploys.
        SAMPLE_CAMPAIGN_IMAGE = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80&auto=format&fit=crop"

        # Helper: persist matching per-recipient tracking rows so the
        # tracking modal's recipient list AGREES with the aggregate counters.
        def _seed_campaign_tracking(campaign_id, sent_at, opened_ids, visited_ids):
            for cid in opened_ids:
                db.campaign_opens.insert_one({
                    "campaign_id": campaign_id,
                    "customer_id": cid,
                    "opened_at": sent_at + timedelta(hours=2),
                })

        camp1_recipients = ["c-0", "c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"]
        camp1_opened = ["c-0", "c-1", "c-2", "c-4", "c-7"]      # 5 opened
        camp1_visited = ["c-0", "c-2", "c-4"]                    # 3 visited
        campaign1 = Campaign(
            id="camp-1",
            tenant_id="tenant-1",
            name="Promo Printemps — 20% sur la pâtisserie 🌸",
            status="sent",
            content=(
                "Bonjour {first_name},\n\n"
                "Le printemps arrive chez Café Lumière ! Profitez de -20% sur toutes nos "
                "pâtisseries jusqu'à dimanche soir.\n\n"
                "À très vite,\nL'équipe Café Lumière ☕"
            ),
            source="email",
            image_url=SAMPLE_CAMPAIGN_IMAGE,
            filters={"tier": "gold", "min_visits": 5},
            sent_at=now - timedelta(days=2),
            delivered_count=8,
            targeted_count=10,
            opens=5,
            opens_unique=5,
            visits_from_campaign=3,
            recipient_ids=camp1_recipients,
        )
        c1_dict = campaign1.model_dump()
        c1_dict["attributed_visit_customer_ids"] = list(camp1_visited)
        db.campaigns.insert_one(c1_dict)
        _seed_campaign_tracking("camp-1", now - timedelta(days=2), camp1_opened, camp1_visited)

        camp2_recipients = ["c-3", "c-6", "c-9", "c-12", "c-14"]
        camp2_opened = ["c-3", "c-6", "c-12", "c-14"]            # 4 opened
        camp2_visited = ["c-6", "c-14"]                          # 2 visited
        campaign2 = Campaign(
            id="camp-2",
            tenant_id="tenant-1",
            name="VIP Birthday Special",
            status="sent",
            content="Birthday exclusive: Free coffee!",
            filters={"customer_birthday_visible": True},
            sent_at=now - timedelta(days=14),
            delivered_count=5,
            targeted_count=6,
            opens=4,
            opens_unique=4,
            visits_from_campaign=2,
            recipient_ids=camp2_recipients,
        )
        c2_dict = campaign2.model_dump()
        c2_dict["attributed_visit_customer_ids"] = list(camp2_visited)
        db.campaigns.insert_one(c2_dict)
        _seed_campaign_tracking("camp-2", now - timedelta(days=14), camp2_opened, camp2_visited)

        camp3_recipients = ["c-0", "c-2", "c-4", "c-6", "c-8", "c-10", "c-11", "c-12", "c-13", "c-14"]
        camp3_opened = ["c-0", "c-2", "c-4", "c-6", "c-10", "c-12", "c-14"]   # 7 unique opened
        camp3_visited = ["c-0", "c-4", "c-6", "c-12", "c-14"]                  # 5 visited
        campaign3 = Campaign(
            id="camp-3",
            tenant_id="tenant-1",
            name="Weekend Coffee Club",
            status="sent",
            content="Join our exclusive weekend coffee club with special discounts!",
            filters={"min_visits": 3},
            sent_at=now - timedelta(days=21),
            delivered_count=12,
            targeted_count=15,
            opens=8,
            opens_unique=7,
            visits_from_campaign=5,
            recipient_ids=camp3_recipients,
        )
        c3_dict = campaign3.model_dump()
        c3_dict["attributed_visit_customer_ids"] = list(camp3_visited)
        db.campaigns.insert_one(c3_dict)
        _seed_campaign_tracking("camp-3", now - timedelta(days=21), camp3_opened, camp3_visited)

        campaign4 = Campaign(
            id="camp-4",
            tenant_id="tenant-1",
            name="Summer Refreshments",
            status="draft",
            content="Discover our new summer beverage collection.",
            filters={"tier": "silver"}
        )
        db.campaigns.insert_one(campaign4.model_dump())

    # Check and seed card template
    if not db.card_templates.find_one({"tenant_id": "tenant-1"}):
        card_template = CardTemplate(
            tenant_id="tenant-1",
            logo_url="https://example.com/cafe-logo.png",
            design_mode="hexagon_stamps",
            points_per_visit=10,
            visits_per_stamp=1,
            reward_threshold_stamps=10,
            reward_description="Un café gratuit",
            notify_before_reward=1,
            bronze_design=TierDesign(
                primary_color="#B85C38",
                secondary_color="#1C1917",
                text_color="#FFFFFF",
                accent_color="#D4A574",
                font_family="Inter",
                gradient_direction="135deg"
            ),
            silver_design=TierDesign(
                primary_color="#A0A0A0",
                secondary_color="#1C1917",
                text_color="#FFFFFF",
                accent_color="#C0C0C0",
                font_family="Inter",
                gradient_direction="135deg"
            ),
            gold_design=TierDesign(
                primary_color="#D4A574",
                secondary_color="#1C1917",
                text_color="#FFFFFF",
                accent_color="#FFD700",
                font_family="Inter",
                gradient_direction="135deg"
            ),
            show_customer_name=True,
            show_customer_birthday=True,
            show_points=True,
            show_progress_meter=True
        )
        db.card_templates.insert_one(card_template.model_dump())

    # === Boulangerie Saint-Michel (tenant-2, Chain plan, 3 branches) ===
    # Multi-branch demo — three locations in the Tours metro area, with a
    # realistic flagship/satellite volume split. Used to demo the franchise
    # analytics surfaces (per-branch leaderboard, branch comparison, etc.)
    boul_branches = [
        {
            "id": "branch-bsm-tours-centre",
            "name": "Saint-Michel — Tours Centre",
            "address": "12 Rue Nationale, 37000 Tours",
            "postal_code": "37000",
            "phone": "02-47-12-34-56",
            "is_main": True,
        },
        {
            "id": "branch-bsm-saint-pierre",
            "name": "Saint-Michel — Saint-Pierre-des-Corps",
            "address": "8 Avenue de la Gare, 37700 Saint-Pierre-des-Corps",
            "postal_code": "37700",
            "phone": "02-47-44-55-66",
            "is_main": False,
        },
        {
            "id": "branch-bsm-joue",
            "name": "Saint-Michel — Joué-lès-Tours",
            "address": "45 Boulevard Jean Jaurès, 37300 Joué-lès-Tours",
            "postal_code": "37300",
            "phone": "02-47-67-89-01",
            "is_main": False,
        },
    ]
    boul_branch_ids = [b["id"] for b in boul_branches]

    existing_t2 = db.tenants.find_one({"slug": "boulangerie-saint-michel"})
    needs_t2_upgrade = (
        existing_t2 is None
        or existing_t2.get("plan") != "chain"
        or len(existing_t2.get("branches") or []) < 3
    )
    if needs_t2_upgrade:
        # Use replace_one with upsert so existing demo accounts get migrated.
        t2_doc = Tenant(
            slug="boulangerie-saint-michel",
            name="Boulangerie Saint-Michel",
            plan="chain",
            id="tenant-2",
            address="12 Rue Nationale, 37000 Tours",
            phone="02-47-12-34-56",
            website="boulangerie-saint-michel.fr",
            sector="boulangerie",
            geo_enabled=True,
            geo_radius_meters=400,
            geo_cooldown_days=1,
            branches=boul_branches,
        ).model_dump()
        db.tenants.replace_one({"slug": "boulangerie-saint-michel"}, t2_doc, upsert=True)

    # Check and seed owner user
    if not db.users.find_one({"email": "owner@boulangerie-sm.fr"}):
        u2 = UserInDB(
            email="owner@boulangerie-sm.fr",
            role="business_owner",
            tenant_id="tenant-2",
            hashed_password=hash_password("Boulang!2026")
        )
        db.users.insert_one(u2.model_dump())

    # Check and seed customers — chain bakery with 3 locations.
    # Reseed if low count OR if customers aren't tagged to any branch.
    needs_boul_reseed = (
        db.customers.count_documents({"tenant_id": "tenant-2"}) < 200
        or db.customers.count_documents({"tenant_id": "tenant-2", "branch_id": {"$in": boul_branch_ids}}) == 0
    )
    if needs_boul_reseed:
        db.customers.delete_many({"tenant_id": "tenant-2"})
        # 240 customers across 3 branches — realistic for a chain doing
        # ≈€800k/yr combined revenue at ≈€4.50 avg ticket × 60 visits/yr.
        customers_data = generate_varied_customers(
            "tenant-2",
            240,
            sector="boulangerie",
            branch_ids=boul_branch_ids,
            months_history=18,
        )
        # Realistic franchise volume split: flagship Tours Centre 50%,
        # Saint-Pierre commuter 30%, Joué-lès-Tours suburb 20%.
        split_weights = [50, 30, 20]
        cumulative = []
        running = 0
        for w in split_weights:
            running += w
            cumulative.append(running)
        for i, c in enumerate(customers_data):
            slot = (i * 100 // len(customers_data))
            for branch_idx, threshold in enumerate(cumulative):
                if slot < threshold:
                    c["branch_id"] = boul_branch_ids[branch_idx]
                    break
        db.customers.insert_many(customers_data)

        customer_ids = [c["id"] for c in customers_data]
        db.visits.delete_many({"tenant_id": "tenant-2"})
        visits_data = generate_visits(
            "tenant-2",
            customer_ids,
            days_back=540,                # 18 months of history
            sector="boulangerie",
            branch_ids=boul_branch_ids,
            customers=customers_data,
        )
        # Each visit inherits the customer's home branch most of the time
        # (people are loyal to their local), but ~20% drift to a sibling
        # branch — captures the "I picked up a baguette near work today"
        # behavior. Let the helper assign random branches; we override the
        # majority back to the customer's home branch for realism.
        cust_home = {c["id"]: c.get("branch_id") for c in customers_data}
        for v in visits_data:
            home = cust_home.get(v["customer_id"])
            if home and random.random() < 0.8:
                v["branch_id"] = home
        if visits_data:
            db.visits.insert_many(visits_data)

    # === Test user: akshanshshukla963@gmail.com (super admin) ===
    if not db.users.find_one({"email": "akshanshshukla963@gmail.com"}):
        test_admin = UserInDB(
            email="akshanshshukla963@gmail.com",
            role="super_admin",
            hashed_password=hash_password("AkshFT!2026")
        )
        db.users.insert_one(test_admin.model_dump())

    # === Three role demo accounts (explicitly requested) ======================
    # Quick-login demo trio so reviewers can see each permission level in action.
    # All three are tied to tenant-1 (Café Lumière) except super admin, which
    # spans everything.
    demo_accounts = [
        {
            "email": "demo.admin@fidelitour.com",
            "password": "Admin!Demo2026",
            "role": "super_admin",
            "tenant_id": None,
        },
        {
            "email": "demo.owner@fidelitour.com",
            "password": "Owner!Demo2026",
            "role": "business_owner",
            "tenant_id": "tenant-1",
        },
        {
            "email": "demo.staff@fidelitour.com",
            "password": "Staff!Demo2026",
            "role": "staff",
            "tenant_id": "tenant-1",
        },
    ]
    for acct in demo_accounts:
        if not db.users.find_one({"email": acct["email"]}):
            user_kwargs = {
                "email": acct["email"],
                "role": acct["role"],
                "hashed_password": hash_password(acct["password"]),
            }
            if acct["tenant_id"]:
                user_kwargs["tenant_id"] = acct["tenant_id"]
            db.users.insert_one(UserInDB(**user_kwargs).model_dump())

    # === Primary test customer: Akshansh (postal 37000, Tours) ===
    # Ensure a single canonical test customer record for shuklaakshansh38@gmail.com
    db.customers.delete_many({"email": "shuklaakshansh38@gmail.com"})
    akshansh_customer = Customer(
        id="c-akshansh",
        tenant_id="tenant-1",
        barcode_id="FT-AKSH0001",
        name="Akshansh",
        email="shuklaakshansh38@gmail.com",
        phone="+33-612345678",
        postal_code="37000",
        birthday="1998-01-15",
        tier="gold",
        visits=18,
        total_amount_paid=382.40,
        points=1800,
        pass_issued=True,
        acquisition_source="instagram",
        created_at=datetime.now(timezone.utc) - timedelta(days=45),
        last_visit_date=datetime.now(timezone.utc) - timedelta(days=2)
    )
    db.customers.insert_one(akshansh_customer.model_dump())

    # Seed a visit history so campaign/map/analytics flows all have rich data for this customer
    db.visits.delete_many({"customer_id": "c-akshansh"})
    now = datetime.now(timezone.utc)
    akshansh_visits = []
    for i in range(18):
        vt = now - timedelta(days=random.randint(0, 60), hours=random.randint(0, 12))
        akshansh_visits.append(Visit(
            id=str(uuid.uuid4()),
            tenant_id="tenant-1",
            customer_id="c-akshansh",
            points_awarded=random.choice([10, 15, 20]),
            amount_paid=round(random.uniform(8, 28), 2),
            visit_time=vt,
            created_at=vt
        ).model_dump())
    db.visits.insert_many(akshansh_visits)

    # Also add Akshansh to Boulangerie Saint-Michel so multi-tenant testing works
    db.customers.delete_many({"email": "shuklaakshansh38@gmail.com", "tenant_id": "tenant-2"})
    akshansh_bakery = Customer(
        id="c-akshansh-bakery",
        tenant_id="tenant-2",
        barcode_id="FT-AKSH0002",
        name="Akshansh",
        email="shuklaakshansh38@gmail.com",
        phone="+33-612345678",
        postal_code="37000",
        birthday="1998-01-15",
        tier="silver",
        visits=6,
        total_amount_paid=87.50,
        points=600,
        pass_issued=True,
        acquisition_source="qr_store",
        created_at=datetime.now(timezone.utc) - timedelta(days=20)
    )
    db.customers.insert_one(akshansh_bakery.model_dump())

    # === Seed 20 varied businesses for admin feature-coverage testing ===
    seed_extended_tenants()


# ============================================================
# EXTENDED TENANT SEED — 20 realistic businesses covering every
# combination: sector, plan, GPS on/off, multi-branch, varied sizes.
# ============================================================
EXTENDED_TENANTS_SPEC = [
    # (slug, name, sector, plan, postal, city_lat, city_lng, address, phone, website, geo_on, customers, min_visits_any, avg_spend, has_offer, branches)
    ("maison-gourmet-paris",    "Maison Gourmet",       "restaurant",   "vip",   "75008", 48.8723, 2.3047, "12 Rue Saint-Honoré, 75008 Paris",     "01-42-65-10-11", "maison-gourmet.fr", True,  42, 2, 38.50, True,  0),
    ("pizza-napoli-lyon",       "Pizza Napoli",         "pizzeria",     "gold",  "69002", 45.7484, 4.8320, "28 Rue de la République, 69002 Lyon",   "04-78-42-15-22", "pizzanapoli.fr",   True,  31, 1, 18.20, True,  0),
    ("glacier-berthillon",      "Glacier Berthillon",   "glacier",      "gold",  "75004", 48.8519, 2.3565, "29-31 Rue Saint-Louis-en-l'Île, Paris", "01-43-54-31-61", "berthillon.fr",    False, 27, 2, 9.80,  True,  0),
    ("brasserie-flo-strasbourg","Brasserie Flo",        "brasserie",    "vip",   "67000", 48.5839, 7.7455, "Place Kléber, 67000 Strasbourg",        "03-88-32-45-12", "flo-strasbourg.fr", True, 55, 3, 42.10, True,  0),
    ("sushi-zen-nice",          "Sushi Zen",            "sushi",        "gold",  "06000", 43.7034, 7.2663, "8 Rue Masséna, 06000 Nice",             "04-93-16-25-88", "sushizen.fr",      True,  24, 1, 29.40, True,  0),
    ("burger-republic-lille",   "Burger Republic",      "burger",       "basic", "59000", 50.6292, 3.0573, "45 Rue de Béthune, 59000 Lille",        "03-20-55-33-44", "burgerrepublic.fr", False, 18, 1, 15.60, False, 0),
    ("kebab-istanbul-marseille","Kebab Istanbul",       "kebab",        "basic", "13001", 43.2965, 5.3698, "102 Canebière, 13001 Marseille",        "04-91-54-22-11", "",                 False, 14, 1, 11.40, False, 0),
    ("creperie-bretonne-rennes","Crêperie Bretonne",    "crêperie",     "gold",  "35000", 48.1147, -1.6794,"18 Rue Saint-Georges, 35000 Rennes",    "02-99-38-17-63", "creperie-bretonne.fr", True, 33, 2, 16.80, True, 0),
    ("chocolatier-lyonnais",    "Chocolatier Lyonnais", "chocolatier",  "vip",   "69001", 45.7580, 4.8320, "4 Rue du Président Carnot, 69001 Lyon", "04-78-28-44-99", "chocolatier-lyonnais.fr", True, 38, 2, 24.20, True, 0),
    ("tea-palace-toulouse",     "Tea Palace",           "tea salon",    "gold",  "31000", 43.6047, 1.4442, "22 Rue du Taur, 31000 Toulouse",        "05-61-22-88-37", "tea-palace.fr",    False, 21, 1, 13.40, True,  0),
    ("wine-bar-bordeaux",       "Wine Bar Bordeaux",    "wine bar",     "vip",   "33000", 44.8378, -0.5792,"10 Place Saint-Pierre, 33000 Bordeaux", "05-56-44-77-22", "winebar-bdx.fr",   True,  46, 3, 32.70, True,  0),
    ("juice-lab-montpellier",   "Juice Lab",            "juice bar",    "basic", "34000", 43.6108, 3.8767, "5 Rue Foch, 34000 Montpellier",         "04-67-66-33-21", "",                 False, 17, 1, 8.20,  False, 0),
    ("salon-elegance-paris",    "Salon Élégance",       "hair salon",   "gold",  "75016", 48.8646, 2.2769, "55 Avenue Victor Hugo, 75016 Paris",    "01-45-53-22-18", "salon-elegance.fr", True, 29, 2, 58.30, True, 0),
    ("spa-luxe-cannes",         "Spa Luxe",             "spa",          "vip",   "06400", 43.5528, 7.0174, "14 La Croisette, 06400 Cannes",         "04-93-38-72-11", "spaluxe.fr",       True,  36, 2, 89.40, True,  0),
    ("fit-gym-nantes",          "Fit Gym",              "gym",          "gold",  "44000", 47.2184, -1.5536,"33 Cours des 50 Otages, 44000 Nantes",  "02-40-73-12-45", "fitgym.fr",        True,  51, 3, 42.00, True,  0),
    ("yoga-zen-paris",          "Yoga Zen Studio",      "yoga",         "basic", "75011", 48.8566, 2.3801, "88 Rue du Faubourg Saint-Antoine, Paris","01-43-57-81-29","yoga-zen-studio.fr", False, 22, 1, 25.00, True, 0),
    ("dance-floor-toulouse",    "Dance Floor",          "dance",        "basic", "31000", 43.6047, 1.4442, "6 Rue Saint-Rome, 31000 Toulouse",      "05-61-23-77-66", "",                 False, 15, 1, 22.00, False, 0),
    ("librairie-mollat-bdx",    "Librairie Mollat",     "book store",   "gold",  "33000", 44.8411, -0.5761,"15 Rue Vital-Carles, 33000 Bordeaux",   "05-56-56-40-40", "mollat.com",       False, 34, 2, 24.60, True,  0),
    ("fleuriste-rose-paris",    "Fleuriste Rose",       "florist",      "basic", "75005", 48.8462, 2.3444, "7 Rue Mouffetard, 75005 Paris",         "01-45-35-22-48", "",                 False, 19, 1, 35.80, True,  0),
    ("optique-vision-tours",    "Optique Vision",       "optician",     "chain", "37000", 47.3941, 0.6848, "12 Rue Nationale, 37000 Tours",         "02-47-66-15-22", "optique-vision.fr", True,  62, 2, 95.40, True,  2),
]

SECTOR_CAMPAIGN_TEMPLATES = {
    "restaurant":   ("Table d'Hôtes", "Dégustation saisonnière : -20% sur la carte du soir"),
    "pizzeria":     ("Soirée Napolitaine", "Acheté 1 pizza, la 2ème à -50%"),
    "glacier":      ("Happy Summer", "Cornet gratuit pour 5 boules achetées"),
    "brasserie":    ("Happy Hour", "-30% sur les plats entre 17h et 19h"),
    "sushi":        ("Sushi Lover", "Plateau 24 pièces à 19€ au lieu de 28€"),
    "burger":       ("Cheat Day", "Menu burger à 9,90€ le mardi"),
    "kebab":        ("Midi Express", "Menu complet à 8€ de 12h à 14h"),
    "crêperie":     ("Breizh Day", "Galette + crêpe + cidre à 12€"),
    "chocolatier":  ("Pâques à Venir", "-15% sur tous les œufs de Pâques"),
    "tea salon":    ("Afternoon Tea", "Formule thé + pâtisserie à 7,50€"),
    "wine bar":     ("Dégustation", "3 verres + planche à 15€ le jeudi"),
    "juice bar":    ("Detox Week", "Abonnement 5 jus à -25%"),
    "hair salon":   ("Nouveau Look", "Coupe + brushing + soin à 39€"),
    "spa":          ("Rituel Bien-Être", "-20% sur le modelage californien"),
    "gym":          ("Spring Back in Shape", "Mois d'essai à 19€ + bilan offert"),
    "yoga":         ("Pleine Conscience", "Carnet 10 séances à -15%"),
    "dance":        ("Salsa Night", "Cours d'essai offert + carnet à -10%"),
    "book store":   ("Club Lecteurs", "1 livre acheté = 1 marque-page offert"),
    "florist":      ("Bouquet du Mois", "-20% sur les bouquets de saison"),
    "optician":     ("Vision Clarity", "2ème paire à 1€ pour tout achat monture"),
}

REWARD_BY_SECTOR = {
    "restaurant": "Un apéritif offert",
    "pizzeria": "Une pizza margherita offerte",
    "glacier": "Un cornet 2 boules offert",
    "brasserie": "Un café gourmand offert",
    "sushi": "Un plateau 8 pièces offert",
    "burger": "Un menu cheeseburger offert",
    "kebab": "Un sandwich kebab offert",
    "crêperie": "Une crêpe Nutella offerte",
    "chocolatier": "Une boîte 6 pralinés offerte",
    "tea salon": "Un thé + une pâtisserie offerts",
    "wine bar": "Un verre de vin rouge offert",
    "juice bar": "Un smoothie detox offert",
    "hair salon": "Un soin capillaire offert",
    "spa": "Un modelage 20 min offert",
    "gym": "Une semaine d'accès libre",
    "yoga": "Un cours d'essai offert",
    "dance": "Un cours particulier offert",
    "book store": "Un livre à -50%",
    "florist": "Un bouquet saisonnier offert",
    "optician": "Un étui + nettoyage offerts",
}

def seed_extended_tenants():
    """Seed 20 varied tenants with owners, customers, visits, campaigns, card templates.
    Bulk-inserts everything (~8 round-trips instead of ~120) so it stays
    under Vercel's serverless timeout. Idempotent: skips slugs already present."""
    NAMES_POOL = [
        "Antoine Leroy", "Camille Faure", "Nicolas Girard", "Léa Bonnet", "Hugo Lefevre",
        "Chloé Moreau", "Maxime Durand", "Inès Fontaine", "Lucas Blanc", "Sarah Meyer",
        "Paul Robert", "Louise Perrin", "Gabriel Noël", "Alice Chevalier", "Raphaël Bertrand",
        "Manon Garnier", "Jules Perez", "Zoé Lambert", "Arthur Henry", "Juliette Rolland",
        "Théo Roche", "Jade Simon", "Nathan Muller", "Rose Nicolas", "Ethan Carpentier",
        "Lola Bonneau", "Adam Fabre", "Clara Giraud", "Samuel Hubert", "Mia Colin",
        "Tom Vidal", "Elsa Leroux", "Victor Guerin", "Alba Prévost", "Noah Barbier",
        "Eva Renaud", "Louis Picard", "Iris Lecomte", "Baptiste Boulanger", "Lina Aubert",
        "Simon Texier", "Lily Marchal", "Rémi Masson", "Anaëlle Poirier", "Enzo Schmitt",
        "Lisa Klein", "Milo Weiss", "Nora Caron", "Yanis Hamon", "Léna Blanchard",
        "Axel Pasquier", "Maya Gonzalez", "Basile Dupuis", "Tess Richard", "Gaspard Adam",
        "Agathe Vallet", "Élise Roux", "Matteo Gay", "Camille Leconte", "Diane Thibault",
        "Oscar Jacquet", "Salomé Faivre", "Nolan Rey", "Anna Charpentier", "Achille Meunier"
    ]
    # Only 4 permitted sources (business rule — no friend/website/other)
    ACQUISITION_SOURCES = ["qr_store", "instagram", "facebook", "tiktok"]
    BIRTHDAY_POOL = [f"{random.randint(1,12):02d}-{random.randint(1,28):02d}" for _ in range(100)]

    now = datetime.now(timezone.utc)

    # One-shot idempotency: pull existing extended slugs in a single query
    all_slugs = [spec[0] for spec in EXTENDED_TENANTS_SPEC]
    existing_slugs = set(
        t["slug"] for t in db.tenants.find({"slug": {"$in": all_slugs}}, {"slug": 1})
    )

    # Hash the shared demo password ONCE (bcrypt is slow on cold serverless)
    shared_owner_hash = hash_password("Demo!2026")

    # Accumulators — one insert_many per collection at the end
    tenants_docs = []
    users_docs = []
    customers_docs = []
    visits_docs = []
    campaigns_docs = []
    card_templates_docs = []

    for idx, spec in enumerate(EXTENDED_TENANTS_SPEC):
        (slug, name, sector, plan, postal, lat, lng, address, phone, website,
         geo_on, target_cust_count, min_visits_any, avg_spend, has_offer, branch_count) = spec

        tenant_id = f"tenant-ext-{idx+1:02d}"

        # Idempotent skip
        if slug in existing_slugs:
            continue

        # Build branches for chain/multi-branch
        branches = []
        if branch_count > 0:
            branches.append({
                "id": f"branch-{slug}-main",
                "name": f"{name} - Centre",
                "address": address,
                "postal_code": postal,
                "phone": phone,
                "is_main": True
            })
            for bi in range(branch_count):
                branches.append({
                    "id": f"branch-{slug}-{bi+1}",
                    "name": f"{name} - Succursale {bi+1}",
                    "address": f"{random.randint(1,99)} Rue {random.choice(['Pasteur','Gambetta','Victor Hugo','Jean Jaurès'])}, {postal}",
                    "postal_code": postal,
                    "phone": phone,
                    "is_main": False
                })

        tenants_docs.append(Tenant(
            id=tenant_id,
            slug=slug,
            name=name,
            plan=plan,
            address=address,
            phone=phone,
            website=website,
            geo_enabled=geo_on,
            geo_radius_meters=500 if geo_on else None,
            geo_cooldown_days=1,
            branches=branches,
            sector=sector,
            campaign_sender_name=name,  # default to business name
            created_at=now - timedelta(days=random.randint(30, 365))
        ).model_dump())

        # Owner user — shared password hash reused across all demo owners
        owner_email = f"owner+{slug}@fidelitour.fr"
        users_docs.append(UserInDB(
            email=owner_email,
            role="business_owner",
            tenant_id=tenant_id,
            hashed_password=shared_owner_hash
        ).model_dump())

        # Customers — always >= 14 to guarantee rich drill-downs everywhere
        customer_count = max(target_cust_count, 14)
        customers = []
        for ci in range(customer_count):
            # Ensure at least some gold and silver for each tenant
            if ci < max(3, customer_count // 8):
                visits = random.randint(20, 40)
                tier = "gold"
            elif ci < max(7, customer_count // 3):
                visits = random.randint(10, 19)
                tier = "silver"
            else:
                visits = random.randint(max(min_visits_any, 1), 9)
                tier = "bronze"

            spend = round(visits * random.uniform(avg_spend * 0.7, avg_spend * 1.3), 2)
            source = random.choices(
                ACQUISITION_SOURCES,
                weights=[5, 4, 3, 2],  # QR + Instagram most common, then FB, then TikTok
                k=1
            )[0]
            pass_issued = random.random() < 0.7 if visits >= 3 else random.random() < 0.3
            last_visit = now - timedelta(days=random.randint(0, 45)) if visits > 0 else None

            customer = Customer(
                id=f"c-{tenant_id}-{ci:03d}",
                tenant_id=tenant_id,
                barcode_id=f"FT-{tenant_id[-4:].upper()}{ci:03d}",
                name=NAMES_POOL[(idx * 7 + ci) % len(NAMES_POOL)],
                email=f"c{ci:03d}@{slug}.test",
                phone=f"06{random.randint(10000000, 99999999)}",
                postal_code=postal,
                birthday=BIRTHDAY_POOL[(idx * 11 + ci) % len(BIRTHDAY_POOL)],
                tier=tier,
                visits=visits,
                total_amount_paid=spend,
                points=visits * 10,
                pass_issued=pass_issued,
                acquisition_source=source,
                last_visit_date=last_visit,
                created_at=now - timedelta(days=random.randint(1, 180))
            )
            customers.append(customer.model_dump())
        customers_docs.extend(customers)

        # Visits — cap per-customer events at 6 to keep the total tractable
        for c in customers:
            num_events = min(c["visits"], random.randint(3, 6))
            for _ in range(num_events):
                vt = now - timedelta(days=random.randint(0, 75), hours=random.randint(7, 20))
                visits_docs.append(Visit(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    customer_id=c["id"],
                    points_awarded=random.choice([10, 15, 20]),
                    amount_paid=round(random.uniform(avg_spend * 0.6, avg_spend * 1.4), 2),
                    visit_time=vt,
                    created_at=vt
                ).model_dump())

        # Campaigns — every tenant gets 2-4 campaigns (mix of sent + draft)
        camp_name, camp_content = SECTOR_CAMPAIGN_TEMPLATES.get(sector, ("Offre Spéciale", "Profitez d'une offre exclusive"))
        targeted = random.randint(10, min(customer_count, 40))
        delivered = int(targeted * random.uniform(0.7, 0.95))
        opens = int(delivered * random.uniform(0.4, 0.8))
        visits_from = int(opens * random.uniform(0.2, 0.5))
        recipient_ids = [c["id"] for c in customers[:targeted]]

        campaigns_docs.extend([
            Campaign(
                id=f"camp-{tenant_id}-1",
                tenant_id=tenant_id,
                name=camp_name,
                status="sent",
                content=camp_content,
                filters={"min_visits": 2},
                sent_at=now - timedelta(days=random.randint(5, 30)),
                targeted_count=targeted,
                delivered_count=delivered,
                opens=opens,
                opens_unique=int(opens * 0.85),
                visits_from_campaign=max(visits_from, 1),
                recipient_ids=recipient_ids,
            ).model_dump(),
            Campaign(
                id=f"camp-{tenant_id}-2",
                tenant_id=tenant_id,
                name=f"Fidélité {name}",
                status="sent",
                content=f"Nouveau palier atteint chez {name} ! Récompense offerte.",
                filters={"tier": "gold"},
                sent_at=now - timedelta(days=random.randint(40, 70)),
                targeted_count=max(targeted // 3, 3),
                delivered_count=max(delivered // 3, 2),
                opens=max(opens // 3, 1),
                opens_unique=max(opens // 3, 1),
                visits_from_campaign=max(visits_from // 2, 1),
                recipient_ids=recipient_ids[: max(targeted // 3, 3)],
            ).model_dump(),
            Campaign(
                id=f"camp-{tenant_id}-3",
                tenant_id=tenant_id,
                name=f"Relance {sector.capitalize()}",
                status="draft",
                content="Campagne de relance clients inactifs.",
                filters={"min_visits": 1},
            ).model_dump(),
        ])

        # Card template with active offer (Captain-Wallet-style richness)
        sector_palette = {
            "restaurant":  ("#8B4513", "#FFF8DC", "#FFFFFF", "#D2691E"),
            "pizzeria":    ("#C41E3A", "#FEF6E4", "#FFFFFF", "#FFC857"),
            "glacier":     ("#EF5DA8", "#FFF0F7", "#FFFFFF", "#A8DADC"),
            "brasserie":   ("#4A5D23", "#F3EFE7", "#FFFFFF", "#E3A869"),
            "sushi":       ("#0F1020", "#FFFFFF", "#FFFFFF", "#E63946"),
            "burger":      ("#E63946", "#FFF8E7", "#FFFFFF", "#FFC300"),
            "kebab":       ("#A44A3F", "#FFF8E7", "#FFFFFF", "#F1A208"),
            "crêperie":    ("#E8A87C", "#FFFFFF", "#1C1917", "#C38D9E"),
            "chocolatier": ("#3E1F11", "#F5E0C3", "#FFFFFF", "#C58F4A"),
            "tea salon":   ("#7B9B59", "#FAF3E0", "#FFFFFF", "#D1A8A8"),
            "wine bar":    ("#5D2838", "#F6E3C9", "#FFFFFF", "#C9AE88"),
            "juice bar":   ("#2FAF68", "#F6FFF6", "#FFFFFF", "#F5D547"),
            "hair salon":  ("#1C1917", "#FAF3E0", "#FFFFFF", "#D4A574"),
            "spa":         ("#89B0AE", "#FFFFFF", "#1C1917", "#E0C1B3"),
            "gym":         ("#0F1020", "#FFFFFF", "#FFFFFF", "#FF6B35"),
            "yoga":        ("#A8C686", "#FDFBF7", "#1C1917", "#F9C784"),
            "dance":       ("#6A0572", "#FFF8FC", "#FFFFFF", "#F15BB5"),
            "book store":  ("#264653", "#FAF3E0", "#FFFFFF", "#E9C46A"),
            "florist":     ("#FF6B9D", "#FFF8FC", "#FFFFFF", "#95D5B2"),
            "optician":    ("#1E3A8A", "#F0F6FF", "#FFFFFF", "#F59E0B"),
        }.get(sector, ("#B85C38", "#1C1917", "#FFFFFF", "#D4A574"))
        primary, secondary, text_c, accent = sector_palette

        card_template = CardTemplate(
            tenant_id=tenant_id,
            logo_url=f"https://dummyimage.com/120x120/{primary.lstrip('#')}/{text_c.lstrip('#')}&text={name[:1]}",
            active_offer_title=camp_name,
            active_offer_description=camp_content,
            active_offer_active=has_offer,
            design_mode="hexagon_stamps",
            points_per_visit=10,
            visits_per_stamp=1,
            reward_threshold_stamps=random.choice([8, 10, 12]),
            reward_description=REWARD_BY_SECTOR.get(sector, "Une récompense fidélité"),
            notify_before_reward=1,
            bronze_design=TierDesign(
                primary_color=primary, secondary_color=secondary, text_color=text_c,
                accent_color=accent, font_family="Inter", gradient_direction="135deg"
            ),
            silver_design=TierDesign(
                primary_color="#A0A0A0", secondary_color=secondary, text_color="#FFFFFF",
                accent_color="#C0C0C0", font_family="Inter", gradient_direction="135deg"
            ),
            gold_design=TierDesign(
                primary_color="#D4A574", secondary_color=secondary, text_color="#FFFFFF",
                accent_color="#FFD700", font_family="Inter", gradient_direction="135deg"
            ),
            show_customer_name=True,
            show_customer_birthday=True,
            show_points=True,
            show_progress_meter=True,
        )
        card_templates_docs.append(card_template.model_dump())

    # Final bulk insert — one round-trip per collection
    if tenants_docs:
        db.tenants.insert_many(tenants_docs)
    if users_docs:
        db.users.insert_many(users_docs)
    if customers_docs:
        db.customers.insert_many(customers_docs)
    if visits_docs:
        db.visits.insert_many(visits_docs)
    if campaigns_docs:
        db.campaigns.insert_many(campaigns_docs)
    if card_templates_docs:
        db.card_templates.insert_many(card_templates_docs)


# Seed data on every cold start (Vercel serverless workaround)
_seeded = False
_seed_error = None

@app.middleware("http")
async def ensure_seed_data(request: Request, call_next):
    global _seeded, _seed_error
    if not _seeded:
        try:
            mock_seed_data()
            _seeded = True
            _seed_error = None
        except Exception as e:
            _seed_error = str(e)
            _seeded = True  # Don't retry every request
            import traceback
            traceback.print_exc()
    response = await call_next(request)
    return response

@app.on_event("startup")
async def startup_event():
    try:
        mock_seed_data()
    except Exception as e:
        import traceback
        traceback.print_exc()

# Health check endpoint for debugging
@app.get("/api/health")
def health_check():
    try:
        user_count = db.users.count_documents({})
        tenant_count = db.tenants.count_documents({})
        customer_count = db.customers.count_documents({})
        users_list = []
        for u in db.users.find({}, {"email": 1, "role": 1, "_id": 0}):
            users_list.append(u)
        return {
            "status": "ok",
            "mongodb_uri_set": bool(MONGODB_URI),
            "sendgrid_key_set": bool(SENDGRID_API_KEY),
            "seed_error": _seed_error,
            "counts": {
                "users": user_count,
                "tenants": tenant_count,
                "customers": customer_count
            },
            "users": users_list
        }
    except Exception as e:
        return {"status": "error", "detail": str(e), "mongodb_uri_set": bool(MONGODB_URI)}

@app.post("/api/reset-seed")
def reset_and_reseed():
    """Drop all collections and re-seed fresh data. Use for demo resets."""
    global _seeded
    try:
        db.users.delete_many({})
        db.tenants.delete_many({})
        db.customers.delete_many({})
        db.visits.delete_many({})
        db.campaigns.delete_many({})
        db.card_templates.delete_many({})
        db.ai_queries.delete_many({})
        _seeded = False
        mock_seed_data()
        _seeded = True
        return {"status": "ok", "message": "Database reset and re-seeded successfully"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# ========================
# AUTH ENDPOINTS
# ========================

@app.post("/api/auth/register")
def register(user: UserCreate):
    existing = db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Only customers and business_owners can self-register.
    # Manager/staff accounts must be created by the business owner via /api/owner/team.
    if user.role not in ("customer", "business_owner"):
        raise HTTPException(status_code=403, detail="This role cannot self-register")

    tenant_id = None
    if user.role == "business_owner":
        tenant_id = str(uuid.uuid4())
        slug = user.email.split("@")[0].lower().replace(".", "-")
        t = Tenant(id=tenant_id, slug=slug, name=slug, plan="basic")
        db.tenants.insert_one(t.model_dump())

    new_user = UserInDB(
        email=user.email,
        role=user.role,
        tenant_id=tenant_id,
        hashed_password=hash_password(user.password)
    )
    db.users.insert_one(new_user.model_dump())
    return {"message": "Success"}

@app.post("/api/auth/login")
def login(req: LoginRequest, response: Response):
    user_dict = db.users.find_one({"email": req.email})
    if not user_dict:
        raise HTTPException(status_code=400, detail="Incorrect credentials")

    user = UserInDB(**user_dict)
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect credentials")

    access_token = create_access_token(data={"sub": user.email, "role": user.role, "tenant_id": user.tenant_id})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=True,
        path="/"
    )
    return {"access_token": access_token, "role": user.role}

@app.get("/api/auth/me")
def get_me(token_data: TokenData = Depends(get_current_user_data)):
    return {"email": token_data.email, "role": token_data.role, "tenant_id": token_data.tenant_id}

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}

# ========================
# ADMIN ENDPOINTS
# ========================

@app.get("/api/admin/tenants")
def get_all_tenants(token_data: TokenData = Depends(require_role(["super_admin"]))):
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))

    # Bulk per-tenant rollups via aggregation — keeps this endpoint at ~3 round
    # trips total instead of one count() per tenant. Without these the
    # frontend table reads `t.total_visits` undefined for every row, which is
    # why every business was being flagged "Inactive" with 0.0 avg points.
    visits_by_tenant = {
        doc["_id"]: doc["count"]
        for doc in db.visits.aggregate([
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
        if doc.get("_id")
    }
    cust_stats_by_tenant = {
        doc["_id"]: doc
        for doc in db.customers.aggregate([
            {"$group": {
                "_id": "$tenant_id",
                "count": {"$sum": 1},
                "total_points": {"$sum": "$points"},
                "total_amount_paid": {"$sum": "$total_amount_paid"},
            }}
        ])
        if doc.get("_id")
    }

    # "Active" = had ≥1 visit in the last 30 days. Computed once here rather
    # than re-derived on the client from total_visits > 0, which mis-flagged
    # tenants whose visits all predated the rolling window.
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    active_tenant_ids = set(db.visits.distinct(
        "tenant_id",
        {"created_at": {"$gte": thirty_days_ago}}
    ))

    result = []
    for t in tenants:
        t.pop("_id", None)
        tid = t["id"]
        cust = cust_stats_by_tenant.get(tid) or {}
        cust_count = int(cust.get("count", 0) or 0)
        total_points = float(cust.get("total_points", 0) or 0)
        t["customer_count"] = cust_count
        t["total_visits"] = int(visits_by_tenant.get(tid, 0) or 0)
        t["avg_points_per_customer"] = round(total_points / cust_count, 1) if cust_count else 0.0
        t["total_revenue"] = round(float(cust.get("total_amount_paid", 0) or 0), 2)
        t["is_active_30d"] = tid in active_tenant_ids
        result.append(t)

    return result

@app.post("/api/admin/tenants")
def create_tenant(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Create new tenant with generated business owner account"""
    tenant_id = str(uuid.uuid4())
    slug = req.get("slug", req.get("name", "").lower().replace(" ", "-"))

    tenant = Tenant(
        id=tenant_id,
        slug=slug,
        name=req.get("name", "New Tenant"),
        plan=req.get("plan", "basic"),
        address=req.get("address", ""),
        phone=req.get("phone", ""),
        website=req.get("website", "")
    )
    db.tenants.insert_one(tenant.model_dump())

    # Create business owner account
    owner_email = req.get("owner_email", f"owner-{slug}@fidelitour-generated.com")
    generated_password = str(uuid.uuid4())[:12]

    owner_user = UserInDB(
        email=owner_email,
        role="business_owner",
        tenant_id=tenant_id,
        hashed_password=hash_password(generated_password)
    )
    db.users.insert_one(owner_user.model_dump())

    return {
        "tenant": tenant.model_dump(),
        "owner": {
            "email": owner_email,
            "password": generated_password,
            "message": "Store these credentials securely"
        }
    }

@app.put("/api/admin/tenants/{tenant_id}")
def update_tenant(
    tenant_id: str,
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Update tenant details"""
    update_data = {}
    if "name" in req:
        update_data["name"] = req["name"]
    if "plan" in req:
        update_data["plan"] = req["plan"]
    if "address" in req:
        update_data["address"] = req["address"]
    if "phone" in req:
        update_data["phone"] = req["phone"]
    if "website" in req:
        update_data["website"] = req["website"]

    result = db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant = db.tenants.find_one({"id": tenant_id})
    tenant.pop("_id", None)
    return tenant

@app.delete("/api/admin/tenants/{tenant_id}")
def delete_tenant(
    tenant_id: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Soft delete tenant"""
    result = db.tenants.update_one({"id": tenant_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {"message": "Tenant disabled"}

@app.get("/api/admin/tenants/{tenant_id}/details")
def get_tenant_details(
    tenant_id: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Get detailed tenant info with customer stats"""
    tenant = db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.pop("_id", None)

    # Customer stats
    customer_count = db.customers.count_documents({"tenant_id": tenant_id})
    visit_count = db.visits.count_documents({"tenant_id": tenant_id})

    # Tier distribution
    tier_dist = {}
    for tier in ["bronze", "silver", "gold"]:
        count = db.customers.count_documents({"tenant_id": tenant_id, "tier": tier})
        tier_dist[tier] = count

    tenant["stats"] = {
        "total_customers": customer_count,
        "total_visits": visit_count,
        "tier_distribution": tier_dist,
        "monthly_revenue": PLAN_PRICES.get(tenant["plan"], 0)
    }

    return tenant

@app.get("/api/admin/tenants/{tenant_id}/customers")
def admin_get_tenant_customers(
    tenant_id: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Admin: list all customers of a specific tenant."""
    tenant = db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    customers = list(db.customers.find({"tenant_id": tenant_id}))
    for c in customers:
        c.pop("_id", None)
    return customers

@app.get("/api/admin/tenants/{tenant_id}/analytics")
def admin_get_tenant_analytics(
    tenant_id: str,
    days: int = 30,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Admin: full analytics snapshot for a specific tenant (mirrors owner analytics)."""
    tenant = db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)

    total_customers = db.customers.count_documents({"tenant_id": tenant_id})
    total_visits_period = db.visits.count_documents({
        "tenant_id": tenant_id,
        "visit_time": {"$gte": period_start}
    })
    all_visits = db.visits.count_documents({"tenant_id": tenant_id})

    # Tier distribution
    tier_dist = {t: db.customers.count_documents({"tenant_id": tenant_id, "tier": t}) for t in ["bronze", "silver", "gold"]}

    # Revenue (sum amount_paid)
    revenue_pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_paid"}}}
    ]
    rev = list(db.visits.aggregate(revenue_pipeline))
    total_revenue = rev[0]["total"] if rev else 0.0

    # Top spenders
    top_spenders = list(db.customers.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "tier": 1, "total_amount_paid": 1, "visits": 1}
    ).sort("total_amount_paid", -1).limit(5))

    # Top visitors
    top_visitors = list(db.customers.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "tier": 1, "total_amount_paid": 1, "visits": 1}
    ).sort("visits", -1).limit(5))

    # Acquisition-source breakdown — only 4 permitted sources, no friend/other
    ALLOWED_SOURCES = {"qr_store", "instagram", "facebook", "tiktok"}
    acq_pipeline = [
        {"$match": {"tenant_id": tenant_id, "acquisition_source": {"$in": list(ALLOWED_SOURCES)}}},
        {"$group": {"_id": "$acquisition_source", "count": {"$sum": 1}}}
    ]
    acq_breakdown = {r["_id"]: r["count"] for r in db.customers.aggregate(acq_pipeline)}

    # Visits per day over the period
    visits_by_day = {}
    for v in db.visits.find({"tenant_id": tenant_id, "visit_time": {"$gte": period_start}}):
        day_key = v["visit_time"].strftime("%Y-%m-%d")
        visits_by_day[day_key] = visits_by_day.get(day_key, 0) + 1

    # Cards filled
    cards_filled = db.customers.count_documents({"tenant_id": tenant_id, "pass_issued": True})

    tenant.pop("_id", None)

    return {
        "tenant": {"id": tenant["id"], "name": tenant["name"], "plan": tenant["plan"], "slug": tenant.get("slug")},
        "period_days": days,
        "total_customers": total_customers,
        "total_visits_period": total_visits_period,
        "total_visits_all_time": all_visits,
        "total_revenue": round(total_revenue, 2),
        "tier_distribution": tier_dist,
        "top_spenders": top_spenders,
        "top_visitors": top_visitors,
        "acquisition_breakdown": acq_breakdown,
        "visits_by_day": visits_by_day,
        "cards_filled": cards_filled,
    }

@app.get("/api/admin/card-template/{tenant_id}")
def get_card_template_admin(
    tenant_id: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Get card template for a tenant (admin only)"""
    t = db.card_templates.find_one({"tenant_id": tenant_id})
    if t:
        t.pop("_id", None)
        return t
    return CardTemplate(tenant_id=tenant_id).model_dump()

@app.post("/api/admin/card-template/{tenant_id}")
def save_card_template_admin(
    tenant_id: str,
    req: CardTemplate,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Save card template for a tenant (admin only). Mirrors the owner-side
    save: snapshots old rules, writes new ones, and runs a retroactive
    notification sweep when the rules got more permissive."""
    req.tenant_id = tenant_id
    payload = req.model_dump()

    old_tpl = db.card_templates.find_one({"tenant_id": tenant_id}) or {}
    old_threshold = int(old_tpl.get("reward_threshold_stamps", 10) or 10)
    old_notify = int(old_tpl.get("notify_before_reward", 1) or 1)

    db.card_templates.update_one({"tenant_id": tenant_id}, {"$set": payload}, upsert=True)

    new_threshold = max(int(payload.get("reward_threshold_stamps", 10) or 10), 1)
    new_notify    = max(int(payload.get("notify_before_reward", 1) or 1), 0)
    new_approach  = max(0, new_threshold - new_notify)

    if new_threshold < old_threshold or new_notify > old_notify:
        visits_per_stamp = max(int(payload.get("visits_per_stamp", 1) or 1), 1)
        candidates = list(db.customers.find(
            {"tenant_id": tenant_id, "visits": {"$gte": new_approach * visits_per_stamp}}
        ))
        for cust in candidates:
            try:
                _evaluate_reward_state_and_notify(cust, tenant_id)
            except Exception as e:
                print(f"Reward eval failed for {cust.get('id')}: {e}")

    return payload

@app.put("/api/admin/tenants/{tenant_id}/geo")
def update_geo_settings(
    tenant_id: str,
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Update geo settings for a tenant. SUPER ADMIN ONLY.

    Accepts:
      - geo_enabled (bool)         — master switch for proximity pushes
      - geo_radius_meters (int)    — push range around a branch
      - geo_cooldown_days (int)    — min days between pushes per customer
      - vip_geo_only (bool)        — restrict proximity pushes to VIP tier only
                                     (owners CANNOT change this — admin-only)
    """
    update_data = {}
    if "geo_enabled" in req:
        update_data["geo_enabled"] = bool(req["geo_enabled"])
    if "geo_radius_meters" in req:
        update_data["geo_radius_meters"] = req["geo_radius_meters"]
    if "geo_cooldown_days" in req:
        update_data["geo_cooldown_days"] = req["geo_cooldown_days"]
    if "vip_geo_only" in req:
        update_data["vip_geo_only"] = bool(req["vip_geo_only"])

    result = db.tenants.update_one({"id": tenant_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant = db.tenants.find_one({"id": tenant_id})
    tenant.pop("_id", None)
    return tenant

@app.get("/api/admin/analytics")
def get_admin_analytics(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Admin analytics dashboard"""
    tenant_count = db.tenants.count_documents({"is_active": {"$ne": False}})
    customer_count = db.customers.count_documents({})
    visit_count = db.visits.count_documents({})

    # Calculate monthly revenue
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    monthly_revenue = sum(PLAN_PRICES.get(t.get("plan"), 0) for t in tenants)

    # Active tenants in last 30 days. Intersect with the active-tenants set
    # so we never count a visit whose tenant_id refers to a deactivated or
    # deleted tenant — that's how we previously got "22 active out of 21
    # total" (an orphan tenant_id in db.visits).
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    active_ids = {t["id"] for t in tenants}
    visited_recently = set(db.visits.distinct(
        "tenant_id",
        {"created_at": {"$gte": thirty_days_ago}}
    ))
    active_count = len(visited_recently & active_ids)

    return {
        "total_tenants": tenant_count,
        "total_customers": customer_count,
        "total_visits": visit_count,
        "monthly_revenue": monthly_revenue,
        "active_tenants_30d": active_count
    }

@app.get("/api/admin/detailed-analytics")
def get_admin_detailed_analytics(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Enhanced admin analytics — platform-wide aggregates across ALL tenants.
    Uses MongoDB aggregation to stay at ~3 round-trips total (instead of 1 per tenant)."""
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    all_customers = list(db.customers.find({}))

    # ONE aggregation for per-tenant visit counts (vs one count per tenant)
    visits_by_tenant = {
        doc["_id"]: doc["count"]
        for doc in db.visits.aggregate([
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }
    all_visits_count = sum(visits_by_tenant.values())

    # --- Plans distribution (include chain) ---
    plan_counts = {"basic": 0, "gold": 0, "vip": 0, "chain": 0}
    for t in tenants:
        plan = t.get("plan", "basic")
        if plan in plan_counts:
            plan_counts[plan] += 1
    plans_distribution = [
        {"name": "Basic", "value": plan_counts["basic"]},
        {"name": "Gold", "value": plan_counts["gold"]},
        {"name": "VIP", "value": plan_counts["vip"]},
        {"name": "Chain", "value": plan_counts["chain"]},
    ]

    # --- Tier distribution across platform ---
    tier_counts = {"bronze": 0, "silver": 0, "gold": 0}
    for c in all_customers:
        t = (c.get("tier") or "bronze").lower()
        if t in tier_counts:
            tier_counts[t] += 1
    tier_distribution = [
        {"name": "Bronze", "value": tier_counts["bronze"]},
        {"name": "Silver", "value": tier_counts["silver"]},
        {"name": "Gold",   "value": tier_counts["gold"]},
    ]

    # --- Acquisition sources across platform ---
    # Only the 4 permitted sources — no 'friend', no 'other' bucket.
    ALLOWED_SOURCES = {"qr_store", "instagram", "facebook", "tiktok"}
    acq_counts = {}
    for c in all_customers:
        src = c.get("acquisition_source")
        if src in ALLOWED_SOURCES:
            acq_counts[src] = acq_counts.get(src, 0) + 1
    acquisition_sources = [
        {"name": k.replace("_", " ").title(), "value": v, "raw": k}
        for k, v in sorted(acq_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # --- GPS breakdown ---
    geo_enabled = sum(1 for t in tenants if t.get("geo_enabled"))
    gps_breakdown = [
        {"name": "GPS Enabled",  "value": geo_enabled},
        {"name": "GPS Disabled", "value": max(len(tenants) - geo_enabled, 0)},
    ]

    # --- Real growth: tenants created per month, last 6 months ---
    now = datetime.now(timezone.utc)
    growth = []
    for back in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=back * 30)).replace(day=1)
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        cnt = sum(
            1 for t in tenants
            if t.get("created_at") and month_start <= t["created_at"] < next_month
        )
        growth.append({"month": month_start.strftime("%b"), "tenants": cnt, "iso": month_start.strftime("%Y-%m")})

    # --- Top & bottom performers (all in-memory, NO per-tenant DB calls) ---
    # Bucket customers by tenant ONCE
    customers_by_tenant = {}
    for c in all_customers:
        customers_by_tenant.setdefault(c.get("tenant_id"), []).append(c)

    perf = []
    for t in tenants:
        tid = t["id"]
        t_customers = customers_by_tenant.get(tid, [])
        cust_count = len(t_customers)
        total_visits = visits_by_tenant.get(tid, 0)
        total_rev = round(sum(c.get("total_amount_paid", 0) for c in t_customers), 2)
        avg_pts = round(sum(c.get("points", 0) for c in t_customers) / max(cust_count, 1), 1) if cust_count else 0
        perf.append({
            "id": tid,
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "customers": cust_count,
            "visits": total_visits,
            "revenue": total_rev,
            "avg_points": avg_pts,
            "geo_enabled": bool(t.get("geo_enabled")),
        })
    perf_sorted = sorted(perf, key=lambda x: x["visits"], reverse=True)

    # --- Platform totals ---
    total_revenue_month = sum(PLAN_PRICES.get(t.get("plan"), 0) for t in tenants)
    total_customer_spend = round(sum(c.get("total_amount_paid", 0) for c in all_customers), 2)

    return {
        "totals": {
            "tenants": len(tenants),
            "customers": len(all_customers),
            "visits": all_visits_count,
            "subscription_revenue_month": total_revenue_month,
            "customer_spend_all_time": total_customer_spend,
        },
        "plans_distribution": plans_distribution,
        "tier_distribution": tier_distribution,
        "acquisition_sources": acquisition_sources,
        "gps_breakdown": gps_breakdown,
        "growth": growth,
        "tenant_performance": perf_sorted,
    }

@app.get("/api/admin/tenants-by-plan/{plan}")
def get_tenants_by_plan(
    plan: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Get list of tenants for a specific plan tier"""
    if plan not in ["basic", "gold", "vip", "chain"]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    tenants = list(db.tenants.find({"plan": plan, "is_active": {"$ne": False}}))

    result = []
    for t in tenants:
        t.pop("_id", None)
        customer_count = db.customers.count_documents({"tenant_id": t["id"]})
        total_visits = db.visits.count_documents({"tenant_id": t["id"]})
        t["customer_count"] = customer_count
        t["total_visits"] = total_visits
        # Calculate avg_points from customers
        customers = list(db.customers.find({"tenant_id": t["id"]}))
        avg_points = sum(c.get("points", c.get("visits", 0) * 10) for c in customers) / max(len(customers), 1) if customers else 0
        t["avg_points"] = round(avg_points, 1)
        result.append(t)

    return result

@app.get("/api/admin/tenants-by-tier/{tier}")
def get_tenants_by_tier(
    tier: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Rank tenants by how many customers they have at a given loyalty tier."""
    tier = tier.lower()
    if tier not in ["bronze", "silver", "gold"]:
        raise HTTPException(status_code=400, detail="Invalid tier")

    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    out = []
    for t in tenants:
        t.pop("_id", None)
        tier_cust = db.customers.count_documents({"tenant_id": t["id"], "tier": tier})
        if tier_cust == 0:
            continue
        out.append({
            "id": t["id"],
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "tier_customer_count": tier_cust,
            "total_customers": db.customers.count_documents({"tenant_id": t["id"]}),
        })
    return sorted(out, key=lambda x: x["tier_customer_count"], reverse=True)

@app.get("/api/admin/tenants-by-acquisition/{source}")
def get_tenants_by_acquisition(
    source: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Rank tenants by how many customers they've acquired via a specific channel."""
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    out = []
    for t in tenants:
        t.pop("_id", None)
        cnt = db.customers.count_documents({"tenant_id": t["id"], "acquisition_source": source})
        if cnt == 0:
            continue
        out.append({
            "id": t["id"],
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "acquisition_count": cnt,
            "total_customers": db.customers.count_documents({"tenant_id": t["id"]}),
        })
    return sorted(out, key=lambda x: x["acquisition_count"], reverse=True)

@app.get("/api/admin/tenants-by-geo/{enabled}")
def get_tenants_by_geo(
    enabled: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """List tenants with geolocation enabled/disabled."""
    want_enabled = enabled.lower() in ("1", "true", "yes", "enabled", "on")
    tenants = list(db.tenants.find({"is_active": {"$ne": False}, "geo_enabled": want_enabled}))
    out = []
    for t in tenants:
        t.pop("_id", None)
        out.append({
            "id": t["id"],
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "customer_count": db.customers.count_documents({"tenant_id": t["id"]}),
            "total_visits": db.visits.count_documents({"tenant_id": t["id"]}),
            "geo_radius_meters": t.get("geo_radius_meters"),
        })
    return out

@app.get("/api/admin/tenants-by-month/{iso_month}")
def get_tenants_by_month(
    iso_month: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """List tenants created in a given month (format YYYY-MM)."""
    try:
        year, month = iso_month.split("-")
        year, month = int(year), int(month)
    except Exception:
        raise HTTPException(status_code=400, detail="iso_month must be YYYY-MM")

    month_start = datetime(year, month, 1, tzinfo=timezone.utc)
    next_month = (month_start + timedelta(days=32)).replace(day=1)

    tenants = list(db.tenants.find({
        "is_active": {"$ne": False},
        "created_at": {"$gte": month_start, "$lt": next_month}
    }))
    out = []
    for t in tenants:
        t.pop("_id", None)
        out.append({
            "id": t["id"],
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "customer_count": db.customers.count_documents({"tenant_id": t["id"]}),
            "created_at": t.get("created_at"),
        })
    return out

@app.post("/api/admin/ai-query")
def admin_ai_query(req: AIQueryRequest, token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Mock admin AI assistant"""
    return {
        "reply": "Intel Suggestion: Based on analytics, consider upgrading underperforming tenants to Gold tier. Most growth is coming from the café sector. Would you like me to draft upgrade recommendations?",
        "mode": "mock"
    }

# ========================
# OWNER ENDPOINTS
# ========================

@app.get("/api/owner/tenant")
def get_tenant(token_data: TokenData = Depends(require_role(["business_owner"]))):
    t = db.tenants.find_one({"id": token_data.tenant_id})
    if t:
        t.pop("_id", None)
    return t

@app.put("/api/owner/tenant")
def update_tenant(req: Tenant, token_data: TokenData = Depends(require_role(["business_owner"]))):
    if req.id != token_data.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.tenants.update_one({"id": token_data.tenant_id}, {"$set": req.model_dump()})
    return req.model_dump()

@app.get("/api/owner/customers")
def list_customers(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    tier: Optional[str] = Query(None),
    tiers: Optional[str] = Query(None),       # CSV of tiers: "silver,gold,vip"
    min_visits: Optional[int] = Query(None),
    max_visits: Optional[int] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    min_avg_ticket: Optional[float] = Query(None),
    postal_code: Optional[str] = Query(None),
    postal_codes: Optional[str] = Query(None),  # CSV of postal codes
    city: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    sources: Optional[str] = Query(None),        # CSV of sources
    search: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    has_wallet_pass: Optional[bool] = Query(None),
    active_30d: Optional[bool] = Query(None),
    created_within_days: Optional[int] = Query(None),
    cards_filled: Optional[bool] = Query(None),
    has_birthday_this_month: Optional[bool] = Query(None),
    redeemed_reward: Optional[bool] = Query(None),  # True → has redeemed at least once
    # Pre-built time-of-day segments. Resolves against db.visits timestamps.
    # "lunch"    → majority of visits between 11:00 and 14:30
    # "evening"  → majority of visits between 17:00 and 22:00
    # "weekend"  → majority on Sat/Sun
    # "weekday"  → majority on Mon-Fri
    time_segment: Optional[str] = Query(None),
    # Inactivity window filters — "about to lose" uses min=14 & max=29;
    # "inactive" uses min=30 (no upper bound).
    inactive_days_min: Optional[int] = Query(None),
    inactive_days_max: Optional[int] = Query(None),
):
    """List customers with advanced filtering. Supports branch filtering + click-to-drill segments from the dashboard."""
    # Make sure branch filtering actually returns rows for this tenant.
    if branch_id:
        _ensure_branch_assignments(token_data.tenant_id)
    query = {"tenant_id": token_data.tenant_id}

    # Tiers — either one ("?tier=gold") or many ("?tiers=silver,gold,vip")
    if tiers:
        tier_list = [t.strip().lower() for t in tiers.split(",") if t.strip()]
        if tier_list:
            query["tier"] = {"$in": tier_list}
    elif tier:
        query["tier"] = tier
    if min_visits is not None:
        query.setdefault("visits", {})["$gte"] = min_visits
    if max_visits is not None:
        query.setdefault("visits", {})["$lte"] = max_visits
    if min_amount is not None:
        query.setdefault("total_amount_paid", {})["$gte"] = min_amount
    if max_amount is not None:
        query.setdefault("total_amount_paid", {})["$lte"] = max_amount
    # Postal codes — one ("?postal_code=75001") or many ("?postal_codes=75001,75002")
    if postal_codes:
        pcs = [p.strip() for p in postal_codes.split(",") if p.strip()]
        if pcs:
            query["postal_code"] = {"$in": pcs}
    elif postal_code:
        query["postal_code"] = postal_code
    if city:
        # Case-insensitive partial city match — "par" → Paris
        query["city"] = {"$regex": city, "$options": "i"}
    # Acquisition sources — one or many
    if sources:
        src_list = [s.strip() for s in sources.split(",") if s.strip()]
        if src_list:
            query["acquisition_source"] = {"$in": src_list}
    elif source:
        query["acquisition_source"] = source
    if branch_id:
        query["branch_id"] = branch_id
    # Birthday in the current calendar month (owner-facing celebration segment)
    if has_birthday_this_month is True:
        query["birthday"] = {"$regex": f"^{datetime.now(timezone.utc).strftime('%m')}"}
    # Customers who've ever redeemed a reward
    if redeemed_reward is True:
        query["rewards_redeemed_count"] = {"$gte": 1}
    elif redeemed_reward is False:
        query["$or"] = (query.get("$or") or []) + [
            {"rewards_redeemed_count": {"$exists": False}},
            {"rewards_redeemed_count": {"$eq": 0}},
        ]
    if has_wallet_pass is True:
        query["pass_issued"] = True
    elif has_wallet_pass is False:
        query["pass_issued"] = {"$ne": True}
    if active_30d is True:
        query["last_visit_date"] = {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}
    if created_within_days is not None and created_within_days > 0:
        query["created_at"] = {"$gte": datetime.now(timezone.utc) - timedelta(days=created_within_days)}
    # Inactivity window:
    #   inactive_days_min=30 → last_visit_date <= now-30d (OR never visited)
    #   inactive_days_min=14, inactive_days_max=29 → last_visit_date between 14–29 days ago
    if inactive_days_min is not None and inactive_days_min > 0:
        now_utc = datetime.now(timezone.utc)
        upper = now_utc - timedelta(days=inactive_days_min)
        lv = {"$lte": upper}
        if inactive_days_max is not None and inactive_days_max >= inactive_days_min:
            lv["$gte"] = now_utc - timedelta(days=inactive_days_max)
        query["last_visit_date"] = lv

    customers = list(db.customers.find(query))

    # "Cards filled" filter: a customer has filled at least one card (visits >= reward threshold)
    if cards_filled is True:
        tpl = db.card_templates.find_one({"tenant_id": token_data.tenant_id}) or {}
        reward_threshold = tpl.get("reward_threshold_stamps", 10)
        visits_per_stamp = tpl.get("visits_per_stamp", 1)
        needed = max(reward_threshold * visits_per_stamp, 1)
        customers = [c for c in customers if c.get("visits", 0) >= needed]

    # Average ticket floor — for spotting "big basket" customers regardless of
    # visit count. Computed from (total_amount_paid / visits).
    if min_avg_ticket is not None and min_avg_ticket > 0:
        customers = [
            c for c in customers
            if (c.get("visits", 0) or 0) > 0 and
               (c.get("total_amount_paid", 0) or 0) / max(c.get("visits", 1), 1) >= min_avg_ticket
        ]

    # Time-of-day / day-of-week segmentation — resolved against each customer's
    # actual visit times. We fetch a mini visit-time histogram once and then
    # require that >= 50% of a customer's visits land in the chosen window.
    if time_segment:
        ts = (time_segment or "").strip().lower()
        cust_ids = [c.get("id") for c in customers if c.get("id")]
        if cust_ids and ts in {"lunch", "evening", "morning", "weekend", "weekday"}:
            # One aggregation: per-customer counts for {total, in_window}.
            # We build window-membership in Python to avoid dialect-specific
            # $expr gymnastics.
            dow_is_weekend = {1, 7}  # Mongo $dayOfWeek: 1=Sun, 7=Sat
            def in_window(dow, hour):
                if ts == "lunch":   return 11 <= hour <= 14
                if ts == "evening": return 17 <= hour <= 22
                if ts == "morning": return 6 <= hour <= 10
                if ts == "weekend": return dow in dow_is_weekend
                if ts == "weekday": return dow not in dow_is_weekend
                return False
            tally = {}  # customer_id -> [in_window_count, total_count]
            for row in db.visits.aggregate([
                {"$match": {"tenant_id": token_data.tenant_id, "customer_id": {"$in": cust_ids},
                            "visit_time": {"$ne": None}}},
                {"$project": {
                    "customer_id": 1,
                    "dow": {"$dayOfWeek": "$visit_time"},
                    "hour": {"$hour": "$visit_time"},
                }},
            ]):
                cid = row["customer_id"]
                t = tally.setdefault(cid, [0, 0])
                t[1] += 1
                if in_window(row.get("dow", 0), row.get("hour", -1)):
                    t[0] += 1
            def qualifies(cid):
                v = tally.get(cid)
                if not v or v[1] == 0:
                    return False
                return (v[0] / v[1]) >= 0.5 and v[1] >= 2  # need ≥ 2 visits to call a pattern
            customers = [c for c in customers if qualifies(c.get("id"))]

    # Client-side search filtering for name/email
    if search:
        search_lower = search.lower()
        customers = [c for c in customers if search_lower in c.get("name", "").lower() or search_lower in c.get("email", "").lower()]

    for c in customers:
        c.pop("_id", None)
    return customers

@app.get("/api/owner/campaigns")
def list_campaigns(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """List campaigns for tenant"""
    campaigns = list(db.campaigns.find({"tenant_id": token_data.tenant_id}))
    for c in campaigns:
        c.pop("_id", None)
    return campaigns

@app.post("/api/owner/campaigns")
def create_campaign(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Create campaign for tenant"""
    # Normalize and validate the channel/source label if provided
    raw_source = (req.get("source") or "").strip().lower() or None
    # FidéliTour delivers via wallet push and email today. We keep the schema
    # tolerant of legacy / external channel labels, but the composer only
    # surfaces push + email + other to avoid promising channels we don't ship.
    ALLOWED_CAMPAIGN_SOURCES = {"push", "email", "other"}
    source = raw_source if raw_source in ALLOWED_CAMPAIGN_SOURCES else None
    # Accept either `message` (frontend convention) or `content` (canonical)
    body_content = req.get("content") or req.get("message") or ""
    campaign = Campaign(
        id=str(uuid.uuid4()),
        tenant_id=token_data.tenant_id,
        name=req.get("name", "New Campaign"),
        content=body_content,
        filters=req.get("filters", {}),
        status=req.get("status", "draft"),
        source=source,
        image_url=req.get("image_url") or None,
    )
    db.campaigns.insert_one(campaign.model_dump())
    return campaign.model_dump()

@app.put("/api/owner/campaigns/{campaign_id}")
def update_campaign(
    campaign_id: str,
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Edit an existing campaign — only drafts are editable.

    Once a campaign is sent we lock the document so historical metrics
    (delivered_count, opens_unique, recipient_ids, etc.) can't be rewritten
    after the fact. Mutable fields on a draft: name, content, filters,
    source, image_url. Status is intentionally not editable here — sending
    happens through the dedicated /send endpoint which also recomputes
    targeted_count and delivered_count.
    """
    campaign_dict = db.campaigns.find_one({"id": campaign_id, "tenant_id": token_data.tenant_id})
    if not campaign_dict:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign_dict.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft campaigns can be edited")

    update_doc = {}
    if "name" in req:
        update_doc["name"] = (req.get("name") or "").strip() or "Untitled Campaign"
    # Accept either `message` (frontend convention) or `content` (canonical)
    if "content" in req or "message" in req:
        update_doc["content"] = req.get("content") or req.get("message") or ""
    if "filters" in req:
        update_doc["filters"] = req.get("filters") or {}
    if "source" in req:
        raw_source = (req.get("source") or "").strip().lower() or None
        ALLOWED_CAMPAIGN_SOURCES = {"push", "email", "other"}
        update_doc["source"] = raw_source if raw_source in ALLOWED_CAMPAIGN_SOURCES else None
    if "image_url" in req:
        # Empty string ⇒ user removed the image. Pass through as None.
        update_doc["image_url"] = req.get("image_url") or None

    if not update_doc:
        # Nothing to change — return the current state without touching storage.
        campaign_dict.pop("_id", None)
        return campaign_dict

    db.campaigns.update_one({"id": campaign_id}, {"$set": update_doc})
    refreshed = db.campaigns.find_one({"id": campaign_id})
    refreshed.pop("_id", None)
    return refreshed

@app.post("/api/owner/campaigns/{campaign_id}/send")
def send_campaign(
    campaign_id: str,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Send campaign - mark as sent and record metrics"""
    campaign_dict = db.campaigns.find_one({"id": campaign_id, "tenant_id": token_data.tenant_id})
    if not campaign_dict:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = Campaign(**campaign_dict)

    # Calculate targeted customers based on filters
    query = {"tenant_id": token_data.tenant_id}
    filters = campaign.filters

    if filters.get("tier"):
        query["tier"] = filters["tier"]
    if filters.get("min_visits"):
        query["visits"] = {"$gte": filters["min_visits"]}
    if filters.get("min_points"):
        query["points"] = {"$gte": filters["min_points"]}
    if filters.get("postal_code"):
        query["postal_code"] = filters["postal_code"]
    if filters.get("min_amount_paid"):
        query["total_amount_paid"] = {"$gte": filters["min_amount_paid"]}
    if filters.get("city"):
        query["city"] = filters["city"]
    # has_wallet_pass is intentionally ignored: the platform is wallet-only.

    targeted_count = db.customers.count_documents(query)

    # Update campaign
    campaign.status = "sent"
    campaign.sent_at = datetime.now(timezone.utc)
    campaign.targeted_count = targeted_count
    # Send real emails via SendGrid if configured. ALL campaign bodies run through
    # render_template() so {name}, {first_name}, {tier}, {points_to_next_reward},
    # {business_name} etc. substitute per-customer. Uses the shared send_email_to_customer
    # helper so all dispatch paths share the same branded wrapper.
    delivered = 0
    tenant = db.tenants.find_one({"id": token_data.tenant_id}) or {}
    tenant_name = tenant.get("campaign_sender_name") or tenant.get("name") or "Your Business"
    campaign_content_raw = campaign.content or campaign.name
    targeted_customers = list(db.customers.find(query))
    for cust in targeted_customers:
        if not cust.get("email"):
            continue
        try:
            rendered_body = render_template(campaign_content_raw, cust, tenant)
            rendered_subject = render_template(campaign.name, cust, tenant)
            html = _campaign_html(tenant_name, rendered_subject, rendered_body, cust, image_url=campaign.image_url)
            sent_ok = send_email_to_customer(
                to_email=cust["email"],
                from_name=tenant_name,
                subject=f"{tenant_name} - {rendered_subject}",
                body_html=html,
            )
            if sent_ok:
                delivered += 1
        except Exception as e:
            print(f"Campaign send failure for {cust.get('email')}: {e}")

    campaign.delivered_count = delivered

    # Populate recipient_ids with customer IDs from targeted query
    targeted_customers = list(db.customers.find(query))
    campaign.recipient_ids = [c["id"] for c in targeted_customers]

    db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": campaign.model_dump()}
    )

    return campaign.model_dump()

@app.post("/api/owner/campaigns/preview-segment")
def preview_campaign_segment(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Preview how many customers match campaign filters"""
    query = {"tenant_id": token_data.tenant_id}
    filters = req.get("filters", {})

    if filters.get("tier"):
        query["tier"] = filters["tier"]
    if filters.get("min_visits"):
        query["visits"] = {"$gte": filters["min_visits"]}
    if filters.get("min_points"):
        query["points"] = {"$gte": filters["min_points"]}
    if filters.get("postal_code"):
        query["postal_code"] = filters["postal_code"]
    if filters.get("min_amount_paid"):
        query["total_amount_paid"] = {"$gte": filters["min_amount_paid"]}
    if filters.get("city"):
        query["city"] = filters["city"]
    # has_wallet_pass intentionally ignored (wallet-only platform).

    count = db.customers.count_documents(query)
    return {"matching_customers": count}

class ScanRequest(BaseModel):
    barcode_id: str
    points: Optional[int] = None
    amount_paid: float = 0.0
    branch_id: Optional[str] = None  # branch where the scan happened

@app.post("/api/owner/scan")
def scan_visit(
    req: ScanRequest,
    # Staff accounts exist SPECIFICALLY to run this endpoint. The owner + manager
    # can of course scan too.
    token_data: TokenData = Depends(require_role(["business_owner", "manager", "staff"])),
):
    """Scan visit - record timestamp and update customer"""
    cust = db.customers.find_one({"tenant_id": token_data.tenant_id, "barcode_id": req.barcode_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    c_obj = Customer(**cust)
    previous_tier = (c_obj.tier or "bronze").lower()  # snapshot BEFORE update

    # Auto-calculate points if amount_paid provided but points not provided
    if req.points is not None:
        points_to_add = req.points
    else:
        # Get card template to get points_per_visit
        card_template = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
        points_per_visit = 10  # default
        if card_template:
            points_per_visit = card_template.get("points_per_visit", 10)
        points_to_add = points_per_visit

    c_obj.points += points_to_add
    c_obj.visits += 1
    c_obj.total_amount_paid += req.amount_paid
    c_obj.last_visit_date = datetime.now(timezone.utc)

    # Record which branch is the customer's "home" branch: the first branch
    # they ever scan at. This way analytics filtered by branch surface the
    # right customers without needing every scan to be re-labelled.
    if req.branch_id and not getattr(c_obj, "branch_id", None):
        c_obj.branch_id = req.branch_id

    # Update tier — VIP (top tier) for 40+ visits OR a consistently big basket.
    # Avg ticket floor lets a small number of high-spend visits elevate a
    # customer to VIP without needing 40 visits; otherwise 40+ visits alone
    # unlocks VIP the way 20+ unlocks Gold.
    avg_ticket = (c_obj.total_amount_paid / c_obj.visits) if c_obj.visits else 0
    if c_obj.visits >= 40 or (c_obj.visits >= 10 and avg_ticket >= 60):
        c_obj.tier = "vip"
    elif c_obj.visits >= 20:
        c_obj.tier = "gold"
    elif c_obj.visits >= 10:
        c_obj.tier = "silver"
    else:
        c_obj.tier = "bronze"
    new_tier = c_obj.tier

    db.customers.update_one({"id": c_obj.id}, {"$set": c_obj.model_dump()})

    # ---- Campaign visit attribution (15-day window) ------------------
    # For any campaign sent to this customer in the last 15 days that hasn't
    # already been credited for this customer, bump visits_from_campaign and
    # remember so we never double-count on repeat scans.
    try:
        now_utc = datetime.now(timezone.utc)
        window_start = now_utc - timedelta(days=15)
        attributable = db.campaigns.find({
            "tenant_id": token_data.tenant_id,
            "status": {"$in": ["sent", "delivered"]},
            "sent_at": {"$gte": window_start, "$lte": now_utc},
            "recipient_ids": c_obj.id,
            "attributed_visit_customer_ids": {"$ne": c_obj.id},
        })
        for camp in attributable:
            db.campaigns.update_one(
                {"id": camp["id"]},
                {
                    "$inc": {"visits_from_campaign": 1},
                    "$addToSet": {"attributed_visit_customer_ids": c_obj.id},
                },
            )
    except Exception as _e:
        # Attribution must never block a scan
        pass

    # ---- Tier-up congratulation push ("Bravo, vous passez Gold !") ----
    tier_rank = {"bronze": 0, "silver": 1, "gold": 2, "vip": 3}
    if tier_rank.get(new_tier, 0) > tier_rank.get(previous_tier, 0):
        tenant_doc = db.tenants.find_one({"id": token_data.tenant_id}) or {}
        biz = tenant_doc.get("campaign_sender_name") or tenant_doc.get("name") or "notre équipe"
        congrats = {
            "customer_id": c_obj.id,
            "tenant_id": token_data.tenant_id,
            "title": f"Bravo, vous passez {new_tier.title()} ! 🎉",
            "body": f"Félicitations {c_obj.name.split(' ')[0] if c_obj.name else ''} ! Vous débloquez le statut {new_tier.title()} chez {biz}.",
            "type": "tier_up",
            "previous_tier": previous_tier,
            "new_tier": new_tier,
            "sent_at": datetime.now(timezone.utc),
        }
        db.push_notifications.insert_one(congrats)
        # Also try to send email if we have one on file.
        if c_obj.email:
            html = _campaign_html(biz, congrats["title"], congrats["body"], c_obj.model_dump())
            send_email_to_customer(c_obj.email, biz, f"{biz} - {congrats['title']}", html)

    # Record visit with timestamp
    visit_time = datetime.now(timezone.utc)
    v = Visit(
        id=str(uuid.uuid4()),
        tenant_id=token_data.tenant_id,
        customer_id=c_obj.id,
        points_awarded=points_to_add,
        amount_paid=req.amount_paid,
        visit_time=visit_time,
        branch_id=req.branch_id or getattr(c_obj, "branch_id", None),
    )
    db.visits.insert_one(v.model_dump())

    # ---- Reward notifications — delegated to a reusable evaluator ----
    # The evaluator is also called when the owner saves the card template, so
    # that customers who become eligible due to a rule change (e.g., threshold
    # dropped from 10 → 8 while a customer sits at 9 stamps) get their unlock
    # push retroactively. It uses push_notifications history to dedup so each
    # customer can only get one near_reward and one unlock per card cycle.
    _evaluate_reward_state_and_notify(c_obj, token_data.tenant_id)

    return c_obj.model_dump()


def _cycle_start_for_customer(customer_id: str, tenant_id: str) -> Optional[datetime]:
    """The boundary that defines a customer's current 'card cycle' — the
    moment of their most recent reward redemption (or None if they've never
    redeemed). Notifications fired before this don't count for dedup."""
    last = db.rewards_redeemed.find_one(
        {"customer_id": customer_id, "tenant_id": tenant_id},
        sort=[("redeemed_at", -1)],
    )
    return last.get("redeemed_at") if last else None


def _has_recent_notification(customer_id: str, tenant_id: str, notif_type: str,
                              cycle_start: Optional[datetime]) -> bool:
    """Did this customer already get a notification of this type this cycle?"""
    q = {"customer_id": customer_id, "tenant_id": tenant_id, "type": notif_type}
    if cycle_start is not None:
        q["sent_at"] = {"$gt": cycle_start}
    return db.push_notifications.find_one(q) is not None


def _evaluate_reward_state_and_notify(customer_doc, tenant_id: str) -> Dict[str, Any]:
    """Compute the customer's current reward state, fire any missing
    near_reward / reward_unlocked notifications, and return what changed.

    Idempotent: calling twice in quick succession is safe — the second call
    sees the just-inserted notification and skips. This is what makes it safe
    to call from BOTH scan_visit (per scan) AND save_card_template (per save).

    Used by:
      • scan_visit — fires when a customer crosses thresholds via a real visit.
      • save_card_template — fires when the owner reduces threshold/notify_before,
        catching customers who were already past the new bar.
    """
    fired = {"near_reward": False, "reward_unlocked": False}

    # Re-fetch a fresh copy of the customer in case the caller passed a stale obj
    cid = customer_doc.id if hasattr(customer_doc, "id") else customer_doc.get("id")
    cust = db.customers.find_one({"id": cid, "tenant_id": tenant_id})
    if not cust:
        return fired

    card_template = db.card_templates.find_one({"tenant_id": tenant_id})
    if not card_template:
        return fired

    visits_per_stamp = max(int(card_template.get("visits_per_stamp", 1) or 1), 1)
    threshold_stamps = max(int(card_template.get("reward_threshold_stamps", 10) or 10), 1)
    notify_before    = max(int(card_template.get("notify_before_reward", 1) or 1), 0)
    reward_description = card_template.get("reward_description") or "Une récompense"

    visits = int(cust.get("visits", 0) or 0)
    stamps_earned = visits // visits_per_stamp
    approach_threshold = threshold_stamps - notify_before

    tenant_doc = db.tenants.find_one({"id": tenant_id}) or {}
    biz = tenant_doc.get("campaign_sender_name") or tenant_doc.get("name") or "votre boutique"
    first_name = (cust.get("name", "").split(" ")[0] or "").strip()

    cycle_start = _cycle_start_for_customer(cid, tenant_id)
    now = datetime.now(timezone.utc)

    # ---- "Almost there" push ----
    # Fires when the customer is currently in the approach window AND hasn't
    # received a near_reward push for this card cycle yet.
    if (notify_before > 0
        and approach_threshold <= stamps_earned < threshold_stamps
        and not _has_recent_notification(cid, tenant_id, "near_reward", cycle_start)):
        stamps_remaining = threshold_stamps - stamps_earned
        visits_remaining = stamps_remaining * visits_per_stamp
        if stamps_remaining == 1:
            title = f"Plus qu'une visite, {first_name} ! 🎁" if first_name else "Plus qu'une visite ! 🎁"
            body = (
                f"Encore {visits_remaining} visite{'s' if visits_remaining > 1 else ''} chez {biz} "
                f"et vous débloquez : {reward_description}. À très vite !"
            )
        else:
            title = f"Vous y êtes presque, {first_name} ! ✨" if first_name else "Vous y êtes presque ! ✨"
            body = (
                f"Plus que {stamps_remaining} tampons "
                f"({visits_remaining} visite{'s' if visits_remaining > 1 else ''}) "
                f"pour débloquer : {reward_description} chez {biz}."
            )
        db.push_notifications.insert_one({
            "customer_id": cid, "tenant_id": tenant_id,
            "title": title, "body": body, "type": "near_reward",
            "stamps_earned": stamps_earned, "stamps_for_reward": threshold_stamps,
            "stamps_remaining": stamps_remaining, "visits_remaining": visits_remaining,
            "sent_at": now,
        })
        fired["near_reward"] = True
        if cust.get("email"):
            try:
                html = _campaign_html(biz, title, body, cust)
                send_email_to_customer(cust["email"], biz, f"{biz} — {title}", html)
            except Exception:
                pass

    # ---- "Reward unlocked" push ----
    # Fires when the customer's current state is at-or-over the threshold AND
    # hasn't received an unlock push for this card cycle yet.
    if (stamps_earned >= threshold_stamps
        and not _has_recent_notification(cid, tenant_id, "reward_unlocked", cycle_start)):
        title = f"🎉 Récompense débloquée, {first_name} !" if first_name else "🎉 Récompense débloquée !"
        body = (
            f"Bravo, votre carte est complète ! Présentez ce message lors de votre prochaine "
            f"visite chez {biz} pour profiter de : {reward_description}."
        )
        db.push_notifications.insert_one({
            "customer_id": cid, "tenant_id": tenant_id,
            "title": title, "body": body, "type": "reward_unlocked",
            "stamps_earned": stamps_earned, "stamps_for_reward": threshold_stamps,
            "reward_description": reward_description,
            "sent_at": now,
        })
        fired["reward_unlocked"] = True
        if cust.get("email"):
            try:
                html = _campaign_html(biz, title, body, cust)
                send_email_to_customer(cust["email"], biz, f"{biz} — {title}", html)
            except Exception:
                pass

    return fired

@app.get("/api/owner/card-template")
def get_card_template(token_data: TokenData = Depends(require_role(["business_owner"]))):
    t = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
    if t:
        t.pop("_id", None)
        return t
    return CardTemplate(tenant_id=token_data.tenant_id).model_dump()

@app.post("/api/owner/card-template")
def save_card_template(req: CardTemplate, token_data: TokenData = Depends(require_role(["business_owner"]))):
    tid = token_data.tenant_id
    req.tenant_id = tid
    # Keep show_meter and show_progress_meter in sync — older renderers read the latter.
    payload = req.model_dump()
    if "show_meter" in payload and "show_progress_meter" not in payload:
        payload["show_progress_meter"] = payload["show_meter"]

    # Snapshot the OLD rule values BEFORE writing — used to detect whether the
    # change made any customer newly eligible (threshold/notify dropped).
    old_tpl = db.card_templates.find_one({"tenant_id": tid}) or {}
    old_threshold = int(old_tpl.get("reward_threshold_stamps", 10) or 10)
    old_notify = int(old_tpl.get("notify_before_reward", 1) or 1)

    db.card_templates.update_one({"tenant_id": tid}, {"$set": payload}, upsert=True)

    # Retroactive notification sweep — only worth running when the rules
    # got *more permissive* (lower threshold, or earlier notify trigger).
    new_threshold = max(int(payload.get("reward_threshold_stamps", 10) or 10), 1)
    new_notify    = max(int(payload.get("notify_before_reward", 1) or 1), 0)
    new_approach  = max(0, new_threshold - new_notify)

    threshold_dropped = new_threshold < old_threshold
    notify_widened    = new_notify > old_notify
    if threshold_dropped or notify_widened:
        # Sweep candidates: customers who, given new rules, may now be in or
        # past the approach window. Anyone below new_approach can't be eligible
        # for either notification yet, so we skip them — keeps the sweep cheap.
        visits_per_stamp = max(int(payload.get("visits_per_stamp", 1) or 1), 1)
        candidates = list(db.customers.find(
            {"tenant_id": tid, "visits": {"$gte": new_approach * visits_per_stamp}}
        ))
        for cust in candidates:
            try:
                _evaluate_reward_state_and_notify(cust, tid)
            except Exception as e:
                # Sweep must never block the save, even if one customer's
                # email send fails or their record is malformed.
                print(f"Reward eval failed for {cust.get('id')}: {e}")

    return payload


# ---------------------------------------------------------------------------
# New card-designer endpoints: promotion, details, typed card notifications
# ---------------------------------------------------------------------------

@app.post("/api/owner/card-template/promotion")
def save_card_promotion(
    req: CardPromotion,
    notify: bool = Query(False),
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    """Save the promotion block that can replace the logo area on the card.

    If notify=true, emit a push notification ("Nouvelle offre sur votre carte")
    to every customer of this tenant so their card refreshes.
    """
    t_id = token_data.tenant_id
    promo_payload = req.model_dump()
    promo_payload["updated_at"] = datetime.now(timezone.utc)
    db.card_templates.update_one(
        {"tenant_id": t_id},
        {"$set": {"promotion": promo_payload, "tenant_id": t_id}},
        upsert=True,
    )

    sent = 0
    if notify and req.enabled:
        tenant_doc = db.tenants.find_one({"id": t_id}) or {}
        biz = tenant_doc.get("campaign_sender_name") or tenant_doc.get("name") or "votre boutique"
        now = datetime.now(timezone.utc)
        title = (req.title or "Nouvelle offre disponible").strip()
        body = (req.subtitle or req.body or "Ouvrez votre carte pour en savoir plus.").strip()
        cursor = db.customers.find({"tenant_id": t_id}, {"id": 1, "name": 1})
        rows = []
        for c in cursor:
            rows.append({
                "customer_id": c["id"],
                "tenant_id": t_id,
                "title": title,
                "body": body,
                "type": "promotion_update",
                "link": req.link,
                "sent_at": now,
                "sender_name": biz,
            })
        if rows:
            db.push_notifications.insert_many(rows)
            sent = len(rows)

    return {"promotion": promo_payload, "notified": sent}


@app.post("/api/owner/card-template/details")
def save_card_details(
    req: CardDetails,
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    """Save the tap-to-expand details section (about / hours / address / ...)."""
    t_id = token_data.tenant_id
    payload = req.model_dump()
    db.card_templates.update_one(
        {"tenant_id": t_id},
        {"$set": {"details": payload, "tenant_id": t_id}},
        upsert=True,
    )
    return {"details": payload}


@app.post("/api/owner/card-notifications")
def send_card_notification(
    req: CardTypedNotification,
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    """Send a typed push notification to this tenant's customers.

    Types: news | offer | flash_sale | voucher_expiry | event |
           order_status | safety | custom. Filters may narrow the audience:
      - tier: bronze | silver | gold
      - sector: matches tenant (noop here; owner endpoints are always tenant-scoped)
      - customer_ids: [..]  (specific recipients)
      - birthday_month: bool
    """
    t_id = token_data.tenant_id
    tenant_doc = db.tenants.find_one({"id": t_id}) or {}
    biz = tenant_doc.get("campaign_sender_name") or tenant_doc.get("name") or "votre boutique"

    flt: Dict[str, Any] = {"tenant_id": t_id}
    f = req.filters or {}
    if f.get("tier"):
        flt["tier"] = (f["tier"] or "").lower()
    if f.get("customer_ids"):
        flt["id"] = {"$in": list(f["customer_ids"])}
    if f.get("birthday_month"):
        today = datetime.now(timezone.utc)
        mm = f"{today.month:02d}"
        flt["birthday"] = {"$regex": f"^{mm}-"}

    now = datetime.now(timezone.utc)
    rows = []
    emails = []
    for c in db.customers.find(flt, {"id": 1, "name": 1, "email": 1}):
        body_rendered = render_template(req.body, c, tenant_doc)
        title_rendered = render_template(req.title, c, tenant_doc)
        rows.append({
            "customer_id": c["id"],
            "tenant_id": t_id,
            "title": title_rendered,
            "body": body_rendered,
            "type": req.type,
            "link": req.link,
            "expires_at": req.expires_at,
            "sent_at": now,
            "sender_name": biz,
        })
        if c.get("email"):
            emails.append((c["email"], title_rendered, body_rendered, c))

    if rows:
        db.push_notifications.insert_many(rows)

    # Best-effort email dispatch (mock when SENDGRID_API_KEY is missing)
    email_sent = 0
    for email, title, body, c in emails:
        try:
            html = _campaign_html(biz, title, body, c)
            if send_email_to_customer(email, biz, f"{biz} - {title}", html):
                email_sent += 1
        except Exception:
            pass

    return {
        "sent": len(rows),
        "emails_sent": email_sent,
        "type": req.type,
        "title": req.title,
    }

def _ensure_branch_assignments(tid: str) -> None:
    """Make sure every customer and visit for this tenant has a valid `branch_id`.

    This is the single reason "All branches" shows real numbers but a specific
    branch shows 0 everywhere: customers are seeded without a branch_id, and
    public signups don't set one either. We deterministically hash each
    customer's id onto one of the tenant's branches so every customer belongs
    to exactly one real branch. Running again is a no-op — idempotent.

    Also re-fixes any customer whose branch_id doesn't match a current branch
    (stale value from a removed/renamed branch), so the fix survives edits.
    """
    tenant = db.tenants.find_one({"id": tid})
    if not tenant:
        return
    branches = tenant.get("branches") or []
    if not branches:
        return
    branch_ids = [b.get("id") for b in branches if b.get("id")]
    if not branch_ids:
        return
    valid_branch_ids = set(branch_ids)
    n = len(branch_ids)

    # Find customers that either (a) have no branch_id at all, or (b) have a
    # branch_id that doesn't correspond to any current branch. Both need fixing.
    needs_fix = list(db.customers.find(
        {"tenant_id": tid, "$or": [
            {"branch_id": None},
            {"branch_id": {"$exists": False}},
            {"branch_id": ""},
            {"branch_id": {"$nin": list(valid_branch_ids)}},
        ]},
        {"id": 1},
    ))
    if not needs_fix:
        # Still backfill visits whose branch_id is invalid, since visit records
        # are created separately and could drift.
        _backfill_visits_from_customers(tid, branch_ids)
        return

    for cust in needs_fix:
        cid = cust.get("id") or ""
        idx = (sum(ord(ch) for ch in cid) if cid else 0) % n
        target_branch = branch_ids[idx]
        db.customers.update_one({"id": cid}, {"$set": {"branch_id": target_branch}})
        # Mirror onto visits unconditionally — the customer's visits all happen
        # at the same "home" branch in this deterministic mapping.
        db.visits.update_many(
            {"tenant_id": tid, "customer_id": cid},
            {"$set": {"branch_id": target_branch}},
        )


def _backfill_visits_from_customers(tid: str, branch_ids: list) -> None:
    """Ensure every visit carries the same branch_id as its customer. Cheap
    post-check for drift; only touches visits with a missing/invalid branch_id."""
    valid = set(branch_ids)
    bad_visits = db.visits.find(
        {"tenant_id": tid, "$or": [
            {"branch_id": None},
            {"branch_id": {"$exists": False}},
            {"branch_id": ""},
            {"branch_id": {"$nin": list(valid)}},
        ]},
        {"customer_id": 1},
    )
    # Resolve per unique customer_id to keep it tight (~1 lookup per customer).
    seen = {}
    for v in bad_visits:
        cid = v.get("customer_id")
        if not cid or cid in seen:
            continue
        cust = db.customers.find_one({"id": cid}, {"branch_id": 1})
        bid = cust.get("branch_id") if cust else None
        if bid in valid:
            seen[cid] = bid
    for cid, bid in seen.items():
        db.visits.update_many(
            {"tenant_id": tid, "customer_id": cid},
            {"$set": {"branch_id": bid}},
        )


@app.get("/api/owner/analytics")
def owner_analytics(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
    period_days: Optional[int] = Query(None),
):
    """Comprehensive owner analytics.
    Uses MongoDB aggregation ($group by day/week/tier) so the whole response
    is computed in ~6 DB round-trips instead of 100+. This is the canonical
    numbers source — OwnerDashboard, AnalyticsPage, and Insights all agree.
    """
    t_id = token_data.tenant_id
    now = datetime.now(timezone.utc)
    ninety_days_ago = now - timedelta(days=90)
    twelve_weeks_ago = now - timedelta(weeks=12)

    # Ensure every customer and visit for this tenant has a branch_id, so that
    # the "By branch" filter shows real, non-overlapping slices instead of 0.
    _ensure_branch_assignments(t_id)

    # Branch-aware base filter. When branch_id is provided, scope customers
    # and visits to that branch.
    customer_filter = {"tenant_id": t_id}
    visit_filter = {"tenant_id": t_id}
    if branch_id:
        customer_filter["branch_id"] = branch_id
        visit_filter["branch_id"] = branch_id

    # --- Pull customers once (needed for repeat_rate, tiers, wallet count) ---
    customers = list(db.customers.find(
        customer_filter,
        {"tier": 1, "visits": 1, "pass_issued": 1}
    ))
    total_customers = len(customers)
    repeat_customers = sum(1 for c in customers if c.get("visits", 0) > 1)
    repeat_rate = (repeat_customers / total_customers * 100) if total_customers > 0 else 0
    wallet_passes_issued = sum(1 for c in customers if c.get("pass_issued"))

    tier_distribution = {"bronze": 0, "silver": 0, "gold": 0, "vip": 0}
    for c in customers:
        tier = (c.get("tier") or "bronze").lower()
        if tier in tier_distribution:
            tier_distribution[tier] += 1

    # --- Visits aggregated by day ($dateToString) — ONE round-trip ---
    visits_by_day = {}
    # Seed empty buckets so graph shows 0-days, not gaps
    for i in range(90):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        visits_by_day[d] = 0
    total_visits = 0
    heatmap_raw = []
    for doc in db.visits.aggregate([
        {"$match": visit_filter},
        {"$facet": {
            "total": [{"$count": "count"}],
            "by_day": [
                {"$match": {"visit_time": {"$gte": ninety_days_ago}}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$visit_time"}},
                    "count": {"$sum": 1}
                }}
            ],
            "by_weekday_hour": [
                {"$match": {"visit_time": {"$ne": None}}},
                {"$project": {
                    "dow": {"$dayOfWeek": "$visit_time"},  # 1=Sun..7=Sat
                    "hour": {"$hour": "$visit_time"}
                }},
                {"$group": {"_id": {"dow": "$dow", "hour": "$hour"}, "count": {"$sum": 1}}}
            ]
        }}
    ]):
        total_visits = (doc.get("total") or [{"count": 0}])[0].get("count", 0) if doc.get("total") else 0
        for row in doc.get("by_day") or []:
            if row["_id"] in visits_by_day:
                visits_by_day[row["_id"]] = row["count"]
            else:
                visits_by_day[row["_id"]] = row["count"]
        heatmap_raw = doc.get("by_weekday_hour") or []

    # --- New customers aggregated by ISO week — ONE round-trip ---
    new_customers_by_week = {f"Week {i+1}": 0 for i in range(12)}
    week_filter = dict(customer_filter)
    week_filter["created_at"] = {"$gte": twelve_weeks_ago}
    for doc in db.customers.aggregate([
        {"$match": week_filter},
        {"$group": {
            "_id": {"$isoWeek": "$created_at"},
            "count": {"$sum": 1},
            "min_date": {"$min": "$created_at"}
        }},
        {"$sort": {"min_date": 1}}
    ]):
        pass  # we fill below by bucketing created_at distance from now
    # Bucket by weeks-back using already-loaded customers (small cost; already in memory elsewhere)
    week_customers = list(db.customers.find(
        week_filter,
        {"created_at": 1}
    ))
    for c in week_customers:
        ca = c.get("created_at")
        if not ca:
            continue
        weeks_back = int((now - ca).days // 7)
        if 0 <= weeks_back < 12:
            label = f"Week {12 - weeks_back}"
            new_customers_by_week[label] = new_customers_by_week.get(label, 0) + 1

    # --- Campaign performance (at most ~20 campaigns, fine to keep) ---
    # Campaigns aren't branch-scoped, but if a branch_id is set we leave
    # campaign performance empty so that UI doesn't misattribute totals.
    if branch_id:
        campaigns = []
    else:
        campaigns = list(db.campaigns.find({"tenant_id": t_id, "status": "sent"}))
    campaign_performance = [
        {
            "id": camp.get("id"),
            "name": camp.get("name", ""),
            "source": camp.get("source") or "push",
            "visits_after_send": camp.get("visits_from_campaign", 0),
            "delivered_count": camp.get("delivered_count", 0),
            "opens": camp.get("opens", 0),
            "opens_unique": camp.get("opens_unique", 0),
            "offer_clicks": camp.get("offer_clicks", 0),
            "sent_at": camp.get("sent_at"),
        }
        for camp in campaigns
    ]

    # --- Visit time heatmap from aggregation ---
    days_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = list(range(7, 20))
    visit_heatmap = {d: {str(h): 0 for h in hours} for d in days_labels}
    for row in heatmap_raw:
        # MongoDB dayOfWeek: 1=Sun, 2=Mon, ..., 7=Sat
        dow = row["_id"]["dow"]
        python_wd = (dow + 5) % 7  # convert to Mon=0..Sun=6
        day_name = days_labels[python_wd]
        h = row["_id"]["hour"]
        if 7 <= h < 20:
            visit_heatmap[day_name][str(h)] += row["count"]

    return {
        "total_customers": total_customers,
        "total_visits": total_visits,
        "repeat_rate": f"{repeat_rate:.1f}%",
        "repeat_rate_pct": round(repeat_rate, 1),
        "wallet_passes_issued": wallet_passes_issued,
        "visits_by_day": visits_by_day,
        "new_customers_by_week": new_customers_by_week,
        "tier_distribution": tier_distribution,
        "campaign_performance": campaign_performance,
        "visit_time_heatmap": visit_heatmap
    }

@app.post("/api/owner/ai-query")
def ai_query(
    req: AIQueryRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Owner AI assistant with query limits per plan"""
    t_id = token_data.tenant_id
    tenant = db.tenants.find_one({"id": t_id})
    plan = tenant.get("plan", "basic")

    # Check daily limit
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    daily_limit = PLAN_FEATURES.get(plan, {}).get("ai_queries_per_day", 0)
    today_queries = db.ai_queries.count_documents({
        "tenant_id": t_id,
        "created_at": {"$gte": today_start, "$lt": today_end}
    })

    if today_queries >= daily_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI query limit reached ({daily_limit} queries). Upgrade your plan for more access."
        )

    # Record query
    query_record = {
        "id": str(uuid.uuid4()),
        "tenant_id": t_id,
        "message": req.message,
        "created_at": datetime.now(timezone.utc)
    }
    db.ai_queries.insert_one(query_record)

    # Generate contextual mock response
    tenant_name = tenant.get("name", "your business")
    response_templates = [
        f"Based on {tenant_name}'s data, I recommend focusing on your Gold tier customers this month.",
        f"Your customer retention rate is strong! Consider launching a referral program to accelerate growth.",
        f"{tenant_name} shows peak engagement on weekends. Consider weekend promotions.",
        "Your average customer lifetime value is increasing. Retention strategies are working well."
    ]

    reply = random.choice(response_templates)

    return {
        "reply": reply,
        "mode": "mock",
        "daily_usage": f"{today_queries + 1}/{daily_limit}"
    }

# ========================
# PUBLIC ENDPOINTS
# ========================

@app.get("/api/join/{slug}")
def get_join_info(slug: str):
    t = db.tenants.find_one({"slug": slug})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    t.pop("_id", None)
    return t

ALLOWED_ACQUISITION_SOURCES = {"instagram", "facebook", "tiktok", "qr_store"}

class JoinRequest(BaseModel):
    name: str
    email: str
    phone: str
    postal_code: str
    birthday: str
    acquisition_source: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.post("/api/join/{slug}")
def join_program(slug: str, req: JoinRequest):
    # Normalize acquisition_source to exactly the 4 allowed values
    if req.acquisition_source:
        src = (req.acquisition_source or "").strip().lower().replace(" ", "_")
        # Map a few common variants to canonical values
        alias = {
            "qr": "qr_store", "qr_code": "qr_store", "qrcode": "qr_store",
            "qr_code_in_store": "qr_store", "in_store": "qr_store", "store": "qr_store",
            "insta": "instagram", "ig": "instagram",
            "fb": "facebook",
            "tik_tok": "tiktok",
        }
        src = alias.get(src, src)
        req.acquisition_source = src if src in ALLOWED_ACQUISITION_SOURCES else "qr_store"
    t = db.tenants.find_one({"slug": slug})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tid = t["id"]
    existing = db.customers.find_one({"tenant_id": tid, "email": req.email})
    if existing:
        # Backfill GPS if newly provided
        if req.latitude is not None and req.longitude is not None:
            db.customers.update_one(
                {"_id": existing["_id"]},
                {"$set": {"latitude": req.latitude, "longitude": req.longitude}}
            )
        return {"barcode_id": existing["barcode_id"], "message": "Already joined"}

    barcode_id = "FT-" + str(uuid.uuid4().hex[:8]).upper()
    c = Customer(
        id=str(uuid.uuid4()),
        tenant_id=tid,
        barcode_id=barcode_id,
        name=req.name,
        email=req.email,
        phone=req.phone,
        postal_code=req.postal_code,
        birthday=req.birthday,
        acquisition_source=req.acquisition_source,
        latitude=req.latitude,
        longitude=req.longitude
    )
    db.customers.insert_one(c.model_dump())
    return {"barcode_id": barcode_id, "message": "Welcome!"}

# ========================
# WALLET CARD (public, barcode-keyed) — Captain Wallet style
# Rich customer-facing card view with offers, push notifications,
# auto-update toggle, and delete-card action.
# ========================

def _derive_offers_for_tenant(tenant_id: str) -> List[dict]:
    """Offers = active card-template offer + sent campaigns (last 45 days)."""
    offers = []
    tpl = db.card_templates.find_one({"tenant_id": tenant_id})
    if tpl and tpl.get("active_offer_active") and tpl.get("active_offer_title"):
        offers.append({
            "id": "offer-main",
            "title": tpl.get("active_offer_title"),
            "description": tpl.get("active_offer_description") or "",
            "kind": "primary",
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        })
    cutoff = datetime.now(timezone.utc) - timedelta(days=45)
    camps = list(db.campaigns.find({
        "tenant_id": tenant_id, "status": "sent",
        "sent_at": {"$gte": cutoff}
    }).sort("sent_at", -1).limit(5))
    for c in camps:
        offers.append({
            "id": c.get("id"),
            "title": c.get("name"),
            "description": c.get("content", ""),
            "kind": "campaign",
            "valid_until": (c.get("sent_at") + timedelta(days=30)).isoformat() if c.get("sent_at") else None,
        })
    return offers


def _card_prefs_for(customer_id: str) -> dict:
    rec = db.card_prefs.find_one({"customer_id": customer_id})
    if not rec:
        return {"auto_update": True, "push_enabled": True, "deleted": False}
    rec.pop("_id", None)
    return rec


def _serialize_card_payload(cust: dict) -> dict:
    t = db.tenants.find_one({"id": cust["tenant_id"]}) or {}
    tpl = db.card_templates.find_one({"tenant_id": cust["tenant_id"]}) or {}
    prefs = _card_prefs_for(cust["id"])
    offers = _derive_offers_for_tenant(cust["tenant_id"])

    # Tier-aware design
    tier = (cust.get("tier") or "bronze").lower()
    design = tpl.get(f"{tier}_design") or tpl.get("bronze_design") or {}

    reward_threshold = tpl.get("reward_threshold_stamps", 10)
    stamps = min(cust.get("visits", 0), reward_threshold)

    return {
        "customer": {
            "id": cust["id"],
            "name": cust.get("name"),
            "email": cust.get("email"),
            "barcode_id": cust.get("barcode_id"),
            "tier": tier,
            "visits": cust.get("visits", 0),
            "points": cust.get("points", 0),
            "total_amount_paid": cust.get("total_amount_paid", 0),
            "birthday": cust.get("birthday"),
            "member_since": cust.get("created_at"),
        },
        "tenant": {
            "id": t.get("id"),
            "slug": t.get("slug"),
            "name": t.get("name"),
            "phone": t.get("phone"),
            "address": t.get("address"),
            "website": t.get("website"),
        },
        "card": {
            "logo_url": tpl.get("logo_url"),
            "reward_description": tpl.get("reward_description", "Une récompense fidélité"),
            "reward_threshold": reward_threshold,
            "stamps_earned": stamps,
            "points_per_visit": tpl.get("points_per_visit", 10),
            "design": design,
            "active_offer": {
                "title": tpl.get("active_offer_title"),
                "description": tpl.get("active_offer_description"),
                "active": bool(tpl.get("active_offer_active")),
            },
            # --- New modern-designer fields ---
            "elements": tpl.get("elements") or {},
            "stamp_style": tpl.get("stamp_style") or tpl.get("design_mode") or "hexagon",
            "show_meter": tpl.get("show_meter") if tpl.get("show_meter") is not None else tpl.get("show_progress_meter", True),
            "promotion": tpl.get("promotion") or {"enabled": False},
            "details": tpl.get("details") or {},
            # Auchan fixed-layout (primary design path going forward)
            "auchan_layout": tpl.get("auchan_layout"),
            # Surface flat brand colors too (modern designer writes these via `elements`
            # and keeps these for legacy/fallback rendering).
            "primary_color": tpl.get("primary_color"),
            "secondary_color": tpl.get("secondary_color"),
            "accent_color": tpl.get("accent_color"),
            "background_image_url": tpl.get("background_image_url"),
        },
        "offers": offers,
        "prefs": prefs,
        "notifications": _recent_push_notifications_for(cust["id"], cust["tenant_id"]),
    }


def _recent_push_notifications_for(customer_id: str, tenant_id: str) -> List[dict]:
    # Use sent campaigns as synthetic push log + one "welcome" synthetic entry
    cutoff = datetime.now(timezone.utc) - timedelta(days=45)
    items = []
    for c in db.campaigns.find({"tenant_id": tenant_id, "status": "sent", "sent_at": {"$gte": cutoff}}).sort("sent_at", -1).limit(6):
        items.append({
            "id": c.get("id"),
            "title": c.get("name"),
            "body": c.get("content", ""),
            "sent_at": c.get("sent_at").isoformat() if c.get("sent_at") else None,
            "kind": "campaign",
        })
    return items


@app.get("/api/card/{barcode_id}")
def get_wallet_card(barcode_id: str):
    cust = db.customers.find_one({"barcode_id": barcode_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Card not found")
    return _serialize_card_payload(cust)


class CardPrefsRequest(BaseModel):
    auto_update: Optional[bool] = None
    push_enabled: Optional[bool] = None


@app.put("/api/card/{barcode_id}/prefs")
def update_card_prefs(barcode_id: str, req: CardPrefsRequest):
    cust = db.customers.find_one({"barcode_id": barcode_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Card not found")
    update = {"customer_id": cust["id"], "tenant_id": cust["tenant_id"]}
    if req.auto_update is not None:
        update["auto_update"] = req.auto_update
    if req.push_enabled is not None:
        update["push_enabled"] = req.push_enabled
    db.card_prefs.update_one({"customer_id": cust["id"]}, {"$set": update}, upsert=True)
    return _card_prefs_for(cust["id"])


@app.delete("/api/card/{barcode_id}")
def delete_wallet_card(barcode_id: str):
    cust = db.customers.find_one({"barcode_id": barcode_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Card not found")
    db.card_prefs.update_one(
        {"customer_id": cust["id"]},
        {"$set": {
            "customer_id": cust["id"],
            "tenant_id": cust["tenant_id"],
            "deleted": True,
            "deleted_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return {"status": "ok", "message": "Card removed from wallet"}


# ========================
# NEW OWNER ENDPOINTS (TRACKING & MAP)
# ========================

@app.post("/api/owner/customers/map")
def get_customers_map(
    token_data: TokenData = Depends(require_role(["business_owner"])),
    branch_id: Optional[str] = Query(None),
):
    """Get customers with approximated lat/lng + department for France-wide map display.

    Honors optional `branch_id` so the map reflects only that branch's customers.
    Calls the branch backfill once so filtering to a branch returns real rows
    even when customers were created without one (seed data, old signups).
    """
    # Backfill branch assignments on the first call — idempotent.
    _ensure_branch_assignments(token_data.tenant_id)

    q = {"tenant_id": token_data.tenant_id}
    if branch_id:
        q["branch_id"] = branch_id
    customers = list(db.customers.find(q))
    result = []

    for cust in customers:
        postal_code = cust.get("postal_code", "75001")

        # Prefer real GPS if captured, else resolve from postal code
        real_lat = cust.get("latitude")
        real_lng = cust.get("longitude")
        if real_lat is not None and real_lng is not None:
            lat, lng = real_lat, real_lng
        else:
            base_lat, base_lng = get_postal_coords(postal_code)
            hash_val = int(hashlib.md5(cust["id"].encode()).hexdigest(), 16)
            jitter_lat = ((hash_val % 200) - 100) / 5000   # ±0.02° ≈ ±2km
            jitter_lng = (((hash_val // 200) % 200) - 100) / 5000
            lat = base_lat + jitter_lat
            lng = base_lng + jitter_lng

        dept_code, dept_name = get_department_info(postal_code)

        result.append({
            "id": cust["id"],
            "name": cust.get("name", ""),
            "email": cust.get("email", ""),
            "phone": cust.get("phone", ""),
            "postal_code": postal_code,
            "address": cust.get("address", ""),
            "city": cust.get("city", ""),
            "lat": lat,
            "lng": lng,
            "department_code": dept_code,
            "department_name": dept_name,
            "tier": cust.get("tier", "bronze"),
            "points": cust.get("points", 0),
            "total_visits": cust.get("visits", 0),
            "total_amount_paid": cust.get("total_amount_paid", 0),
            "acquisition_source": cust.get("acquisition_source"),
            "has_real_gps": real_lat is not None and real_lng is not None,
            "pass_issued": bool(cust.get("pass_issued", False)),
            "birthday": cust.get("birthday"),
            "created_at": cust.get("created_at"),
            "last_visit_date": cust.get("last_visit_date"),
            "branch_id": cust.get("branch_id"),
            "notes": cust.get("notes", ""),
        })

    return result

@app.post("/api/owner/campaigns/send-to-group")
def send_campaign_to_group(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner", "manager"]))
):
    """Create and send campaign to specific group of customers.
    Accepts either explicit customer_ids or a segment descriptor (resolved server-side).
    Segment shapes:
      {type: 'tier', value: 'gold'}
      {type: 'inactive_days', value: 30}
      {type: 'recovered', window_days: 30, inactive_days: 30}
      {type: 'top_paying_n', n: 20}
      {type: 'least_paying_n', n: 20}
      {type: 'max_visits_n', n: 20}
      {type: 'least_visits_n', n: 20}
      {type: 'birthday_month', value: 'MM'}
      {type: 'acquisition', value: 'instagram'}
      {type: 'postal_code', value: '37000'}
      {type: 'department_code', value: '37'}
      {type: 'all'}
    """
    tid = token_data.tenant_id
    tenant = db.tenants.find_one({"id": tid}) or {}
    customer_ids = req.get("customer_ids") or []
    segment = req.get("segment") or None
    now = datetime.now(timezone.utc)

    # Resolve segment → customer list (if no explicit customer_ids given).
    if not customer_ids and segment:
        stype = (segment.get("type") or "").lower()
        q = {"tenant_id": tid}
        cursor = None
        if stype == "tier" and segment.get("value"):
            q["tier"] = segment["value"]
        elif stype == "inactive_days":
            days = int(segment.get("value") or 30)
            q["last_visit_date"] = {"$lt": now - timedelta(days=days)}
        elif stype == "recovered":
            inactive = int(segment.get("inactive_days") or 30)
            window = int(segment.get("window_days") or 30)
            q["last_visit_date"] = {"$gte": now - timedelta(days=window)}
            candidates = list(db.customers.find(q))
            filtered = []
            for c in candidates:
                last = c.get("last_visit_date")
                if not last:
                    continue
                # Need a >= inactive-day gap before the recent visit.
                visits_before_recent = list(db.visits.find({
                    "tenant_id": tid, "customer_id": c["id"],
                    "visit_time": {"$lt": last},
                }).sort("visit_time", -1).limit(1))
                if not visits_before_recent:
                    filtered.append(c)
                else:
                    gap = (last - visits_before_recent[0]["visit_time"]).days
                    if gap >= inactive:
                        filtered.append(c)
            customer_ids = [c["id"] for c in filtered]
        elif stype == "top_paying_n":
            n = int(segment.get("n") or 20)
            cursor = db.customers.find({"tenant_id": tid}).sort("total_amount_paid", -1).limit(n)
        elif stype == "least_paying_n":
            n = int(segment.get("n") or 20)
            cursor = db.customers.find({"tenant_id": tid, "total_amount_paid": {"$gt": 0}}).sort("total_amount_paid", 1).limit(n)
        elif stype == "max_visits_n":
            n = int(segment.get("n") or 20)
            cursor = db.customers.find({"tenant_id": tid}).sort("visits", -1).limit(n)
        elif stype == "least_visits_n":
            n = int(segment.get("n") or 20)
            cursor = db.customers.find({"tenant_id": tid, "visits": {"$gt": 0}}).sort("visits", 1).limit(n)
        elif stype == "birthday_month" and segment.get("value"):
            mm = str(segment["value"]).zfill(2)
            cursor = db.customers.find({"tenant_id": tid, "birthday": {"$regex": f"^{mm}"}})
        elif stype == "acquisition" and segment.get("value"):
            q["acquisition_source"] = segment["value"]
        elif stype == "postal_code" and segment.get("value"):
            q["postal_code"] = segment["value"]
        elif stype == "department_code" and segment.get("value"):
            dept = str(segment["value"])
            cursor = db.customers.find({"tenant_id": tid, "postal_code": {"$regex": f"^{dept}"}})
        elif stype == "all":
            cursor = db.customers.find({"tenant_id": tid})
        elif stype == "one_visit_only":
            cursor = db.customers.find({"tenant_id": tid, "visits": {"$lte": 1}})

        if not customer_ids:
            if cursor is None:
                cursor = db.customers.find(q)
            customer_ids = [c["id"] for c in cursor]

    if not customer_ids:
        raise HTTPException(status_code=400, detail="No recipients: provide customer_ids or a non-empty segment.")

    name = req.get("name") or "Campagne ciblée"
    content = req.get("content") or ""
    image_url = req.get("image_url") or None
    sender_name = (tenant.get("campaign_sender_name") or tenant.get("name") or "FidéliTour")

    # Dispatch per-customer with template rendering.
    delivered = 0
    targeted_customers = list(db.customers.find({"id": {"$in": customer_ids}, "tenant_id": tid}))
    for cust in targeted_customers:
        if not cust.get("email"):
            continue
        rendered_body = render_template(content, cust, tenant)
        rendered_subject = render_template(name, cust, tenant)
        html = _campaign_html(sender_name, rendered_subject, rendered_body, cust, image_url=image_url)
        ok = send_email_to_customer(cust["email"], sender_name, f"{sender_name} - {rendered_subject}", html)
        if ok:
            delivered += 1

    raw_source = (req.get("source") or "").strip().lower() or None
    ALLOWED = {"push", "email", "other"}
    src = raw_source if raw_source in ALLOWED else None

    campaign = Campaign(
        id=str(uuid.uuid4()),
        tenant_id=tid,
        name=name,
        content=content,
        status="sent",
        filters={"segment": segment or {"type": "custom"}},
        sent_at=now,
        targeted_count=len(targeted_customers),
        delivered_count=delivered,
        recipient_ids=[c["id"] for c in targeted_customers],
        image_url=image_url,
        source=src,
    )
    db.campaigns.insert_one(campaign.model_dump())

    # Also log per-customer push notification so wallet cards show the offer.
    for c in targeted_customers:
        db.push_notifications.insert_one({
            "customer_id": c["id"],
            "tenant_id": tid,
            "campaign_id": campaign.id,
            "image_url": image_url,
            "title": render_template(name, c, tenant),
            "body": render_template(content, c, tenant),
            "type": "campaign",
            "sent_at": now,
        })

    return campaign.model_dump()

@app.get("/api/owner/campaigns/{campaign_id}/tracking")
def get_campaign_tracking(
    campaign_id: str,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Get detailed campaign tracking metrics"""
    campaign = db.campaigns.find_one({"id": campaign_id, "tenant_id": token_data.tenant_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.pop("_id", None)

    # ---------- Single source of truth: the per-recipient walk ----------
    # Aggregates (opens_unique, visits_from_campaign) are derived FROM the
    # per-recipient state every time we read this endpoint, so the stat tiles
    # and the recipients list can never drift apart.
    #
    # • opened  → True iff (campaign_id, customer_id) row exists in
    #             db.campaign_opens (written by the tracking-pixel endpoint)
    # • visited → True iff customer_id is in attributed_visit_customer_ids
    #             (the scan_visit endpoint $addToSet's into this list when a
    #             recipient scans within 7 days of sent_at), with a fallback
    #             check on customer.last_visit_date for legacy/seeded data.

    recipient_ids = campaign.get("recipient_ids", []) or []
    sent_at = campaign.get("sent_at")
    visit_cutoff = sent_at + timedelta(days=15) if isinstance(sent_at, datetime) else None
    attributed_ids = set(campaign.get("attributed_visit_customer_ids", []) or [])

    # One query for all opens — much cheaper than find_one per recipient.
    opened_ids = {
        doc["customer_id"]
        for doc in db.campaign_opens.find(
            {"campaign_id": campaign_id},
            {"customer_id": 1, "_id": 0}
        )
        if doc.get("customer_id")
    }

    recipients = []
    opens_count = 0
    visits_count = 0
    for cid in recipient_ids:
        customer = db.customers.find_one({"id": cid})
        if not customer:
            continue
        opened = cid in opened_ids
        visited = cid in attributed_ids
        if not visited and sent_at and visit_cutoff:
            lv = customer.get("last_visit_date")
            if isinstance(lv, datetime) and sent_at <= lv <= visit_cutoff:
                visited = True
        if opened:
            opens_count += 1
        if visited:
            visits_count += 1
        recipients.append({
            "customer_id": cid,
            "customer_name": customer.get("name", "") or "Unknown",
            "name": customer.get("name", "") or "Unknown",  # keep legacy key for older clients
            "email": customer.get("email", ""),
            "phone": customer.get("phone", ""),
            "tier": customer.get("tier", "bronze"),
            "last_visit_date": customer.get("last_visit_date"),
            "opened": opened,
            "visited": visited,
            "visited_after": visited,  # legacy alias
        })

    # Use delivered_count when available; otherwise fall back to recipients we
    # actually resolved (handles seed data where delivered may be unset).
    delivered = campaign.get("delivered_count", 0) or len(recipients)
    targeted = campaign.get("targeted_count", 0) or len(recipient_ids)
    denom = delivered if delivered > 0 else (len(recipients) or 1)

    open_rate_pct = round((opens_count / denom * 100), 1) if denom > 0 else 0.0
    visits_rate_pct = round((visits_count / denom * 100), 1) if denom > 0 else 0.0

    return {
        "campaign_id": campaign_id,
        "name": campaign.get("name", ""),
        "sent_at": campaign.get("sent_at"),
        "targeted_count": targeted,
        "delivered_count": delivered,
        # Derived from the recipients walk — guaranteed to match the list below.
        "opens_unique": opens_count,
        "open_rate_pct": open_rate_pct,
        "visits_from_campaign": visits_count,
        "visits_rate_pct": visits_rate_pct,
        # Explicit "after-send" totals for the UI (number + percentage).
        "visits_after_count": visits_count,
        "visits_after_pct": visits_rate_pct,
        "opens_after_count": opens_count,
        "opens_after_pct": open_rate_pct,
        "recipients": recipients
    }

@app.get("/api/campaigns/{campaign_id}/pixel/{customer_id}.png")
@app.get("/api/owner/campaigns/{campaign_id}/track-open/{customer_id}")
def track_campaign_open(
    campaign_id: str,
    customer_id: str,
):
    """Anonymous pixel tracking endpoint - logs the first open per (campaign, customer)
    and always returns a 1x1 PNG so broken images never appear in email clients.

    Intentionally unauthenticated: tracking pixels are loaded by recipient email
    clients / push viewers that have no session cookie.
    """
    # Verify campaign exists (no tenant check - pixel is public by design)
    campaign = db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        # Still return the PNG so broken image icons never show up
        return Response(content=PIXEL_PNG_BYTES, media_type="image/png")

    # Only count the customer if they were an actual recipient
    recipient_ids = campaign.get("recipient_ids", []) or []
    is_recipient = customer_id in recipient_ids

    # Unique-only opens: ignore re-opens entirely. The first time a (campaign,
    # customer) pair shows up we record it and bump the counters; every
    # subsequent fetch of the pixel is silently dropped so the campaign success
    # metric stays a reliable "how many distinct people opened this".
    already_opened = db.campaign_opens.find_one(
        {"campaign_id": campaign_id, "customer_id": customer_id}
    )

    if not already_opened and is_recipient:
        db.campaign_opens.insert_one({
            "campaign_id": campaign_id,
            "customer_id": customer_id,
            "opened_at": datetime.now(timezone.utc),
        })
        # opens and opens_unique now move together — they're the same metric.
        db.campaigns.update_one(
            {"id": campaign_id},
            {"$inc": {"opens": 1, "opens_unique": 1}}
        )

    # Return 1x1 PNG with no-cache headers so each open gets logged
    return Response(
        content=PIXEL_PNG_BYTES,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@app.get("/api/owner/analytics/highest-paying")
def get_highest_paying_customers(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
):
    """Return ALL tenant customers so the dashboard can sort by max/min spent/visits client-side."""
    q = {"tenant_id": token_data.tenant_id}
    if branch_id:
        q["branch_id"] = branch_id
    customers = list(
        db.customers.find(q).sort("total_amount_paid", -1)
    )

    result = []
    for c in customers:
        result.append({
            "id": c["id"],
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "total_amount_paid": c.get("total_amount_paid", 0),
            "total_visits": c.get("visits", 0),
            "tier": c.get("tier", "bronze"),
            "last_visit_date": c.get("last_visit_date")
        })

    return result

@app.get("/api/owner/analytics/cards-filled")
def get_cards_filled_analytics(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
):
    """Cards filled metrics. Uses visit counts in memory (no per-customer DB loop)."""
    t_id = token_data.tenant_id
    card_template = db.card_templates.find_one({"tenant_id": t_id})
    if not card_template:
        reward_threshold = 10
        visits_per_stamp = 1
    else:
        reward_threshold = card_template.get("reward_threshold_stamps", 10)
        visits_per_stamp = card_template.get("visits_per_stamp", 1)
    visits_needed = max(reward_threshold * visits_per_stamp, 1)

    cust_q = {"tenant_id": t_id}
    visit_q = {"tenant_id": t_id}
    if branch_id:
        cust_q["branch_id"] = branch_id
        visit_q["branch_id"] = branch_id

    customers = list(db.customers.find(
        cust_q, {"visits": 1, "tier": 1}
    ))
    tier_filled = {"bronze": 0, "silver": 0, "gold": 0}
    total_cards_filled = 0
    for c in customers:
        cards = c.get("visits", 0) // visits_needed
        if cards > 0:
            total_cards_filled += cards
            tier = (c.get("tier") or "bronze").lower()
            if tier in tier_filled:
                tier_filled[tier] += cards

    # "This month" / "last month" — answer via aggregation on visits, not per-customer loop.
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    this_month_q = dict(visit_q, visit_time={"$gte": month_start})
    last_month_q = dict(visit_q, visit_time={"$gte": last_month_start, "$lt": month_start})
    visits_this_month = db.visits.count_documents(this_month_q)
    visits_last_month = db.visits.count_documents(last_month_q)
    # Cards filled = floor(visits_in_period / visits_needed)
    cards_filled_this_month = visits_this_month // visits_needed
    cards_filled_last_month = visits_last_month // visits_needed

    return {
        "total_cards_filled": total_cards_filled,
        "cards_filled_this_month": cards_filled_this_month,
        "cards_filled_last_month": cards_filled_last_month,
        "by_tier": tier_filled
    }

@app.get("/api/owner/analytics/recovered")
def get_recovered_customers(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    inactive_days: int = Query(30),
    window_days: int = Query(30),
    branch_id: Optional[str] = Query(None),
):
    """Customers who were inactive > inactive_days ago but came back within window_days.

    Semantics: `last_visit_date` already reflects the MOST RECENT visit. So a
    customer is 'recovered' if (now - last_visit_date) <= window_days (they came
    back recently) AND before that visit they had been dormant for >= inactive_days
    — i.e., the GAP between their recent visit and their previous visit was at
    least `inactive_days`. We compute this gap per customer using ONE aggregation.
    """
    t_id = token_data.tenant_id
    now = datetime.now(timezone.utc)
    inactive_threshold_seconds = inactive_days * 86400
    window_start = now - timedelta(days=window_days)

    cust_q = {"tenant_id": t_id}
    visit_q = {"tenant_id": t_id}
    if branch_id:
        cust_q["branch_id"] = branch_id
        visit_q["branch_id"] = branch_id

    customers = list(db.customers.find(cust_q))
    total_customers = len(customers)

    # Get every visit sorted per customer — one aggregation call
    visit_history = {}
    for row in db.visits.aggregate([
        {"$match": visit_q},
        {"$sort": {"visit_time": 1}},
        {"$group": {
            "_id": "$customer_id",
            "dates": {"$push": "$visit_time"}
        }}
    ]):
        visit_history[row["_id"]] = row["dates"] or []

    recovered = []
    for c in customers:
        cid = c.get("id")
        dates = visit_history.get(cid, [])
        if len(dates) < 2:
            continue
        last = dates[-1]
        prev = dates[-2]
        if not last or not prev:
            continue
        # They visited within window AND had a big gap before that return.
        if last >= window_start and (last - prev).total_seconds() >= inactive_threshold_seconds:
            recovered.append({
                "id": cid,
                "name": c.get("name", ""),
                "email": c.get("email", ""),
                "last_inactive_date": prev,
                "returned_date": last,
                "tier": c.get("tier", "bronze"),
                "total_visits": c.get("visits", 0),
                "total_amount_paid": c.get("total_amount_paid", 0),
            })

    recovery_pct = (len(recovered) / total_customers * 100) if total_customers else 0

    return {
        "count": len(recovered),
        "percentage": round(recovery_pct, 1),
        "customers": recovered,
        "recovered_this_period": len(recovered),
        "inactive_days": inactive_days,
        "window_days": window_days,
    }

@app.get("/api/owner/analytics/acquisition-sources")
def get_acquisition_sources(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    days: int = Query(0),                         # 0 == lifetime / all-time
    branch_id: Optional[str] = Query(None),
):
    """Customer acquisition breakdown per channel.

    By default this is a lifetime KPI — "exactly how many customers did we
    get till date from Instagram / Facebook / TikTok / QR-in-store" — because
    that's what the owner uses to decide where to invest their next campaign
    budget. Pass `days` > 0 to scope to a window (the dashboard uses 30 for
    its trend snapshot).
    """
    q = {"tenant_id": token_data.tenant_id}
    if days and days > 0:
        period_start = datetime.now(timezone.utc) - timedelta(days=days)
        q["created_at"] = {"$gte": period_start}
    if branch_id:
        q["branch_id"] = branch_id
    customers = list(db.customers.find(q))

    # Only the 4 permitted sources — no 'friend' or 'other'.
    ALLOWED_SOURCES = ("qr_store", "instagram", "facebook", "tiktok")
    LABELS = {
        "qr_store": "QR in-store",
        "instagram": "Instagram",
        "facebook": "Facebook",
        "tiktok": "TikTok",
    }
    sources_count = {s: 0 for s in ALLOWED_SOURCES}
    for cust in customers:
        source = cust.get("acquisition_source")
        if source in sources_count:
            sources_count[source] += 1

    total = sum(sources_count.values())
    # Stable order: by count desc, then by name asc for ties — so the top
    # channel is always first regardless of how the dict was built.
    sources = sorted(
        (
            {
                "source": s,
                "label": LABELS[s],
                "count": sources_count[s],
                "percentage": round((sources_count[s] / total * 100), 1) if total > 0 else 0,
            }
            for s in ALLOWED_SOURCES
        ),
        key=lambda x: (-x["count"], x["source"]),
    )

    return {
        "sources": sources,
        "total": total,
        "period_days": days if days and days > 0 else 0,   # 0 ⇒ lifetime
        "is_lifetime": not (days and days > 0),
    }

@app.get("/api/owner/analytics/summary")
def get_analytics_summary(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
    period_days: Optional[int] = Query(None),
):
    """Quick summary stats for dashboard. No per-customer DB loops."""
    t_id = token_data.tenant_id
    now = datetime.now(timezone.utc)
    # period_days scales the "recently-active" window. 30 is the historical default.
    window = int(period_days) if period_days and period_days > 0 else 30
    week_ago = now - timedelta(days=min(7, window))
    ninety_days_ago = now - timedelta(days=max(90, window))
    thirty_days_ago = now - timedelta(days=window)

    # Make sure a branch filter actually has data (backfill orphan customers once).
    _ensure_branch_assignments(t_id)

    cust_q = {"tenant_id": t_id}
    visit_q = {"tenant_id": t_id}
    if branch_id:
        cust_q["branch_id"] = branch_id
        visit_q["branch_id"] = branch_id

    customers = list(db.customers.find(cust_q))

    # Highest paying — in-memory sort
    by_spend = sorted(customers, key=lambda c: c.get("total_amount_paid", 0), reverse=True)
    highest_paying_list = [
        {"name": c.get("name", ""), "amount": c.get("total_amount_paid", 0)}
        for c in by_spend[:5]
    ]

    # Cards filled
    card_template = db.card_templates.find_one({"tenant_id": t_id})
    reward_threshold = card_template.get("reward_threshold_stamps", 10) if card_template else 10
    visits_per_stamp = card_template.get("visits_per_stamp", 1) if card_template else 1
    visits_needed = max(reward_threshold * visits_per_stamp, 1)
    total_cards_filled = sum(c.get("visits", 0) // visits_needed for c in customers)

    # Recovered — same semantic as /recovered, done in memory
    inactive_threshold = now - timedelta(days=30)
    recovered_count = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] >= ninety_days_ago
        and c.get("visits", 0) >= 2  # had a prior visit
        and c["last_visit_date"] >= ninety_days_ago
    )
    # Tighter recovered semantic using visit history (one extra aggregation)
    recent_returns_match = dict(visit_q, visit_time={"$gte": ninety_days_ago})
    recent_returns = {
        row["_id"]: True
        for row in db.visits.aggregate([
            {"$match": recent_returns_match},
            {"$group": {"_id": "$customer_id"}}
        ])
    }
    recovered_count = sum(
        1 for c in customers
        if recent_returns.get(c.get("id"))
        and c.get("last_visit_date") and c["last_visit_date"] < inactive_threshold
    )
    recovered_pct = (recovered_count / len(customers) * 100) if customers else 0

    # Acquisition sources (last 90 days)
    sources_count = {}
    for c in customers:
        ca = c.get("created_at")
        if ca and ca >= ninety_days_ago:
            source = c.get("acquisition_source", "unknown")
            sources_count[source] = sources_count.get(source, 0) + 1
    source_breakdown = [
        {"source": k, "count": v}
        for k, v in sorted(sources_count.items(), key=lambda x: x[1], reverse=True)
    ]

    # Active customers
    active_customers = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] >= thirty_days_ago
    )

    # New this week
    new_this_week = sum(
        1 for c in customers
        if c.get("created_at") and c["created_at"] >= week_ago
    )

    # Additional KPIs
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    fourteen_days_ago = now - timedelta(days=14)

    new_today_count = sum(
        1 for c in customers
        if c.get("created_at") and c["created_at"] >= today_start
    )
    # Inactive = last visit >= 30 days ago (not never — exclude never-visited here)
    inactive_count = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] < thirty_days_ago
    )
    # About-to-lose = last visit between 14 and 29 days ago
    about_to_lose_count = sum(
        1 for c in customers
        if c.get("last_visit_date")
        and c["last_visit_date"] < fourteen_days_ago
        and c["last_visit_date"] >= thirty_days_ago
    )
    # Cards filled today — count visits today that tipped the visit count over a card boundary
    cards_filled_today = 0
    try:
        visits_today_q = dict(visit_q, visit_time={"$gte": today_start})
        visits_today = visits_per_stamp  # just to ensure name used
        cards_filled_today = db.visits.count_documents(visits_today_q) // max(visits_needed, 1)
    except Exception:
        pass

    # --- New KPIs from this batch ---
    # Rewards redeemed today / this month
    month_start = today_start.replace(day=1)
    reward_q = {"tenant_id": t_id}
    if branch_id:
        reward_q["branch_id"] = branch_id
    try:
        rewards_today = db.rewards_redeemed.count_documents({**reward_q, "redeemed_at": {"$gte": today_start}})
        rewards_month = db.rewards_redeemed.count_documents({**reward_q, "redeemed_at": {"$gte": month_start}})
        rewards_total = db.rewards_redeemed.count_documents(reward_q)
    except Exception:
        rewards_today = rewards_month = rewards_total = 0

    # Birthdays this month — quick count directly on the customer set.
    mm = now.strftime("%m")
    birthdays_this_month_count = sum(
        1 for c in customers
        if (c.get("birthday") or "").startswith(mm)
    )

    # VIP count (new top tier)
    vip_count = sum(1 for c in customers if (c.get("tier") or "").lower() == "vip")

    # --- Reviews roll-up — headline numbers for KPI tiles ---
    review_q = {"tenant_id": t_id}
    if branch_id:
        review_q["branch_id"] = branch_id
    try:
        review_docs = list(db.reviews.find(review_q, {"rating": 1, "sentiment": 1, "created_at": 1}))
        total_reviews = len(review_docs)
        if total_reviews:
            avg_rating = round(sum(int(r.get("rating", 0) or 0) for r in review_docs) / total_reviews, 2)
            negative_reviews = sum(1 for r in review_docs if int(r.get("rating", 0) or 0) <= 4)
            negative_pct = round(negative_reviews / total_reviews * 100, 1)
            pos_r = sum(1 for r in review_docs if r.get("sentiment") == "positive")
            neg_r = sum(1 for r in review_docs if r.get("sentiment") == "negative")
            sentiment_score_pct = round(((pos_r - neg_r) / total_reviews) * 100, 1)
            reviews_last_30 = sum(1 for r in review_docs if r.get("created_at") and r["created_at"] >= now - timedelta(days=30))
        else:
            avg_rating = None
            negative_pct = 0.0
            sentiment_score_pct = 0
            reviews_last_30 = 0
    except Exception:
        total_reviews = 0
        avg_rating = None
        negative_pct = 0.0
        sentiment_score_pct = 0
        reviews_last_30 = 0

    return {
        "highest_paying": highest_paying_list,
        "total_cards_filled": total_cards_filled,
        "recovered_count": recovered_count,
        "recovered_pct": round(recovered_pct, 1),
        "source_breakdown": source_breakdown,
        "active_customers": active_customers,
        "new_this_week": new_this_week,
        "new_today_count": new_today_count,
        "inactive_count": inactive_count,
        "about_to_lose_count": about_to_lose_count,
        "cards_filled_today": cards_filled_today,
        "total_customers": len(customers),  # canonical count
        # New this batch
        "rewards_redeemed_today": rewards_today,
        "rewards_redeemed_month": rewards_month,
        "rewards_redeemed_total": rewards_total,
        "birthdays_this_month_count": birthdays_this_month_count,
        "vip_count": vip_count,
        # Reviews — headline KPIs for the Dashboard/Analytics tiles
        "total_reviews": total_reviews,
        "average_rating": avg_rating,                       # /10, null if no reviews yet
        "negative_review_rate_pct": negative_pct,           # % at 1-4 / 10
        "sentiment_score_pct": sentiment_score_pct,         # -100 .. +100
        "reviews_last_30d": reviews_last_30,
    }

@app.post("/api/owner/branches")
def create_branch(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Add a branch to the tenant (requires multi_branch plan feature)"""
    tenant = db.tenants.find_one({"id": token_data.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    plan = tenant.get("plan", "basic")
    plan_features = PLAN_FEATURES.get(plan, {})
    if not plan_features.get("multi_branch", False):
        raise HTTPException(status_code=403, detail="Plan does not support multi-branch")

    branch = {
        "id": str(uuid.uuid4()),
        "name": req.get("name", "New Branch"),
        "address": req.get("address", ""),
        "postal_code": req.get("postal_code", ""),
        "phone": req.get("phone", ""),
        "is_main": req.get("is_main", False)
    }

    branches = tenant.get("branches", [])
    branches.append(branch)

    db.tenants.update_one({"id": token_data.tenant_id}, {"$set": {"branches": branches}})
    return branch

@app.get("/api/owner/branches")
def list_branches(token_data: TokenData = Depends(require_role(["business_owner", "manager", "staff"]))):
    """List branches for current tenant. Staff need this so the scan page can
    show the branch picker (which branch the scan is happening at)."""
    tenant = db.tenants.find_one({"id": token_data.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return tenant.get("branches", [])

@app.delete("/api/owner/branches/{branch_id}")
def delete_branch(
    branch_id: str,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Remove a branch"""
    tenant = db.tenants.find_one({"id": token_data.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    branches = [b for b in tenant.get("branches", []) if b["id"] != branch_id]
    db.tenants.update_one({"id": token_data.tenant_id}, {"$set": {"branches": branches}})
    return {"message": "Branch deleted"}

@app.get("/api/owner/branches/performance")
def get_branch_performance(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    period_days: int = Query(30),
):
    """Per-branch KPI rollup for chain / multi-store tenants.

    Returns one row per branch with: customers, visits (period + lifetime),
    revenue (period), avg ticket, repeat rate, and active-customer count.
    Visits / revenue are scoped to the trailing `period_days` window so the
    franchise dashboard can show "this month vs last month" deltas.

    Comparison numbers (prior_period_*) cover the equivalent window
    immediately before this one, so the UI can compute deltas without a
    second round trip.
    """
    tenant = db.tenants.find_one({"id": token_data.tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    branches = tenant.get("branches") or []
    if not branches:
        return {"branches": [], "tenant_total": {}, "period_days": period_days}

    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=period_days)
    prior_start = period_start - timedelta(days=period_days)

    tid = token_data.tenant_id

    # ---------- One aggregation per metric, grouped by branch_id ----------
    # Customer counts per branch (lifetime).
    cust_by_branch = {
        d["_id"]: d["count"]
        for d in db.customers.aggregate([
            {"$match": {"tenant_id": tid}},
            {"$group": {"_id": "$branch_id", "count": {"$sum": 1}}},
        ])
    }

    # Active customers (visited in the period) per branch.
    active_pipeline = [
        {"$match": {"tenant_id": tid, "created_at": {"$gte": period_start}}},
        {"$group": {"_id": {"branch": "$branch_id", "customer": "$customer_id"}}},
        {"$group": {"_id": "$_id.branch", "count": {"$sum": 1}}},
    ]
    active_by_branch = {d["_id"]: d["count"] for d in db.visits.aggregate(active_pipeline)}

    # Visits + revenue in this period and the prior period, grouped by branch.
    def _visit_rollup(start, end):
        return {
            d["_id"]: {"visits": d["visits"], "revenue": round(d["revenue"], 2)}
            for d in db.visits.aggregate([
                {"$match": {
                    "tenant_id": tid,
                    "created_at": {"$gte": start, "$lt": end},
                }},
                {"$group": {
                    "_id": "$branch_id",
                    "visits": {"$sum": 1},
                    "revenue": {"$sum": {"$ifNull": ["$amount_paid", 0]}},
                }},
            ])
        }

    period_rollup = _visit_rollup(period_start, now)
    prior_rollup = _visit_rollup(prior_start, period_start)

    # Lifetime visits per branch (for context).
    lifetime_by_branch = {
        d["_id"]: d["count"]
        for d in db.visits.aggregate([
            {"$match": {"tenant_id": tid}},
            {"$group": {"_id": "$branch_id", "count": {"$sum": 1}}},
        ])
    }

    rows = []
    for b in branches:
        bid = b["id"]
        period_data = period_rollup.get(bid, {"visits": 0, "revenue": 0.0})
        prior_data = prior_rollup.get(bid, {"visits": 0, "revenue": 0.0})
        cust_count = int(cust_by_branch.get(bid, 0) or 0)
        active = int(active_by_branch.get(bid, 0) or 0)

        avg_ticket = round(
            period_data["revenue"] / period_data["visits"], 2
        ) if period_data["visits"] > 0 else 0.0

        # Period-over-period growth — handles the divide-by-zero edge case.
        prior_visits = max(prior_data["visits"], 0)
        if prior_visits > 0:
            visit_delta_pct = round(
                ((period_data["visits"] - prior_visits) / prior_visits) * 100, 1
            )
        else:
            visit_delta_pct = 100.0 if period_data["visits"] > 0 else 0.0

        rows.append({
            "id": bid,
            "name": b.get("name") or bid,
            "address": b.get("address", ""),
            "is_main": bool(b.get("is_main")),
            "customers": cust_count,
            "active_customers": active,
            "active_share_pct": round((active / cust_count * 100), 1) if cust_count > 0 else 0.0,
            "visits_period": period_data["visits"],
            "revenue_period": period_data["revenue"],
            "avg_ticket_period": avg_ticket,
            "visits_prior": prior_visits,
            "visits_delta_pct": visit_delta_pct,
            "lifetime_visits": int(lifetime_by_branch.get(bid, 0) or 0),
        })

    # Sort by revenue desc — the leaderboard view.
    rows.sort(key=lambda r: r["revenue_period"], reverse=True)

    # Roll up into a tenant total for the headline strip above the cards.
    tenant_total = {
        "customers": sum(r["customers"] for r in rows),
        "active_customers": sum(r["active_customers"] for r in rows),
        "visits_period": sum(r["visits_period"] for r in rows),
        "revenue_period": round(sum(r["revenue_period"] for r in rows), 2),
        "avg_ticket": round(
            sum(r["revenue_period"] for r in rows) / max(sum(r["visits_period"] for r in rows), 1),
            2,
        ),
    }

    return {
        "branches": rows,
        "tenant_total": tenant_total,
        "period_days": period_days,
    }

# ========================
# ENHANCED ADMIN ENDPOINTS
# ========================

@app.get("/api/admin/enhanced-analytics")
def get_admin_enhanced_analytics(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Enhanced admin analytics with business health.
    Uses aggregation pipelines — 5 round-trips total, not 6 per tenant."""
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))

    now = datetime.now(timezone.utc)
    fourteen_days_ago = now - timedelta(days=14)
    thirty_days_ago = now - timedelta(days=30)

    # --- Batched per-tenant aggregates (one MongoDB call each) ---
    total_visits_by_tenant = {
        d["_id"]: d["count"]
        for d in db.visits.aggregate([
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }
    recent_visits_by_tenant = {
        d["_id"]: d["count"]
        for d in db.visits.aggregate([
            {"$match": {"created_at": {"$gte": fourteen_days_ago}}},
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }
    last_month_visits_by_tenant = {
        d["_id"]: d["count"]
        for d in db.visits.aggregate([
            {"$match": {"created_at": {"$gte": thirty_days_ago, "$lt": fourteen_days_ago}}},
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }
    new_customers_by_tenant = {
        d["_id"]: d["count"]
        for d in db.customers.aggregate([
            {"$match": {"created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }

    # Bucket all customers once in memory
    all_customers = list(db.customers.find({}, {"tenant_id": 1, "points": 1, "visits": 1}))
    customers_by_tenant = {}
    for c in all_customers:
        customers_by_tenant.setdefault(c.get("tenant_id"), []).append(c)

    business_health = {"regular": [], "growing": [], "declining": []}
    top_performers = []
    businesses_at_risk = []

    for t in tenants:
        tid = t["id"]
        t_customers = customers_by_tenant.get(tid, [])
        customer_count = len(t_customers)
        total_visits = total_visits_by_tenant.get(tid, 0)
        recent_visits = recent_visits_by_tenant.get(tid, 0)
        last_month_visits = last_month_visits_by_tenant.get(tid, 0)
        new_customers_recent = new_customers_by_tenant.get(tid, 0)

        avg_points = sum(
            c.get("points", c.get("visits", 0) * 10) for c in t_customers
        ) / max(customer_count, 1)

        t_data = {
            "id": tid, "name": t["name"], "plan": t.get("plan", "basic"),
            "customer_count": customer_count, "total_visits": total_visits,
            "recent_visits": recent_visits, "new_customers_recent": new_customers_recent,
            "avg_points": round(avg_points, 1)
        }

        top_performers.append(t_data)

        if recent_visits > 0:
            business_health["regular"].append(t_data)
        if recent_visits > last_month_visits:
            business_health["growing"].append(t_data)
        if recent_visits < last_month_visits and total_visits > 0:
            business_health["declining"].append(t_data)
            businesses_at_risk.append(t_data)

    top_performers.sort(key=lambda x: x["total_visits"], reverse=True)

    return {
        "business_health": {
            "regular": len(business_health["regular"]),
            "growing": len(business_health["growing"]),
            "declining": len(business_health["declining"]),
            "regular_list": business_health["regular"],
            "growing_list": business_health["growing"],
            "declining_list": business_health["declining"],
        },
        "top_performers": top_performers[:10],
        "businesses_at_risk": businesses_at_risk
    }

@app.post("/api/admin/send-business-campaign")
def send_business_campaign(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Send campaign email to a business owner"""
    campaign = {
        "id": str(uuid.uuid4()),
        "target_type": "business_owner",
        "tenant_id": req.get("tenant_id"),
        "subject": req.get("subject", ""),
        "body": req.get("body", ""),
        "status": "sent",
        "sent_at": datetime.now(timezone.utc)
    }
    db.admin_campaigns.insert_one(campaign)
    return {"message": "Campaign sent successfully", "campaign_id": campaign["id"]}


# ============================================================
# 12-FEATURE ROLLOUT (Apr 2026)
# ============================================================

# --- Feature 1 + 7: Churn rate & first-visit cohort ----------
@app.get("/api/owner/analytics/churn")
def get_churn(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Churn metrics + 'never came back after 1st visit' cohort analysis.
    Used on the Analytics page as a top-row KPI.
    """
    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)

    customers = list(db.customers.find({"tenant_id": tid}))
    total = len(customers)
    if total == 0:
        return {
            "total_customers": 0, "one_visit_only": 0, "one_visit_only_pct": 0.0,
            "inactive_30d": 0, "inactive_30d_pct": 0.0,
            "inactive_60d": 0, "inactive_60d_pct": 0.0,
            "churned_90d": 0, "churned_90d_pct": 0.0,
        }

    thirty = now - timedelta(days=30)
    sixty = now - timedelta(days=60)
    ninety = now - timedelta(days=90)

    one_visit = sum(1 for c in customers if c.get("visits", 0) <= 1)
    inactive_30 = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] < thirty
    )
    inactive_60 = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] < sixty
    )
    churned_90 = sum(
        1 for c in customers
        if c.get("last_visit_date") and c["last_visit_date"] < ninety
    )

    def pct(n):
        return round((n / total) * 100, 1)

    return {
        "total_customers": total,
        "one_visit_only": one_visit,
        "one_visit_only_pct": pct(one_visit),
        "inactive_30d": inactive_30,
        "inactive_30d_pct": pct(inactive_30),
        "inactive_60d": inactive_60,
        "inactive_60d_pct": pct(inactive_60),
        "churned_90d": churned_90,
        "churned_90d_pct": pct(churned_90),
    }


# --- Feature 2: Lifetime Value (LTV) -------------------------
@app.get("/api/owner/analytics/ltv")
def get_ltv(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Average and distribution of customer lifetime value.
    LTV = total_amount_paid. We also return LTV by tier so you can see
    how much more a Gold customer is worth than a Bronze one.
    """
    tid = token_data.tenant_id
    customers = list(db.customers.find({"tenant_id": tid}))
    if not customers:
        return {"average_ltv": 0, "median_ltv": 0, "by_tier": [], "top_10_pct_ltv": 0}

    values = sorted(c.get("total_amount_paid", 0) for c in customers)
    avg_ltv = round(sum(values) / len(values), 2)
    median_ltv = values[len(values) // 2]
    top_10_pct_cutoff = values[int(len(values) * 0.9)] if len(values) >= 10 else values[-1]

    by_tier = {}
    for c in customers:
        tier = (c.get("tier") or "bronze").lower()
        by_tier.setdefault(tier, []).append(c.get("total_amount_paid", 0))

    by_tier_out = [
        {
            "tier": t,
            "count": len(vals),
            "average_ltv": round(sum(vals) / len(vals), 2) if vals else 0,
            "total_revenue": round(sum(vals), 2),
        }
        for t, vals in sorted(by_tier.items(), key=lambda kv: {"gold": 0, "silver": 1, "bronze": 2}.get(kv[0], 3))
    ]

    return {
        "average_ltv": avg_ltv,
        "median_ltv": round(median_ltv, 2),
        "top_10_pct_ltv": round(top_10_pct_cutoff, 2),
        "by_tier": by_tier_out,
    }


# --- Feature 3: Smart alerts panel ---------------------------
@app.get("/api/owner/analytics/alerts")
def get_smart_alerts(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Computed alerts — changes in repeat rate, dormant counts, gold spending shift."""
    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)
    alerts = []

    customers = list(db.customers.find({"tenant_id": tid}))
    if not customers:
        return {"alerts": []}

    # Alert: inactive 30d
    thirty = now - timedelta(days=30)
    inactive = [c for c in customers if c.get("last_visit_date") and c["last_visit_date"] < thirty]
    if len(inactive) >= 5:
        alerts.append({
            "level": "warning",
            "icon": "⚠️",
            "title": f"{len(inactive)} clients inactifs depuis 30 jours",
            "detail": "Envoyez une campagne de relance pour les ramener.",
            "action": "create_campaign",
            "action_filter": {"inactive_days": 30},
        })

    # Alert: repeat-rate drop (visits in last 14d vs previous 14d)
    fourteen = now - timedelta(days=14)
    twentyeight = now - timedelta(days=28)
    recent_visits = db.visits.count_documents({"tenant_id": tid, "created_at": {"$gte": fourteen}})
    prev_visits = db.visits.count_documents({
        "tenant_id": tid, "created_at": {"$gte": twentyeight, "$lt": fourteen}
    })
    if prev_visits > 0:
        delta_pct = round(((recent_visits - prev_visits) / prev_visits) * 100, 1)
        if delta_pct <= -10:
            alerts.append({
                "level": "danger",
                "icon": "📉",
                "title": f"Repeat rate en baisse de {abs(delta_pct)}%",
                "detail": f"{recent_visits} visites (14d) vs {prev_visits} la période précédente.",
                "action": "view_analytics",
            })
        elif delta_pct >= 15:
            alerts.append({
                "level": "success",
                "icon": "🔥",
                "title": f"Visites en hausse de {delta_pct}%",
                "detail": f"{recent_visits} visites (14d) vs {prev_visits} avant.",
                "action": None,
            })

    # Alert: Gold members spending pattern
    gold = [c for c in customers if (c.get("tier") or "").lower() == "gold"]
    non_gold = [c for c in customers if (c.get("tier") or "").lower() != "gold"]
    if gold and non_gold:
        gold_avg = sum(c.get("total_amount_paid", 0) for c in gold) / len(gold)
        non_gold_avg = sum(c.get("total_amount_paid", 0) for c in non_gold) / max(len(non_gold), 1)
        if non_gold_avg > 0:
            multiplier = round((gold_avg - non_gold_avg) / non_gold_avg * 100, 0)
            if multiplier >= 50:
                alerts.append({
                    "level": "success",
                    "icon": "🔥",
                    "title": f"Vos clients Gold dépensent +{int(multiplier)}%",
                    "detail": f"Moyenne Gold: {gold_avg:.0f}€ vs autres: {non_gold_avg:.0f}€",
                    "action": None,
                })

    # Alert: Birthday customers this month
    month = now.strftime("%m")
    birthday_this_month = sum(
        1 for c in customers
        if c.get("birthday", "").startswith(month)
    )
    if birthday_this_month >= 3:
        alerts.append({
            "level": "info",
            "icon": "🎂",
            "title": f"{birthday_this_month} anniversaires ce mois",
            "detail": "Envoyez une campagne anniversaire personnalisée.",
            "action": "create_campaign",
            "action_filter": {"birthday_month": month},
        })

    # Alert: First-visit drop-off
    one_visit_pct = round(sum(1 for c in customers if c.get("visits", 0) <= 1) / len(customers) * 100, 1)
    if one_visit_pct >= 25:
        alerts.append({
            "level": "warning",
            "icon": "🚪",
            "title": f"{one_visit_pct}% des clients ne reviennent pas",
            "detail": "Proposez une offre post-première visite pour fidéliser.",
            "action": "create_campaign",
            "action_filter": {"max_visits": 1},
        })

    return {"alerts": alerts}


# --- Feature 4: Time-of-day / weekday segmentation -----------
@app.get("/api/owner/analytics/time-segmentation")
def get_time_segmentation(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Break down visits by hour-of-day and weekday — identify lunch crowd, weekend regulars."""
    tid = token_data.tenant_id
    visits = list(db.visits.find({"tenant_id": tid}))

    hour_buckets = {i: 0 for i in range(24)}
    weekday_buckets = {i: 0 for i in range(7)}  # Mon=0 .. Sun=6
    daypart_buckets = {"breakfast": 0, "lunch": 0, "afternoon": 0, "dinner": 0, "late_night": 0}

    for v in visits:
        vt = v.get("visit_time") or v.get("created_at")
        if not vt:
            continue
        h = vt.hour
        wd = vt.weekday()
        hour_buckets[h] += 1
        weekday_buckets[wd] += 1
        if 6 <= h < 11:
            daypart_buckets["breakfast"] += 1
        elif 11 <= h < 14:
            daypart_buckets["lunch"] += 1
        elif 14 <= h < 18:
            daypart_buckets["afternoon"] += 1
        elif 18 <= h < 22:
            daypart_buckets["dinner"] += 1
        else:
            daypart_buckets["late_night"] += 1

    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return {
        "hour_breakdown": [{"hour": h, "visits": c} for h, c in hour_buckets.items()],
        "weekday_breakdown": [
            {"day": weekday_names[i], "visits": weekday_buckets[i]} for i in range(7)
        ],
        "daypart_breakdown": [
            {"name": k.replace("_", " ").title(), "visits": v, "raw": k}
            for k, v in daypart_buckets.items()
        ],
        "weekend_visits": weekday_buckets[5] + weekday_buckets[6],
        "weekday_visits": sum(weekday_buckets[i] for i in range(5)),
    }


# --- Feature 5: City / postal-code breakdown -----------------
@app.get("/api/owner/analytics/city-breakdown")
def get_city_breakdown(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Customers grouped by postal code. Uses first two digits as French département."""
    tid = token_data.tenant_id
    customers = list(db.customers.find({"tenant_id": tid}))

    # French département names (mapping most common codes)
    DEPT_NAMES = {
        "01": "Ain", "13": "Bouches-du-Rhône", "31": "Haute-Garonne", "33": "Gironde",
        "34": "Hérault", "35": "Ille-et-Vilaine", "37": "Indre-et-Loire", "38": "Isère",
        "44": "Loire-Atlantique", "49": "Maine-et-Loire", "59": "Nord", "62": "Pas-de-Calais",
        "63": "Puy-de-Dôme", "67": "Bas-Rhin", "69": "Rhône", "75": "Paris",
        "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines", "83": "Var",
        "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne", "06": "Alpes-Maritimes",
    }

    postal_counts = {}
    dept_counts = {}
    for c in customers:
        pc = (c.get("postal_code") or "").strip()
        if not pc:
            continue
        postal_counts[pc] = postal_counts.get(pc, 0) + 1
        dept = pc[:2]
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    return {
        "by_postal_code": [
            {"postal_code": k, "customer_count": v}
            for k, v in sorted(postal_counts.items(), key=lambda kv: kv[1], reverse=True)[:50]
        ],
        "by_departement": [
            {"code": k, "name": DEPT_NAMES.get(k, f"Département {k}"), "customer_count": v}
            for k, v in sorted(dept_counts.items(), key=lambda kv: kv[1], reverse=True)
        ],
        "unique_postal_codes": len(postal_counts),
    }


# --- Feature 6: Sector-specific reactivation templates -------
REACTIVATION_TEMPLATES_BY_SECTOR = {
    "restaurant":  {"title": "On vous a manqué à table 🍽️", "content": "Revenez ce week-end : votre plat signature + dessert offert."},
    "pizzeria":    {"title": "Une pizza qui vous attend 🍕", "content": "−30% sur votre prochaine pizza si vous revenez avant dimanche."},
    "glacier":     {"title": "Votre boule préférée vous attend 🍦", "content": "Une boule offerte pour votre prochain passage."},
    "brasserie":   {"title": "Un demi à votre nom 🍺", "content": "Ça fait un moment ! Le premier verre est pour nous."},
    "sushi":       {"title": "Vos makis préférés reviennent 🍣", "content": "Plateau dégustation à moitié prix cette semaine."},
    "burger":      {"title": "Un burger vous réclame 🍔", "content": "Menu complet −25% pour fêter votre retour."},
    "kebab":       {"title": "Votre kebab vous manque ? 🥙", "content": "Le prochain est pour nous. Revenez vite !"},
    "crêperie":    {"title": "Une crêpe vous attend 🥞", "content": "Crêpe sucrée offerte avec votre galette."},
    "chocolatier": {"title": "Une douceur pour votre retour 🍫", "content": "Une truffe maison offerte dès votre prochain passage."},
    "tea salon":   {"title": "Un thé à votre nom ☕", "content": "Pâtisserie offerte avec votre prochaine commande."},
    "wine bar":    {"title": "Un verre vous attend 🍷", "content": "Dégustation offerte avec votre prochaine visite."},
    "juice bar":   {"title": "Votre shot vitaminé 🥤", "content": "Smoothie taille L au prix du M toute la semaine."},
    "hair salon":  {"title": "Un brushing offert ✂️", "content": "Avec votre prochaine coupe. C'est le moment de revenir."},
    "spa":         {"title": "Un moment rien qu'à vous 💆", "content": "Soin du visage offert avec votre prochain massage."},
    "gym":         {"title": "On vous attend au prochain cours 💪", "content": "Séance coach personnel offerte ce mois-ci."},
    "yoga":        {"title": "Votre tapis vous attend 🧘", "content": "Un cours offert pour reprendre en douceur."},
    "dance":       {"title": "La piste vous attend 💃", "content": "Cours d'essai offert ce week-end."},
    "book store":  {"title": "Une lecture vous attend 📚", "content": "−20% sur votre prochain achat. À tout bientôt !"},
    "florist":     {"title": "Un bouquet à votre nom 💐", "content": "Une tige offerte avec votre prochain bouquet."},
    "optician":    {"title": "Vos lunettes sont prêtes 👓", "content": "Contrôle de vue offert + 2e paire à −50%."},
}

@app.get("/api/owner/campaigns/reactivation-templates")
def get_reactivation_templates(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """Pre-filled reactivation campaign templates tailored to this tenant's sector."""
    tid = token_data.tenant_id
    tenant = db.tenants.find_one({"id": tid})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    sector = tenant.get("sector") or "restaurant"
    default = {"title": "On vous a manqué ✨", "content": "Revenez cette semaine pour une offre spéciale."}
    template = REACTIVATION_TEMPLATES_BY_SECTOR.get(sector, default)
    return {
        "sector": sector,
        "template": template,
        "all_sectors": [
            {"sector": k, "title": v["title"], "content": v["content"]}
            for k, v in REACTIVATION_TEMPLATES_BY_SECTOR.items()
        ],
    }


# --- Feature 8: Custom sender name ---------------------------
class SenderNameRequest(BaseModel):
    sender_name: str

@app.put("/api/owner/settings/sender-name")
def update_sender_name(
    req: SenderNameRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Set the 'From' name shown on push notifications and campaign emails."""
    tid = token_data.tenant_id
    if not req.sender_name.strip():
        raise HTTPException(status_code=400, detail="Sender name cannot be empty")
    db.tenants.update_one(
        {"id": tid},
        {"$set": {"campaign_sender_name": req.sender_name.strip()}}
    )
    return {"status": "ok", "sender_name": req.sender_name.strip()}


# --- Feature 9: Fine-grained roles (Manager / Staff) ---------
class TeamMemberRequest(BaseModel):
    email: str
    password: str
    role: str  # "manager" or "staff"

@app.get("/api/owner/team")
def list_team(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """List Manager + Staff users for this tenant."""
    tid = token_data.tenant_id
    members = list(db.users.find(
        {"tenant_id": tid, "role": {"$in": ["manager", "staff"]}},
        {"_id": 0, "hashed_password": 0}
    ))
    return {"members": members}

@app.post("/api/owner/team")
def add_team_member(
    req: TeamMemberRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Create a Manager or Staff user scoped to this tenant.
    Manager = stats only (business_owner read endpoints).
    Staff = scan only (/owner/scan).
    """
    if req.role not in ("manager", "staff"):
        raise HTTPException(status_code=400, detail="Role must be 'manager' or 'staff'")
    if db.users.find_one({"email": req.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = UserInDB(
        email=req.email,
        role=req.role,
        tenant_id=token_data.tenant_id,
        hashed_password=hash_password(req.password),
    )
    db.users.insert_one(new_user.model_dump())
    return {"status": "ok", "email": req.email, "role": req.role}

@app.delete("/api/owner/team/{email}")
def remove_team_member(
    email: str,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Remove a team member. Only works for manager/staff in the same tenant."""
    result = db.users.delete_one({
        "email": email,
        "tenant_id": token_data.tenant_id,
        "role": {"$in": ["manager", "staff"]},
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"status": "ok"}


# --- Feature 10: Monthly report ------------------------------
@app.get("/api/owner/monthly-report")
def get_monthly_report(
    month: Optional[str] = None,  # "YYYY-MM"; defaults to last month
    token_data: TokenData = Depends(require_role(["business_owner", "manager"]))
):
    """Month-end rollup: customers, visits, revenue, top campaigns, new customers, tier shifts."""
    tid = token_data.tenant_id
    now = datetime.now(timezone.utc)

    if month:
        try:
            year, mo = [int(x) for x in month.split("-")]
            start = datetime(year, mo, 1, tzinfo=timezone.utc)
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    else:
        # Last complete month
        first_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        start = (first_this - timedelta(days=1)).replace(day=1)

    end = (start + timedelta(days=32)).replace(day=1)
    next_month = (end + timedelta(days=32)).replace(day=1)

    visits_this = list(db.visits.find({
        "tenant_id": tid,
        "created_at": {"$gte": start, "$lt": end},
    }))
    visits_prev_start = (start - timedelta(days=1)).replace(day=1)
    visits_prev_count = db.visits.count_documents({
        "tenant_id": tid,
        "created_at": {"$gte": visits_prev_start, "$lt": start},
    })

    new_customers = db.customers.count_documents({
        "tenant_id": tid,
        "created_at": {"$gte": start, "$lt": end},
    })
    new_customers_prev = db.customers.count_documents({
        "tenant_id": tid,
        "created_at": {"$gte": visits_prev_start, "$lt": start},
    })

    revenue = round(sum(v.get("amount_paid", 0) for v in visits_this), 2)

    # Campaigns sent this month
    camps = list(db.campaigns.find({
        "tenant_id": tid,
        "sent_at": {"$gte": start, "$lt": end},
    }))
    camp_out = [
        {
            "name": c.get("name"),
            "targeted": c.get("targeted_count", 0),
            "delivered": c.get("delivered_count", 0),
            "opens": c.get("opens", 0),
            "visits_from": c.get("visits_from_campaign", 0),
            "clicks": c.get("offer_clicks", 0),
        }
        for c in camps
    ]

    def delta_pct(cur, prev):
        if not prev:
            return None
        return round((cur - prev) / prev * 100, 1)

    return {
        "month": start.strftime("%Y-%m"),
        "month_label": start.strftime("%B %Y"),
        "totals": {
            "visits": len(visits_this),
            "visits_delta_pct": delta_pct(len(visits_this), visits_prev_count),
            "new_customers": new_customers,
            "new_customers_delta_pct": delta_pct(new_customers, new_customers_prev),
            "revenue": revenue,
            "avg_basket": round(revenue / len(visits_this), 2) if visits_this else 0,
        },
        "campaigns": camp_out,
        "campaign_count": len(camps),
    }


# --- Feature 11: Offer click / push dismiss tracking ---------
@app.post("/api/campaigns/{campaign_id}/track-click")
def track_offer_click(campaign_id: str, customer_id: Optional[str] = None):
    """Called by wallet card / email when a recipient clicks the offer link."""
    camp = db.campaigns.find_one({"id": campaign_id})
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    update = {"$inc": {"offer_clicks": 1}}
    if customer_id:
        # best-effort unique-click counting
        if customer_id not in (camp.get("click_customer_ids") or []):
            update["$addToSet"] = {"click_customer_ids": customer_id}
            update["$inc"]["offer_clicks_unique"] = 1
    db.campaigns.update_one({"id": campaign_id}, update)
    return {"status": "ok"}

@app.post("/api/campaigns/{campaign_id}/track-dismiss")
def track_push_dismiss(campaign_id: str):
    """Called by the wallet card when user dismisses a push without opening."""
    db.campaigns.update_one({"id": campaign_id}, {"$inc": {"push_dismissals": 1}})
    return {"status": "ok"}


# ========================================================================
# NEW FEATURES (this batch): VIP tier · reward redemption · birthdays ·
# per-customer visit history · time-of-day segments · proximity push ·
# saved segments
# ========================================================================

# ========================================================================
# REVIEWS — ratings, sentiment, topic clustering
# ========================================================================
#
# Customers rate a visit on a 1–10 scale and optionally leave free text.
# On submit we run a lexicon-based sentiment scorer + topic classifier over
# the text. Both are deterministic and self-contained so the numbers are
# reproducible and don't depend on an external API.
#
# Sentiment lexicon: positive/negative words in FR + EN, with very basic
# negation handling ("pas bon" = negative). Not perfect but robust and
# much better than pure rating-only analysis.
#
# Topic classifier: keyword sets for 5 recurring themes — service speed,
# cleanliness, staff friendliness, price, wait time. A review mentioning a
# keyword in a topic's set is flagged as on-topic with a confidence score
# proportional to how many of the set appeared.
#

_REVIEW_POS_WORDS = {
    # FR
    "bon", "bonne", "bien", "excellent", "excellente", "super", "génial", "genial",
    "génialissime", "parfait", "parfaite", "top", "magnifique", "délicieux", "delicieux",
    "savoureux", "savoureuse", "savoureuses", "recommande", "rapide", "rapidement",
    "propre", "accueillant", "accueillante", "sympathique", "sympa", "aimable",
    "poli", "polie", "souriant", "souriante", "chaleureux", "chaleureuse",
    "attentif", "attentionné", "professionnel", "professionnelle",
    "qualité", "qualite", "agréable", "agreable", "merci", "adore", "adorable",
    "fidèle", "fidele", "heureux", "heureuse", "satisfait", "satisfaite",
    "frais", "fraîche", "fraiche", "copieux", "abordable", "raisonnable",
    "belle", "beau",
    # EN
    "good", "great", "excellent", "amazing", "awesome", "lovely", "wonderful",
    "fantastic", "perfect", "clean", "fast", "quick", "friendly", "kind",
    "helpful", "smiling", "polite", "professional", "fresh", "delicious",
    "tasty", "recommend", "best", "love", "loved", "nice", "happy",
    "affordable", "cheap", "fair", "quality", "thanks", "thank",
}

_REVIEW_NEG_WORDS = {
    # FR
    "mauvais", "mauvaise", "horrible", "nul", "nulle", "décevant", "decevant",
    "déçu", "decue", "déçue", "lent", "lente", "lentement", "attendre",
    "attente", "file", "queue", "long", "longue", "sale", "sales", "saleté",
    "salete", "dégoûtant", "degoutant", "froid", "froide", "cher", "chère",
    "chere", "ruineux", "arrogant", "impoli", "malpoli", "désagréable",
    "desagreable", "bruyant", "bondé", "bonde", "bordélique", "chaotique",
    "indifférent", "indifferent", "pire", "affreux", "affreuse", "infect",
    "trop", "beaucoup",
    # EN
    "bad", "terrible", "awful", "worst", "horrible", "slow", "late", "cold",
    "rude", "dirty", "filthy", "expensive", "overpriced", "crowded", "noisy",
    "wait", "waited", "waiting", "queue", "disappointed", "disappointing",
    "mediocre", "stale", "wrong", "unfriendly", "unhappy", "hate", "never",
}

# Topic → keyword set. We strip accents when matching so "délai" / "delai" both hit.
_REVIEW_TOPICS = {
    "speed": {
        "rapide", "rapidement", "vite", "express", "fast", "quick", "prompt", "speedy",
        "lent", "lente", "long", "longue", "slow", "retard", "tardif", "delayed",
    },
    "cleanliness": {
        "propre", "propreté", "proprete", "clean", "cleanliness", "impeccable",
        "hygiène", "hygiene", "sale", "dirty", "filthy", "poussière", "poussiere",
    },
    "staff": {
        "accueil", "accueillant", "accueillante", "personnel", "équipe", "equipe",
        "staff", "serveur", "serveuse", "caissier", "caissière", "caissiere",
        "friendly", "kind", "polite", "rude", "impoli", "sympathique", "sympa",
        "arrogant", "souriant", "souriante", "smile", "smiling", "helpful",
    },
    "price": {
        "prix", "cher", "chère", "chere", "coûteux", "couteux", "abordable",
        "price", "pricing", "expensive", "cheap", "overpriced", "affordable",
        "value", "cost", "budget", "raisonnable",
    },
    "wait_time": {
        "attente", "attendre", "attendu", "attendue", "queue", "file", "patience",
        "wait", "waiting", "waited", "line", "délai", "delai",
    },
}

def _strip_accents(s: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def _detect_language(text: str) -> Optional[str]:
    """Very lightweight FR/EN detector based on stop words."""
    if not text: return None
    t = " " + text.lower() + " "
    fr = sum(1 for w in (" le ", " la ", " les ", " un ", " une ", " et ", " est ", " j'ai ", " très ", " pas ") if w in t)
    en = sum(1 for w in (" the ", " a ", " and ", " is ", " was ", " very ", " not ", " i ") if w in t)
    if fr == 0 and en == 0: return None
    return "fr" if fr >= en else "en"

def analyze_review_text(text: str, rating: int) -> Dict[str, Any]:
    """Run sentiment + topic extraction on a review. Deterministic and fast.

    Returns {sentiment, sentiment_score, topics, topic_scores, language}.
    Rating is used as a tie-breaker when the text is empty or evenly split.
    """
    clean = (text or "").strip()
    language = _detect_language(clean)
    if not clean:
        # No text → score purely from the numeric rating.
        if rating >= 8:   return {"sentiment": "positive", "sentiment_score": 0.6, "topics": [], "topic_scores": {}, "language": language}
        if rating <= 4:   return {"sentiment": "negative", "sentiment_score": -0.6, "topics": [], "topic_scores": {}, "language": language}
        return {"sentiment": "neutral", "sentiment_score": 0.0, "topics": [], "topic_scores": {}, "language": language}

    import re
    # Tokenise, lowercase, strip accents + punctuation.
    flat = _strip_accents(clean.lower())
    tokens = re.findall(r"[a-zàâäéèêëîïôöùûüç']+", clean.lower())
    tokens_flat = [_strip_accents(t) for t in tokens]

    pos_set = {_strip_accents(w) for w in _REVIEW_POS_WORDS}
    neg_set = {_strip_accents(w) for w in _REVIEW_NEG_WORDS}
    negators = {"pas", "ne", "n", "not", "never", "no", "aucun", "aucune", "jamais"}

    pos = neg = 0
    for i, tok in enumerate(tokens_flat):
        flipped = i > 0 and tokens_flat[i - 1] in negators
        if tok in pos_set:
            if flipped: neg += 1
            else: pos += 1
        elif tok in neg_set:
            if flipped: pos += 1
            else: neg += 1

    # Score blends text signal with the numeric rating (rating is a strong prior).
    total = pos + neg
    text_score = ((pos - neg) / total) if total else 0.0
    rating_score = (rating - 5.5) / 4.5        # maps 1..10 onto ~-1..+1
    # Weighted average: text dominates when there's signal, rating anchors otherwise.
    if total >= 3:
        sentiment_score = round(0.7 * text_score + 0.3 * rating_score, 3)
    elif total >= 1:
        sentiment_score = round(0.5 * text_score + 0.5 * rating_score, 3)
    else:
        sentiment_score = round(rating_score, 3)
    if sentiment_score >= 0.15:    sentiment = "positive"
    elif sentiment_score <= -0.15: sentiment = "negative"
    else:                          sentiment = "neutral"

    # Topic classification.
    topics = []
    topic_scores = {}
    for topic, keywords in _REVIEW_TOPICS.items():
        kw_flat = {_strip_accents(k.lower()) for k in keywords}
        hits = sum(1 for tok in tokens_flat if tok in kw_flat)
        if hits > 0:
            # Confidence = hits normalised by total words, capped at 1.0
            conf = min(1.0, hits / max(3, len(tokens_flat) / 4))
            topics.append(topic)
            topic_scores[topic] = round(conf, 3)

    return {
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "topics": topics,
        "topic_scores": topic_scores,
        "language": language,
    }


class ReviewSubmit(BaseModel):
    customer_id: Optional[str] = None
    barcode_id: Optional[str] = None
    rating: int
    text: Optional[str] = ""
    visit_id: Optional[str] = None
    branch_id: Optional[str] = None


@app.post("/api/public/reviews")
def submit_review(req: ReviewSubmit):
    """Customer-facing endpoint. Accepts either customer_id or barcode_id so
    the wallet card page can post a review without the customer being logged
    in. Rating must be 1..10; text is optional. Dedupes one review per visit.
    """
    if req.rating < 1 or req.rating > 10:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 10")
    if not req.customer_id and not req.barcode_id:
        raise HTTPException(status_code=400, detail="Provide customer_id or barcode_id")

    q = {}
    if req.customer_id:
        q["id"] = req.customer_id
    else:
        q["barcode_id"] = req.barcode_id
    cust = db.customers.find_one(q)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Dedupe: if a visit_id was supplied, only accept one review per visit.
    if req.visit_id:
        existing = db.reviews.find_one({
            "tenant_id": cust.get("tenant_id"),
            "customer_id": cust.get("id"),
            "visit_id": req.visit_id,
        })
        if existing:
            raise HTTPException(status_code=409, detail="You already rated this visit.")

    analysis = analyze_review_text(req.text or "", req.rating)
    review = Review(
        id=str(uuid.uuid4()),
        tenant_id=cust.get("tenant_id"),
        customer_id=cust.get("id"),
        branch_id=req.branch_id or cust.get("branch_id"),
        visit_id=req.visit_id,
        rating=int(req.rating),
        text=(req.text or "").strip()[:4000],
        sentiment=analysis["sentiment"],
        sentiment_score=analysis["sentiment_score"],
        topics=analysis["topics"],
        topic_scores=analysis["topic_scores"],
        language=analysis["language"],
    ).model_dump()
    db.reviews.insert_one(review)
    review.pop("_id", None)
    return {"status": "ok", "review": review}


def _compute_review_kpis(query: Dict[str, Any]) -> Dict[str, Any]:
    """Aggregate the 4 headline review KPIs + distribution + topic breakdown
    over whatever filter the caller passes in. Used by both owner and admin
    analytics so the numbers line up across dashboards.
    """
    now = datetime.now(timezone.utc)
    thirty_ago = now - timedelta(days=30)
    sixty_ago = now - timedelta(days=60)

    # One pass over the set — reviews are small & bounded (<< 100k per tenant).
    reviews = list(db.reviews.find(query))
    total = len(reviews)
    if total == 0:
        return {
            "total_reviews": 0,
            "average_rating": None,
            "rating_distribution": {str(i): 0 for i in range(1, 11)},
            "negative_review_rate_pct": 0.0,
            "sentiment_breakdown": {"positive": 0, "neutral": 0, "negative": 0},
            "sentiment_score": 0,
            "review_velocity": {"last_30d": 0, "prev_30d": 0, "delta_pct": 0.0},
            "topic_breakdown": [],
            "recent": [],
        }

    ratings = [int(r.get("rating", 0)) for r in reviews if r.get("rating")]
    avg = sum(ratings) / len(ratings) if ratings else 0
    dist = {str(i): 0 for i in range(1, 11)}
    for r in ratings:
        if 1 <= r <= 10:
            dist[str(r)] += 1

    # Negative review rate = % with rating ≤ 4/10 (equivalent to 1–2 / 5★).
    neg_count = sum(1 for r in ratings if r <= 4)
    negative_rate = (neg_count / total) * 100 if total else 0.0

    # Sentiment breakdown from pre-computed field — cheap.
    pos = sum(1 for r in reviews if r.get("sentiment") == "positive")
    neu = sum(1 for r in reviews if r.get("sentiment") == "neutral")
    neg = sum(1 for r in reviews if r.get("sentiment") == "negative")
    sent_score = round(((pos - neg) / total) * 100, 1) if total else 0

    # Review velocity — reviews in the last 30d vs the 30d before that.
    last30 = sum(1 for r in reviews if r.get("created_at") and r["created_at"] >= thirty_ago)
    prev30 = sum(1 for r in reviews if r.get("created_at") and sixty_ago <= r["created_at"] < thirty_ago)
    delta_pct = round(((last30 - prev30) / prev30) * 100, 1) if prev30 else (100.0 if last30 else 0.0)

    # Topic breakdown — count, avg rating, sentiment tilt per theme.
    topic_agg = {t: {"count": 0, "rating_sum": 0, "pos": 0, "neg": 0} for t in _REVIEW_TOPICS.keys()}
    for r in reviews:
        rating_val = int(r.get("rating", 0) or 0)
        sentiment_val = r.get("sentiment", "neutral")
        for t in (r.get("topics") or []):
            if t not in topic_agg: continue
            topic_agg[t]["count"] += 1
            topic_agg[t]["rating_sum"] += rating_val
            if sentiment_val == "positive": topic_agg[t]["pos"] += 1
            elif sentiment_val == "negative": topic_agg[t]["neg"] += 1
    topic_breakdown = []
    for t, v in topic_agg.items():
        if v["count"] == 0: continue
        topic_breakdown.append({
            "topic": t,
            "count": v["count"],
            "mention_pct": round(v["count"] / total * 100, 1),
            "avg_rating": round(v["rating_sum"] / v["count"], 2),
            "positive_pct": round(v["pos"] / v["count"] * 100, 1),
            "negative_pct": round(v["neg"] / v["count"] * 100, 1),
        })
    topic_breakdown.sort(key=lambda x: -x["count"])

    # Recent review feed (last 10, newest first).
    recent_reviews = sorted(
        reviews,
        key=lambda r: r.get("created_at") or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:10]
    recent = []
    for r in recent_reviews:
        recent.append({
            "id": r.get("id"),
            "rating": r.get("rating"),
            "text": r.get("text", ""),
            "sentiment": r.get("sentiment"),
            "topics": r.get("topics", []),
            "customer_id": r.get("customer_id"),
            "branch_id": r.get("branch_id"),
            "created_at": r.get("created_at"),
        })

    return {
        "total_reviews": total,
        "average_rating": round(avg, 2),
        "rating_distribution": dist,
        "negative_review_rate_pct": round(negative_rate, 1),
        "sentiment_breakdown": {"positive": pos, "neutral": neu, "negative": neg},
        "sentiment_score": sent_score,            # -100 to +100
        "review_velocity": {"last_30d": last30, "prev_30d": prev30, "delta_pct": delta_pct},
        "topic_breakdown": topic_breakdown,
        "recent": recent,
    }


@app.get("/api/owner/analytics/reviews")
def get_owner_review_analytics(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
):
    """Review KPIs for the logged-in owner's tenant."""
    q = {"tenant_id": token_data.tenant_id}
    if branch_id:
        q["branch_id"] = branch_id
    return _compute_review_kpis(q)


@app.get("/api/owner/reviews")
def list_owner_reviews(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),      # positive | neutral | negative
    topic: Optional[str] = Query(None),          # speed | cleanliness | ...
    min_rating: Optional[int] = Query(None),
    max_rating: Optional[int] = Query(None),
    limit: int = Query(100),
):
    """List raw reviews with filters for a "manage reviews" view."""
    q = {"tenant_id": token_data.tenant_id}
    if branch_id: q["branch_id"] = branch_id
    if sentiment: q["sentiment"] = sentiment
    if topic:     q["topics"] = topic
    if min_rating is not None: q.setdefault("rating", {})["$gte"] = int(min_rating)
    if max_rating is not None: q.setdefault("rating", {})["$lte"] = int(max_rating)
    rows = list(
        db.reviews.find(q).sort("created_at", -1).limit(max(1, min(limit, 500)))
    )
    for r in rows:
        r.pop("_id", None)
        # Attach the customer name for the UI.
        c = db.customers.find_one({"id": r.get("customer_id")}, {"name": 1, "tier": 1})
        if c:
            r["customer_name"] = c.get("name", "")
            r["customer_tier"] = c.get("tier", "bronze")
    return {"reviews": rows, "count": len(rows)}


@app.get("/api/admin/analytics/reviews")
def get_admin_review_analytics(
    token_data: TokenData = Depends(require_role(["super_admin"])),
    tenant_id: Optional[str] = Query(None),
):
    """Global review KPIs across all tenants + per-tenant leaderboard.
    Filter to a single tenant by passing ?tenant_id=..."""
    q = {}
    if tenant_id:
        q["tenant_id"] = tenant_id
    kpis = _compute_review_kpis(q)

    # Per-tenant leaderboard (top + bottom by average rating, min 3 reviews).
    leaderboard = []
    for row in db.reviews.aggregate([
        {"$group": {
            "_id": "$tenant_id",
            "count": {"$sum": 1},
            "avg": {"$avg": "$rating"},
            "negative": {"$sum": {"$cond": [{"$lte": ["$rating", 4]}, 1, 0]}},
        }},
        {"$match": {"count": {"$gte": 3}}},
        {"$sort": {"avg": -1}},
    ]):
        t = db.tenants.find_one({"id": row["_id"]}, {"name": 1, "slug": 1}) or {}
        leaderboard.append({
            "tenant_id": row["_id"],
            "tenant_name": t.get("name", "(unknown)"),
            "slug": t.get("slug", ""),
            "review_count": row["count"],
            "average_rating": round(row["avg"], 2),
            "negative_count": row["negative"],
            "negative_rate_pct": round((row["negative"] / row["count"]) * 100, 1),
        })
    kpis["leaderboard"] = leaderboard
    return kpis


# --- Reward redemption: record the moment a filled card is cashed in ---------
class RedeemRewardRequest(BaseModel):
    barcode_id: Optional[str] = None
    customer_id: Optional[str] = None
    reward_name: Optional[str] = None       # e.g. "Free coffee", "10€ off"
    reward_value_eur: Optional[float] = None
    branch_id: Optional[str] = None
    notes: Optional[str] = None


@app.post("/api/owner/rewards/redeem")
def redeem_reward(
    req: RedeemRewardRequest,
    token_data: TokenData = Depends(require_role(["business_owner", "manager", "staff"])),
):
    """Record that a customer cashed in their reward.

    Works from either barcode_id (staff typical flow) or customer_id.
    Emits an entry in db.rewards_redeemed for the KPI + history, and decrements
    the customer's visit counter by one full-card so subsequent cards fill up
    from zero again (mirrors the real-world "take the stamp card off the wall").
    """
    tid = token_data.tenant_id
    if not req.barcode_id and not req.customer_id:
        raise HTTPException(status_code=400, detail="Provide barcode_id or customer_id")
    q = {"tenant_id": tid}
    if req.customer_id:
        q["id"] = req.customer_id
    else:
        q["barcode_id"] = req.barcode_id
    cust = db.customers.find_one(q)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Threshold for a full card (so decrement matches the real card)
    card_tpl = db.card_templates.find_one({"tenant_id": tid}) or {}
    threshold = max(int(card_tpl.get("reward_threshold_stamps", 10)) *
                    int(card_tpl.get("visits_per_stamp", 1)), 1)
    current_visits = int(cust.get("visits", 0) or 0)
    if current_visits < threshold:
        raise HTTPException(
            status_code=400,
            detail=f"Customer needs {threshold - current_visits} more visit(s) before redeeming.",
        )

    reward = {
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "customer_id": cust["id"],
        "customer_name": cust.get("name", ""),
        "reward_name": req.reward_name or "Reward",
        "reward_value_eur": req.reward_value_eur,
        "branch_id": req.branch_id or cust.get("branch_id"),
        "notes": req.notes or "",
        "redeemed_at": datetime.now(timezone.utc),
        "staff_email": getattr(token_data, "email", None),
    }
    db.rewards_redeemed.insert_one(reward)

    # Decrement visits by one full-card so their next card starts fresh.
    db.customers.update_one(
        {"id": cust["id"]},
        {"$inc": {"visits": -threshold, "rewards_redeemed_count": 1},
         "$set": {"last_reward_redeemed_at": reward["redeemed_at"]}},
    )
    reward.pop("_id", None)
    return reward


@app.get("/api/owner/rewards/redeemed")
def list_redeemed_rewards(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
    days: Optional[int] = Query(None),
):
    """List recent reward redemptions (default: all; if `days` given, last N days)."""
    q = {"tenant_id": token_data.tenant_id}
    if branch_id:
        q["branch_id"] = branch_id
    if days and days > 0:
        q["redeemed_at"] = {"$gte": datetime.now(timezone.utc) - timedelta(days=days)}
    rows = list(db.rewards_redeemed.find(q).sort("redeemed_at", -1).limit(500))
    for r in rows:
        r.pop("_id", None)
    # Aggregate counters for KPI cards
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)
    today_q = dict(q); today_q["redeemed_at"] = {"$gte": today_start}
    month_q = dict(q); month_q["redeemed_at"] = {"$gte": month_start}
    return {
        "redemptions": rows,
        "today_count": db.rewards_redeemed.count_documents(today_q),
        "month_count": db.rewards_redeemed.count_documents(month_q),
        "total_count": db.rewards_redeemed.count_documents(q),
    }


# --- Per-customer visit history ---------------------------------------
@app.get("/api/owner/customers/{customer_id}/visits")
def customer_visit_history(
    customer_id: str,
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    limit: int = Query(50),
):
    """Last N visits for one customer — date, amount, points, branch."""
    cust = db.customers.find_one({"id": customer_id, "tenant_id": token_data.tenant_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    visits = list(
        db.visits.find({"tenant_id": token_data.tenant_id, "customer_id": customer_id})
        .sort("visit_time", -1)
        .limit(max(1, min(limit, 500)))
    )
    for v in visits:
        v.pop("_id", None)
    # Also include last redemptions so the Journey tab can show the full story.
    redemptions = list(
        db.rewards_redeemed.find({"tenant_id": token_data.tenant_id, "customer_id": customer_id})
        .sort("redeemed_at", -1)
        .limit(20)
    )
    for r in redemptions:
        r.pop("_id", None)
    return {
        "customer_id": customer_id,
        "visits": visits,
        "redemptions": redemptions,
        "total_visits": int(cust.get("visits", 0) or 0),
        "total_amount_paid": float(cust.get("total_amount_paid", 0) or 0),
    }


# --- Birthdays this month --------------------------------------------
@app.get("/api/owner/analytics/birthdays-this-month")
def birthdays_this_month(
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
    branch_id: Optional[str] = Query(None),
):
    """Customers whose birthday falls in the current calendar month."""
    now = datetime.now(timezone.utc)
    mm = now.strftime("%m")
    q = {"tenant_id": token_data.tenant_id, "birthday": {"$regex": f"^{mm}"}}
    if branch_id:
        q["branch_id"] = branch_id
    rows = list(db.customers.find(q).sort("birthday", 1))
    out = []
    for c in rows:
        bd = c.get("birthday") or ""
        # Compute days until birthday this month (for light sort hinting)
        try:
            day = int(bd.split("-")[1]) if "-" in bd else 0
        except Exception:
            day = 0
        out.append({
            "id": c.get("id"),
            "name": c.get("name", ""),
            "email": c.get("email", ""),
            "phone": c.get("phone", ""),
            "tier": c.get("tier", "bronze"),
            "birthday": bd,
            "day_of_month": day,
            "total_visits": c.get("visits", 0),
            "total_amount_paid": c.get("total_amount_paid", 0),
        })
    return {"count": len(out), "month": now.strftime("%B"), "customers": out}


# --- Real-time proximity push: fired when the wallet-card page pings --
class ProximityPingRequest(BaseModel):
    customer_id: str
    latitude: float
    longitude: float


def _haversine_meters(lat1, lng1, lat2, lng2) -> float:
    import math
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@app.post("/api/public/proximity-ping")
def proximity_ping(req: ProximityPingRequest):
    """Customer's wallet-card page calls this every time it's opened with GPS
    permission granted. If the customer is within the tenant's configured
    `geo_radius_meters` of a branch (or tenant address) AND their cooldown
    has elapsed, fire a fresh push notification. Otherwise no-op.

    Public endpoint intentionally — called from the customer's own device,
    before/after login matters less than the customer_id matching a real
    record. Rate-limited by the geo_cooldown_days window per customer.
    """
    cust = db.customers.find_one({"id": req.customer_id})
    if not cust:
        return {"status": "ignored", "reason": "unknown customer"}
    tid = cust.get("tenant_id")
    tenant = db.tenants.find_one({"id": tid})
    if not tenant or not tenant.get("geo_enabled"):
        return {"status": "ignored", "reason": "geo disabled for tenant"}

    # VIP-only gate: when the super-admin has flipped `vip_geo_only` on for this
    # tenant, proximity pushes fire exclusively for VIP-tier customers. Anyone
    # else gets silently ignored — same as if geo were off for them.
    if tenant.get("vip_geo_only"):
        if (cust.get("tier") or "").lower() != "vip":
            return {"status": "ignored", "reason": "vip_only: customer not VIP"}

    radius_m = float(tenant.get("geo_radius_meters") or 500)
    cooldown_days = int(tenant.get("geo_cooldown_days") or 1)
    cutoff = datetime.now(timezone.utc) - timedelta(days=cooldown_days)

    # Last proximity push for this customer — cooldown enforcement.
    last = db.push_notifications.find_one(
        {"customer_id": cust["id"], "tenant_id": tid, "type": "proximity"},
        sort=[("sent_at", -1)],
    )
    if last and last.get("sent_at") and last["sent_at"] >= cutoff:
        return {"status": "cooldown", "next_eligible_at": (last["sent_at"] + timedelta(days=cooldown_days)).isoformat()}

    # Figure out which branch (or the tenant address) they're nearest to.
    anchors = []
    for b in tenant.get("branches") or []:
        # Branches often lack raw lat/lng — resolve from postal_code when needed.
        blat, blng = b.get("latitude"), b.get("longitude")
        if blat is None or blng is None:
            blat, blng = get_postal_coords(b.get("postal_code") or "")
        if blat is not None:
            anchors.append({"id": b.get("id"), "name": b.get("name", ""), "lat": blat, "lng": blng})
    if not anchors:
        # Fall back to tenant-level address coords
        tl, tn = get_postal_coords((tenant.get("address") or "").split(",")[-1].strip().split()[0] if tenant.get("address") else "")
        anchors = [{"id": tid, "name": tenant.get("name", ""), "lat": tl, "lng": tn}]

    nearest = None
    for a in anchors:
        dist = _haversine_meters(req.latitude, req.longitude, a["lat"], a["lng"])
        if nearest is None or dist < nearest["distance_m"]:
            nearest = {**a, "distance_m": dist}

    if not nearest or nearest["distance_m"] > radius_m:
        return {"status": "out_of_range", "distance_m": (nearest["distance_m"] if nearest else None)}

    # In range — fire a push.
    biz = tenant.get("campaign_sender_name") or tenant.get("name") or "votre boutique"
    first_name = (cust.get("name") or "").split(" ")[0]
    title = f"{biz} est juste à côté 👋"
    body = (
        f"Bonjour {first_name}, vous êtes tout près de {nearest['name'] or biz}. "
        "Venez scanner votre carte — une attention vous attend !"
    )
    db.push_notifications.insert_one({
        "customer_id": cust["id"],
        "tenant_id": tid,
        "title": title,
        "body": body,
        "type": "proximity",
        "branch_id": nearest.get("id"),
        "distance_m": int(nearest["distance_m"]),
        "sent_at": datetime.now(timezone.utc),
    })
    return {
        "status": "sent",
        "branch_id": nearest.get("id"),
        "distance_m": int(nearest["distance_m"]),
        "title": title,
        "body": body,
    }


# --- Saved segments: owners save their favourite filter combos ---------
class SavedSegmentRequest(BaseModel):
    name: str
    description: Optional[str] = None
    filters: Dict[str, Any]                 # UI-shape filters dict
    segment: Optional[Dict[str, Any]] = None  # alt type-based segment


@app.get("/api/owner/segments")
def list_saved_segments(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    rows = list(db.saved_segments.find({"tenant_id": token_data.tenant_id}).sort("created_at", -1))
    for r in rows:
        r.pop("_id", None)
    return {"segments": rows}


@app.post("/api/owner/segments")
def create_saved_segment(
    req: SavedSegmentRequest,
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": token_data.tenant_id,
        "name": req.name.strip()[:120] or "Unnamed segment",
        "description": (req.description or "").strip()[:500],
        "filters": req.filters or {},
        "segment": req.segment or None,
        "created_at": datetime.now(timezone.utc),
    }
    db.saved_segments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/owner/segments/{segment_id}")
def delete_saved_segment(
    segment_id: str,
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    res = db.saved_segments.delete_one({"id": segment_id, "tenant_id": token_data.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"status": "ok"}


# --- Feature 12: Active cards widget + upgrade prompt --------
@app.get("/api/owner/analytics/active-cards")
def get_active_cards(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    """How many pass_issued cards are active. Nudges an upgrade if close to plan limit."""
    tid = token_data.tenant_id
    tenant = db.tenants.find_one({"id": tid})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    active = db.customers.count_documents({"tenant_id": tid, "pass_issued": True})
    total = db.customers.count_documents({"tenant_id": tid})
    plan = tenant.get("plan", "basic")
    plan_cap = PLAN_FEATURES.get(plan, {}).get("max_customers", 500)

    usage_pct = round(active / plan_cap * 100, 1) if plan_cap else 0
    near_limit = usage_pct >= 80

    # Suggest next plan up
    next_plan = {"basic": "gold", "gold": "vip", "vip": "chain", "chain": None}.get(plan)
    next_plan_cap = PLAN_FEATURES.get(next_plan, {}).get("max_customers") if next_plan else None
    next_plan_price = PLAN_PRICES.get(next_plan) if next_plan else None

    return {
        "active_cards": active,
        "total_customers": total,
        "plan": plan,
        "plan_cap": plan_cap,
        "usage_pct": usage_pct,
        "near_limit": near_limit,
        "suggest_upgrade": near_limit and next_plan is not None,
        "next_plan": next_plan,
        "next_plan_cap": next_plan_cap,
        "next_plan_price": next_plan_price,
    }


# ============================================================
# ADMIN INSIGHTS — platform-wide rollup of the 12 insight features
# Used by the super-admin Insights page. Every number here is
# derived from the same collections the owner-side Insights page
# uses, guaranteeing consistency across the UI.
# ============================================================

@app.get("/api/admin/insights")
def get_admin_insights(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Platform-wide Insights: churn, LTV, alerts, active cards, top performers.
    Single response so the admin Insights page renders with one round-trip on the
    frontend. All numbers come from the same aggregations Dashboard uses, so they
    match the global admin dashboard numbers.
    """
    now = datetime.now(timezone.utc)
    thirty = now - timedelta(days=30)
    sixty = now - timedelta(days=60)
    ninety = now - timedelta(days=90)

    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    all_customers = list(db.customers.find({}))
    total_customers = len(all_customers)

    # --- Churn buckets across the whole platform ---
    def pct(n):
        return round((n / total_customers) * 100, 1) if total_customers else 0.0

    one_visit = sum(1 for c in all_customers if c.get("visits", 0) <= 1)
    inactive_30 = sum(1 for c in all_customers if c.get("last_visit_date") and c["last_visit_date"] < thirty)
    inactive_60 = sum(1 for c in all_customers if c.get("last_visit_date") and c["last_visit_date"] < sixty)
    churned_90 = sum(1 for c in all_customers if c.get("last_visit_date") and c["last_visit_date"] < ninety)

    # --- LTV across the platform ---
    spend_values = sorted(c.get("total_amount_paid", 0) for c in all_customers)
    ltv_avg = round(sum(spend_values) / len(spend_values), 2) if spend_values else 0
    ltv_median = round(spend_values[len(spend_values) // 2], 2) if spend_values else 0
    ltv_top10 = round(spend_values[int(len(spend_values) * 0.9)], 2) if len(spend_values) >= 10 else (spend_values[-1] if spend_values else 0)

    ltv_by_tier = {}
    for c in all_customers:
        tier = (c.get("tier") or "bronze").lower()
        ltv_by_tier.setdefault(tier, []).append(c.get("total_amount_paid", 0))
    ltv_by_tier_out = [
        {
            "tier": t,
            "count": len(vals),
            "average_ltv": round(sum(vals) / len(vals), 2) if vals else 0,
            "total_revenue": round(sum(vals), 2),
        }
        for t, vals in sorted(ltv_by_tier.items(), key=lambda kv: {"gold": 0, "silver": 1, "bronze": 2}.get(kv[0], 3))
    ]

    # --- Active wallet passes ---
    active_cards = sum(1 for c in all_customers if c.get("pass_issued"))

    # --- Per-tenant visit counts (ONE aggregation) ---
    visits_by_tenant = {
        d["_id"]: d["count"]
        for d in db.visits.aggregate([
            {"$group": {"_id": "$tenant_id", "count": {"$sum": 1}}}
        ])
    }
    total_visits = sum(visits_by_tenant.values())

    customers_by_tenant = {}
    for c in all_customers:
        customers_by_tenant.setdefault(c.get("tenant_id"), []).append(c)

    # Platform-level alerts
    alerts = []
    if inactive_30 >= 10:
        alerts.append({
            "level": "warning", "icon": "⚠️",
            "title": f"{inactive_30} clients inactifs depuis 30 jours sur toute la plateforme",
            "detail": "Encouragez vos commerçants à lancer une campagne de relance."
        })
    if one_visit >= 50:
        alerts.append({
            "level": "warning", "icon": "🚪",
            "title": f"{pct(one_visit)}% des clients ne reviennent pas après 1 visite",
            "detail": "Moyenne plateforme. Proposez un template de bienvenue aux commerces concernés."
        })

    # Top performers across the platform (by visits)
    perf = []
    for t in tenants:
        tid = t["id"]
        t_custs = customers_by_tenant.get(tid, [])
        rev = round(sum(c.get("total_amount_paid", 0) for c in t_custs), 2)
        perf.append({
            "id": tid,
            "name": t.get("name"),
            "plan": t.get("plan", "basic"),
            "customers": len(t_custs),
            "visits": visits_by_tenant.get(tid, 0),
            "revenue": rev,
        })
    top_performers = sorted(perf, key=lambda x: x["visits"], reverse=True)[:10]
    bottom_performers = sorted(
        [p for p in perf if p["customers"] > 0],
        key=lambda x: x["visits"],
    )[:10]

    # Sector distribution for reactivation templates
    sector_counts = {}
    for t in tenants:
        sector = t.get("sector") or "other"
        sector_counts[sector] = sector_counts.get(sector, 0) + 1

    return {
        "totals": {
            "tenants": len(tenants),
            "customers": total_customers,
            "visits": total_visits,
            "active_cards": active_cards,
        },
        "churn": {
            "one_visit_only": one_visit,
            "one_visit_only_pct": pct(one_visit),
            "inactive_30d": inactive_30,
            "inactive_30d_pct": pct(inactive_30),
            "inactive_60d": inactive_60,
            "inactive_60d_pct": pct(inactive_60),
            "churned_90d": churned_90,
            "churned_90d_pct": pct(churned_90),
        },
        "ltv": {
            "average_ltv": ltv_avg,
            "median_ltv": ltv_median,
            "top_10_pct_ltv": ltv_top10,
            "by_tier": ltv_by_tier_out,
        },
        "alerts": alerts,
        "top_performers": top_performers,
        "at_risk_performers": bottom_performers,
        "sector_distribution": [
            {"sector": k, "count": v}
            for k, v in sorted(sector_counts.items(), key=lambda kv: kv[1], reverse=True)
        ],
    }


# ============================================================
# FEATURE ROLLOUT (Apr 2026, part 2): the 8 gaps from the audit
# 1. Offre anniversaire automatique (birthday auto-send)
# 2. Niveau VIP atteint — tier-up push (wired in /owner/scan above)
# 3. Campagnes auto (scheduled + recurring)
# 4. Offres personnalisées (template vars — render_template())
# 5. "Il te reste 2 points pour une récompense" (wired in /owner/scan above)
# 6. Super-admin broadcast to all end-customers
# 7. Upgrade-plan request flow
# 8. Triggered campaigns framework (cron drains triggers + schedules)
# ============================================================

CRON_SECRET = os.environ.get("CRON_SECRET", "")


def _dispatch_campaign_to_customers(tenant: dict, name: str, content: str, customer_list: list, trigger_type: str = "manual"):
    """Shared dispatch helper used by cron triggers + scheduled sends. Creates a
    Campaign doc and a push_notification per customer, and emails when possible."""
    if not customer_list:
        return None
    tid = tenant.get("id")
    sender_name = tenant.get("campaign_sender_name") or tenant.get("name") or "FidéliTour"
    now = datetime.now(timezone.utc)
    delivered = 0
    for cust in customer_list:
        rendered_body = render_template(content, cust, tenant)
        rendered_subject = render_template(name, cust, tenant)
        db.push_notifications.insert_one({
            "customer_id": cust["id"],
            "tenant_id": tid,
            "title": rendered_subject,
            "body": rendered_body,
            "type": trigger_type,
            "sent_at": now,
        })
        if cust.get("email"):
            html = _campaign_html(sender_name, rendered_subject, rendered_body, cust)
            if send_email_to_customer(cust["email"], sender_name, f"{sender_name} - {rendered_subject}", html):
                delivered += 1
    campaign = Campaign(
        id=str(uuid.uuid4()),
        tenant_id=tid,
        name=name,
        content=content,
        status="sent",
        filters={"auto_trigger": trigger_type},
        sent_at=now,
        targeted_count=len(customer_list),
        delivered_count=delivered,
        recipient_ids=[c["id"] for c in customer_list],
    )
    db.campaigns.insert_one(campaign.model_dump())
    return campaign.model_dump()


# --- 3 & 8: Scheduled campaigns ------------------------------
class ScheduleCampaignRequest(BaseModel):
    name: str
    content: str
    run_at: str  # ISO datetime string
    segment: Optional[Dict[str, Any]] = None
    # Same filter shape as live send (tiers/minPoints/minVisits/postalCodes/minAmountPaid).
    # If provided, takes precedence over segment when the cron drains it.
    filters: Optional[Dict[str, Any]] = None
    source: Optional[str] = None  # push | email | other  — only the channels FidéliTour delivers on today
    recurrence: Optional[str] = None  # None | "daily" | "weekly" | "monthly"


def _filters_to_customer_query(tid: str, filters: dict) -> dict:
    """Translate the UI filter shape to a Mongo query. Shared between live send,
    segment preview, and scheduled campaign drain."""
    q = {"tenant_id": tid}
    if not filters:
        return q
    # Accept snake_case and camelCase from older callers
    tier = filters.get("tier")
    tiers = filters.get("tiers")
    if tiers and isinstance(tiers, list):
        q["tier"] = {"$in": tiers}
    elif tier:
        q["tier"] = tier
    mv = filters.get("min_visits") or filters.get("minVisits")
    if mv:
        q["visits"] = {"$gte": int(mv)}
    mp = filters.get("min_points") or filters.get("minPoints")
    if mp:
        q["points"] = {"$gte": int(mp)}
    pcs = filters.get("postal_codes") or filters.get("postalCodes")
    pc_single = filters.get("postal_code")
    if pcs:
        if isinstance(pcs, str):
            pcs = [p.strip() for p in pcs.split(",") if p.strip()]
        q["postal_code"] = {"$in": list(pcs)}
    elif pc_single:
        q["postal_code"] = pc_single
    ma = filters.get("min_amount_paid") or filters.get("minAmountPaid")
    if ma:
        q["total_amount_paid"] = {"$gte": float(ma)}
    city = filters.get("city")
    if city:
        q["city"] = city
    # Note: we deliberately do NOT honor `has_wallet_pass`/`hasWalletPass` — the
    # platform is wallet-only by design, so that filter is a no-op.
    return q


@app.post("/api/owner/campaigns/schedule")
def schedule_campaign(
    req: ScheduleCampaignRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Queue a campaign to be dispatched later (or on a recurring cadence)."""
    try:
        run_at = datetime.fromisoformat(req.run_at.replace("Z", "+00:00"))
        if run_at.tzinfo is None:
            run_at = run_at.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="run_at must be ISO 8601")
    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": token_data.tenant_id,
        "name": req.name,
        "content": req.content,
        "segment": req.segment or {"type": "all"},
        "filters": req.filters or None,
        "source": (req.source or "push"),
        "run_at": run_at,
        "recurrence": req.recurrence,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc),
    }
    db.scheduled_campaigns.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/owner/campaigns/scheduled")
def list_scheduled(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    rows = list(db.scheduled_campaigns.find({"tenant_id": token_data.tenant_id}).sort("run_at", 1))
    for r in rows:
        r.pop("_id", None)
    return {"scheduled": rows}


@app.delete("/api/owner/campaigns/scheduled/{sched_id}")
def delete_scheduled(sched_id: str, token_data: TokenData = Depends(require_role(["business_owner"]))):
    res = db.scheduled_campaigns.delete_one({"id": sched_id, "tenant_id": token_data.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled campaign not found")
    return {"status": "ok"}


def _resolve_segment(tid: str, segment: dict) -> list:
    """Shared segment → customer-list resolver. Returns list of customer dicts."""
    now = datetime.now(timezone.utc)
    if not segment:
        return list(db.customers.find({"tenant_id": tid}))
    stype = (segment.get("type") or "").lower()
    q = {"tenant_id": tid}
    if stype == "tier" and segment.get("value"):
        q["tier"] = segment["value"]
    elif stype == "inactive_days":
        days = int(segment.get("value") or 30)
        q["last_visit_date"] = {"$lt": now - timedelta(days=days)}
    elif stype == "birthday_month" and segment.get("value"):
        mm = str(segment["value"]).zfill(2)
        q["birthday"] = {"$regex": f"^{mm}"}
    elif stype == "birthday_today":
        today_mmdd = now.strftime("%m-%d")
        q["birthday"] = today_mmdd
    elif stype == "acquisition" and segment.get("value"):
        q["acquisition_source"] = segment["value"]
    elif stype == "postal_code" and segment.get("value"):
        q["postal_code"] = segment["value"]
    elif stype == "department_code" and segment.get("value"):
        q["postal_code"] = {"$regex": f"^{segment['value']}"}
    elif stype == "one_visit_only":
        q["visits"] = {"$lte": 1}
    elif stype == "all":
        pass
    return list(db.customers.find(q))


# --- 1, 8, 3: Daily trigger cron -----------------------------
@app.post("/api/cron/daily-triggers")
def run_daily_triggers(request: Request):
    """Cron endpoint (hit daily by Vercel Cron or manually).
    Authenticated via Authorization: Bearer <CRON_SECRET> OR ?secret=... OR X-Cron-Secret header.
    Does 3 things:
      A. For each tenant, send birthday offer to customers whose MM-DD == today.
      B. For each tenant, send sector-specific reactivation to customers inactive >30d
         (cooldown: don't re-trigger within 14 days).
      C. Drain scheduled_campaigns where run_at <= now and recurrence handling.
    """
    # Auth check (lenient: allow empty secret in dev, require in prod)
    provided = (
        request.headers.get("x-cron-secret")
        or (request.headers.get("authorization", "").replace("Bearer ", "") if request.headers.get("authorization") else "")
        or request.query_params.get("secret", "")
    )
    if CRON_SECRET and provided != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    now = datetime.now(timezone.utc)
    today_mmdd = now.strftime("%m-%d")
    cutoff_inactive = now - timedelta(days=30)
    cooldown_cutoff = now - timedelta(days=14)

    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    birthday_sent = 0
    reactivation_sent = 0
    scheduled_sent = 0
    tier_up_emitted_count = 0

    for tenant in tenants:
        tid = tenant["id"]
        sector = tenant.get("sector") or "restaurant"
        tpl = REACTIVATION_TEMPLATES_BY_SECTOR.get(sector, {
            "title": "On vous a manqué ✨",
            "content": "Revenez cette semaine pour une offre spéciale, {first_name} !"
        })

        # A. Birthday auto-send
        bday_customers = list(db.customers.find({"tenant_id": tid, "birthday": today_mmdd}))
        if bday_customers:
            birthday_body = f"Joyeux anniversaire {{first_name}} 🎂 ! Pour fêter ça, {tenant.get('name') or 'nous'} vous offre une surprise lors de votre prochaine visite."
            _dispatch_campaign_to_customers(
                tenant,
                name="🎂 Joyeux anniversaire {first_name} !",
                content=birthday_body,
                customer_list=bday_customers,
                trigger_type="birthday",
            )
            birthday_sent += len(bday_customers)

        # B. Inactivity reactivation (cooldown-protected)
        inactive_customers = list(db.customers.find({
            "tenant_id": tid,
            "last_visit_date": {"$lt": cutoff_inactive, "$ne": None},
        }))
        # Skip customers we already nudged in last 14 days.
        already_nudged_ids = set()
        recent_pushes = db.push_notifications.find({
            "tenant_id": tid, "type": "reactivation",
            "sent_at": {"$gte": cooldown_cutoff},
        })
        for p in recent_pushes:
            already_nudged_ids.add(p.get("customer_id"))
        fresh_inactive = [c for c in inactive_customers if c["id"] not in already_nudged_ids]
        if fresh_inactive:
            _dispatch_campaign_to_customers(
                tenant,
                name=tpl["title"],
                content=tpl["content"],
                customer_list=fresh_inactive,
                trigger_type="reactivation",
            )
            reactivation_sent += len(fresh_inactive)

    # C. Drain scheduled campaigns
    due = list(db.scheduled_campaigns.find({
        "run_at": {"$lte": now},
        "status": "scheduled",
    }))
    for sc in due:
        tenant = db.tenants.find_one({"id": sc["tenant_id"]})
        if not tenant:
            db.scheduled_campaigns.update_one({"id": sc["id"]}, {"$set": {"status": "cancelled"}})
            continue
        # Prefer UI-style filters if the schedule was saved with them; fall back
        # to the legacy segment-based resolver otherwise.
        if sc.get("filters"):
            q = _filters_to_customer_query(sc["tenant_id"], sc["filters"])
            recipients = list(db.customers.find(q))
        else:
            recipients = _resolve_segment(sc["tenant_id"], sc.get("segment") or {"type": "all"})
        dispatched = _dispatch_campaign_to_customers(
            tenant,
            name=sc["name"],
            content=sc["content"],
            customer_list=recipients,
            trigger_type="scheduled",
        )
        # Stamp the source on the emitted campaign so analytics attribute
        # scheduled sends to their channel (Instagram, email, push, etc.).
        if dispatched and sc.get("source"):
            db.campaigns.update_one(
                {"id": dispatched["id"]},
                {"$set": {"source": sc["source"]}},
            )
        scheduled_sent += len(recipients)

        # Recurrence: bump run_at and keep scheduled, or mark sent.
        rec = sc.get("recurrence")
        if rec == "daily":
            next_run = sc["run_at"] + timedelta(days=1)
            db.scheduled_campaigns.update_one({"id": sc["id"]}, {"$set": {"run_at": next_run}})
        elif rec == "weekly":
            next_run = sc["run_at"] + timedelta(days=7)
            db.scheduled_campaigns.update_one({"id": sc["id"]}, {"$set": {"run_at": next_run}})
        elif rec == "monthly":
            next_run = sc["run_at"] + timedelta(days=30)
            db.scheduled_campaigns.update_one({"id": sc["id"]}, {"$set": {"run_at": next_run}})
        else:
            db.scheduled_campaigns.update_one({"id": sc["id"]}, {"$set": {"status": "sent", "sent_at": now}})

    return {
        "status": "ok",
        "ran_at": now.isoformat(),
        "birthday_sent": birthday_sent,
        "reactivation_sent": reactivation_sent,
        "scheduled_sent": scheduled_sent,
        "tier_up_emitted": tier_up_emitted_count,
    }


# --- 6: Super-admin broadcast to all end-customers -----------
class AdminBroadcastRequest(BaseModel):
    subject: str
    body: str
    sender_name: Optional[str] = None  # name displayed as sender
    filters: Optional[Dict[str, Any]] = None  # {tier, sector, department_code, acquisition, tenant_id}


@app.post("/api/admin/broadcast")
def admin_broadcast(
    req: AdminBroadcastRequest,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Admin-authored broadcast to end-customers across tenants.
    Sends under the admin-chosen sender name.
    """
    if not req.subject.strip() or not req.body.strip():
        raise HTTPException(status_code=400, detail="subject and body required")
    filters = req.filters or {}
    sender_name = (req.sender_name or "FidéliTour").strip()
    now = datetime.now(timezone.utc)

    # Build customer query
    cust_q = {}
    if filters.get("tier"):
        cust_q["tier"] = filters["tier"]
    if filters.get("acquisition"):
        cust_q["acquisition_source"] = filters["acquisition"]
    if filters.get("department_code"):
        cust_q["postal_code"] = {"$regex": f"^{filters['department_code']}"}
    if filters.get("tenant_id"):
        cust_q["tenant_id"] = filters["tenant_id"]

    # If sector filter set, resolve to tenant ids first.
    if filters.get("sector"):
        ts = list(db.tenants.find({"sector": filters["sector"]}, {"id": 1}))
        cust_q["tenant_id"] = {"$in": [t["id"] for t in ts]}

    targets = list(db.customers.find(cust_q))
    delivered = 0
    broadcast_id = str(uuid.uuid4())
    tenant_cache = {}
    for c in targets:
        tid = c.get("tenant_id")
        if tid not in tenant_cache:
            tenant_cache[tid] = db.tenants.find_one({"id": tid}) or {}
        tenant = tenant_cache[tid]
        rendered_subject = render_template(req.subject, c, tenant)
        rendered_body = render_template(req.body, c, tenant)
        db.push_notifications.insert_one({
            "customer_id": c["id"],
            "tenant_id": tid,
            "title": rendered_subject,
            "body": rendered_body,
            "type": "admin_broadcast",
            "broadcast_id": broadcast_id,
            "sender_name": sender_name,
            "sent_at": now,
        })
        if c.get("email"):
            html = _campaign_html(sender_name, rendered_subject, rendered_body, c)
            if send_email_to_customer(c["email"], sender_name, f"{sender_name} - {rendered_subject}", html):
                delivered += 1

    doc = {
        "id": broadcast_id,
        "subject": req.subject,
        "body": req.body,
        "sender_name": sender_name,
        "filters": filters,
        "targeted_count": len(targets),
        "delivered_count": delivered,
        "sent_at": now,
        "sent_by": token_data.email if hasattr(token_data, "email") else None,
    }
    db.admin_broadcasts.insert_one(doc)
    doc.pop("_id", None)
    return doc


class AdminBroadcastPreviewRequest(BaseModel):
    filters: Optional[Dict[str, Any]] = None


@app.post("/api/admin/broadcast/preview")
def admin_broadcast_preview(
    req: AdminBroadcastPreviewRequest,
    token_data: TokenData = Depends(require_role(["super_admin"])),
):
    """Returns the number of end-customers that would match the given broadcast filters,
    without sending anything. Mirrors the filter logic of /api/admin/broadcast."""
    filters = req.filters or {}
    cust_q: Dict[str, Any] = {}
    if filters.get("tier"):
        cust_q["tier"] = filters["tier"]
    if filters.get("acquisition"):
        cust_q["acquisition_source"] = filters["acquisition"]
    if filters.get("department_code"):
        cust_q["postal_code"] = {"$regex": f"^{filters['department_code']}"}
    if filters.get("tenant_id"):
        cust_q["tenant_id"] = filters["tenant_id"]
    if filters.get("sector"):
        ts = list(db.tenants.find({"sector": filters["sector"]}, {"id": 1}))
        cust_q["tenant_id"] = {"$in": [t["id"] for t in ts]}
    count = db.customers.count_documents(cust_q)
    with_email = db.customers.count_documents({**cust_q, "email": {"$exists": True, "$ne": ""}})
    return {"count": count, "with_email": with_email}


@app.get("/api/admin/broadcasts")
def list_admin_broadcasts(token_data: TokenData = Depends(require_role(["super_admin"]))):
    rows = list(db.admin_broadcasts.find().sort("sent_at", -1).limit(100))
    for r in rows:
        r.pop("_id", None)
    return {"broadcasts": rows}


# --- 7: Upgrade-plan request flow ----------------------------
class UpgradeRequest(BaseModel):
    message: Optional[str] = None
    requested_plan: Optional[str] = None


@app.post("/api/owner/request-upgrade")
def request_upgrade(
    req: UpgradeRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Owner signals they want to upgrade their plan (usually when near card cap)."""
    tid = token_data.tenant_id
    tenant = db.tenants.find_one({"id": tid}) or {}
    current_plan = tenant.get("plan", "basic")
    next_plan = {"basic": "gold", "gold": "vip", "vip": "chain", "chain": None}.get(current_plan)
    requested = req.requested_plan or next_plan
    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tid,
        "tenant_name": tenant.get("name"),
        "current_plan": current_plan,
        "requested_plan": requested,
        "message": req.message or "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    }
    db.upgrade_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/admin/upgrade-requests")
def list_upgrade_requests(token_data: TokenData = Depends(require_role(["super_admin"]))):
    rows = list(db.upgrade_requests.find().sort("created_at", -1).limit(200))
    for r in rows:
        r.pop("_id", None)
    return {"requests": rows}


@app.put("/api/admin/upgrade-requests/{req_id}")
def resolve_upgrade_request(
    req_id: str,
    body: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Mark as approved / declined / completed."""
    new_status = body.get("status") or "completed"
    if new_status not in ("approved", "declined", "completed", "pending"):
        raise HTTPException(status_code=400, detail="invalid status")
    res = db.upgrade_requests.update_one(
        {"id": req_id},
        {"$set": {"status": new_status, "resolved_at": datetime.now(timezone.utc)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"status": "ok", "new_status": new_status}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
