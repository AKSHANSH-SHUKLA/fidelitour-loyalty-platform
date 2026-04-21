from datetime import datetime, timezone, timedelta
import uuid
import random
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    UserInDB, UserCreate, Tenant, Customer, Visit, CardTemplate, Campaign, PaymentTransaction, AIQueryRequest,
    PLAN_FEATURES, PLAN_PRICES, TierDesign
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
    client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client.fidelitour_db
else:
    client = pymongo.MongoClient()
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

class LoginRequest(BaseModel):
    email: str
    password: str

def generate_varied_customers(tenant_id: str, count: int = 15) -> List[dict]:
    """Generate customers with varied data for realistic testing"""
    customers = []
    names = ["Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Laurent", "Luc Moreau", "Emma Petit",
             "Thomas Dubois", "Julie Mercier", "Olivier Fontaine", "Isabelle Arnould", "David Rousseau",
             "Claire Leblanc", "Marc Renard", "Francoise Deschamps", "Philippe Marchand",
             "Antoine Leroy", "Camille Faure", "Nicolas Girard", "Léa Bonnet", "Hugo Lefevre",
             "Chloé Moreau", "Maxime Durand", "Inès Fontaine", "Lucas Blanc", "Sarah Meyer",
             "Paul Robert", "Louise Perrin", "Gabriel Noël", "Alice Chevalier", "Raphaël Bertrand",
             "Manon Garnier", "Jules Perez", "Zoé Lambert", "Arthur Henry", "Juliette Rolland",
             "Théo Roche", "Jade Simon", "Nathan Muller", "Rose Nicolas", "Ethan Carpentier"]
    # Spread customers across major French cities (Tours, Paris, Lyon, Marseille, Bordeaux, Lille, Nantes, Toulouse, Nice, Strasbourg)
    postal_codes = [
        "37000", "37100", "37200", "37300",  # Tours (local concentration)
        "37000", "37100", "37200",             # weight Tours heavier
        "75001", "75008", "69001", "13001",    # Paris, Lyon, Marseille
        "33000", "59000", "44000", "31000",    # Bordeaux, Lille, Nantes, Toulouse
        "06000", "67000", "34000",             # Nice, Strasbourg, Montpellier
    ]
    acquisition_sources = ["qr_store", "instagram", "tiktok", "facebook", "website", "friend", "other"]

    now = datetime.now(timezone.utc)
    for i in range(count):
        visits = random.randint(0, 30)
        postal = random.choice(postal_codes)
        source = random.choice(acquisition_sources)
        join_date = now - timedelta(days=random.randint(0, 180))  # 6 months

        # Tier logic
        if visits >= 20:
            tier = "gold"
        elif visits >= 10:
            tier = "silver"
        else:
            tier = "bronze"

        # Some have passes issued
        pass_issued = random.choice([True, False]) if visits >= 5 else False

        # Last visit date if they have visits
        last_visit = None
        if visits > 0:
            last_visit = now - timedelta(days=random.randint(0, 30))

        customer = Customer(
            id=f"c-{i}",
            tenant_id=tenant_id,
            barcode_id=f"FT-{uuid.uuid4().hex[:8].upper()}",
            name=names[i % len(names)],
            email=f"customer{i}@mail.com",
            phone=f"06{random.randint(10000000, 99999999)}",
            postal_code=postal,
            birthday=f"{random.randint(1,12):02d}-{random.randint(1,28):02d}",
            points=visits * 10,
            visits=visits,
            total_amount_paid=visits * random.uniform(5, 25),
            tier=tier,
            pass_issued=pass_issued,
            last_visit_date=last_visit,
            acquisition_source=source,
            created_at=join_date
        )
        customers.append(customer.model_dump())

    return customers

def generate_visits(tenant_id: str, customer_ids: List[str], days_back: int = 90) -> List[dict]:
    """Generate varied visit history over last N days"""
    visits = []
    now = datetime.now(timezone.utc)

    for customer_id in customer_ids:
        num_visits = random.randint(0, 20)
        for _ in range(num_visits):
            visit_day = now - timedelta(days=random.randint(0, days_back))
            visit_time = visit_day.replace(hour=random.randint(7, 19), minute=random.randint(0, 59))

            visit = Visit(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                customer_id=customer_id,
                points_awarded=random.randint(1, 3),
                amount_paid=random.uniform(3, 20),
                visit_time=visit_time,
                created_at=visit_time
            )
            visits.append(visit.model_dump())

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

    # Check and seed customers (25+ customers for Café Lumière)
    if db.customers.count_documents({"tenant_id": "tenant-1"}) < 25:
        # Remove existing and reseed for richness
        db.customers.delete_many({"tenant_id": "tenant-1"})
        customers_data = generate_varied_customers("tenant-1", 25)
        db.customers.insert_many(customers_data)

        # Get customer IDs for visit generation
        customer_ids = [c["id"] for c in customers_data]

        # Seed visits with varied timestamps over 90 days
        db.visits.delete_many({"tenant_id": "tenant-1"})
        visits_data = generate_visits("tenant-1", customer_ids, 90)
        if visits_data:
            db.visits.insert_many(visits_data)

    # Check and seed campaigns (at least 3 with proper dates)
    if db.campaigns.count_documents({"tenant_id": "tenant-1"}) < 3:
        db.campaigns.delete_many({"tenant_id": "tenant-1"})

        now = datetime.now(timezone.utc)
        campaign1 = Campaign(
            id="camp-1",
            tenant_id="tenant-1",
            name="Spring Promotion",
            status="sent",
            content="Get 20% off on all pastries this spring!",
            filters={"tier": "gold", "min_visits": 5},
            sent_at=now - timedelta(days=7),
            delivered_count=8,
            targeted_count=10,
            opens=5,
            opens_unique=5,
            visits_from_campaign=3,
            recipient_ids=["c-0", "c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"]
        )
        db.campaigns.insert_one(campaign1.model_dump())

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
            recipient_ids=["c-3", "c-6", "c-9", "c-12", "c-14"]
        )
        db.campaigns.insert_one(campaign2.model_dump())

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
            recipient_ids=["c-0", "c-2", "c-4", "c-6", "c-8", "c-10", "c-11", "c-12", "c-13", "c-14"]
        )
        db.campaigns.insert_one(campaign3.model_dump())

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

    # === Boulangerie Saint-Michel (tenant-2, Basic plan) ===
    # Check and seed tenant
    if not db.tenants.find_one({"slug": "boulangerie-saint-michel"}):
        t2 = Tenant(
            slug="boulangerie-saint-michel",
            name="Boulangerie Saint-Michel",
            plan="basic",
            id="tenant-2",
            address="456 Rue Saint-Michel, 75005 Paris",
            phone="01-98-76-54-32"
        )
        db.tenants.insert_one(t2.model_dump())

    # Check and seed owner user
    if not db.users.find_one({"email": "owner@boulangerie-sm.fr"}):
        u2 = UserInDB(
            email="owner@boulangerie-sm.fr",
            role="business_owner",
            tenant_id="tenant-2",
            hashed_password=hash_password("Boulang!2026")
        )
        db.users.insert_one(u2.model_dump())

    # Check and seed customers (10+ customers for Boulangerie)
    if db.customers.count_documents({"tenant_id": "tenant-2"}) < 10:
        db.customers.delete_many({"tenant_id": "tenant-2"})
        customers_data = generate_varied_customers("tenant-2", 10)
        db.customers.insert_many(customers_data)

        # Get customer IDs for visit generation
        customer_ids = [c["id"] for c in customers_data]

        # Seed visits
        db.visits.delete_many({"tenant_id": "tenant-2"})
        visits_data = generate_visits("tenant-2", customer_ids, 90)
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
    ACQUISITION_SOURCES = ["qr_store", "instagram", "tiktok", "facebook", "website", "friend", "other"]
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
                weights=[4, 3, 2, 2, 2, 2, 1],  # QR + Instagram most common
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

    result = []
    for t in tenants:
        t.pop("_id", None)
        # Count customers for this tenant
        customer_count = db.customers.count_documents({"tenant_id": t["id"]})
        t["customer_count"] = customer_count
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

    # Acquisition-source breakdown
    acq_pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {"_id": "$acquisition_source", "count": {"$sum": 1}}}
    ]
    acq_breakdown = {(r["_id"] or "unknown"): r["count"] for r in db.customers.aggregate(acq_pipeline)}

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
    """Save card template for a tenant (admin only)"""
    req.tenant_id = tenant_id
    db.card_templates.update_one({"tenant_id": tenant_id}, {"$set": req.model_dump()}, upsert=True)
    return req.model_dump()

@app.put("/api/admin/tenants/{tenant_id}/geo")
def update_geo_settings(
    tenant_id: str,
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Update geo settings for a tenant"""
    update_data = {}
    if "geo_enabled" in req:
        update_data["geo_enabled"] = req["geo_enabled"]
    if "geo_radius_meters" in req:
        update_data["geo_radius_meters"] = req["geo_radius_meters"]
    if "geo_cooldown_days" in req:
        update_data["geo_cooldown_days"] = req["geo_cooldown_days"]

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

    # Active tenants in last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    active_tenants_30d = db.visits.distinct(
        "tenant_id",
        {"created_at": {"$gte": thirty_days_ago}}
    )
    active_count = len(active_tenants_30d) if active_tenants_30d else 0

    return {
        "total_tenants": tenant_count,
        "total_customers": customer_count,
        "total_visits": visit_count,
        "monthly_revenue": monthly_revenue,
        "active_tenants_30d": active_count
    }

@app.get("/api/admin/detailed-analytics")
def get_admin_detailed_analytics(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Enhanced admin analytics — platform-wide aggregates across ALL tenants."""
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))
    all_customers = list(db.customers.find({}))
    all_visits_count = db.visits.count_documents({})

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
    acq_counts = {}
    for c in all_customers:
        src = c.get("acquisition_source") or "other"
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

    # --- Top & bottom performers ---
    perf = []
    for t in tenants:
        tid = t["id"]
        t_customers = [c for c in all_customers if c.get("tenant_id") == tid]
        cust_count = len(t_customers)
        total_visits = db.visits.count_documents({"tenant_id": tid})
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
    token_data: TokenData = Depends(require_role(["business_owner"])),
    tier: Optional[str] = Query(None),
    min_visits: Optional[int] = Query(None),
    max_visits: Optional[int] = Query(None),
    min_amount: Optional[float] = Query(None),
    postal_code: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """List customers with advanced filtering"""
    query = {"tenant_id": token_data.tenant_id}

    if tier:
        query["tier"] = tier
    if min_visits is not None:
        query["visits"] = query.get("visits", {})
        query["visits"]["$gte"] = min_visits
    if max_visits is not None:
        query["visits"] = query.get("visits", {})
        query["visits"]["$lte"] = max_visits
    if min_amount is not None:
        query["total_amount_paid"] = {"$gte": min_amount}
    if postal_code:
        query["postal_code"] = postal_code
    if source:
        query["acquisition_source"] = source

    customers = list(db.customers.find(query))

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
    campaign = Campaign(
        id=str(uuid.uuid4()),
        tenant_id=token_data.tenant_id,
        name=req.get("name", "New Campaign"),
        content=req.get("content", ""),
        filters=req.get("filters", {}),
        status=req.get("status", "draft")
    )
    db.campaigns.insert_one(campaign.model_dump())
    return campaign.model_dump()

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
    if filters.get("has_wallet_pass"):
        query["pass_issued"] = True
    if filters.get("min_amount_paid"):
        query["total_amount_paid"] = {"$gte": filters["min_amount_paid"]}

    targeted_count = db.customers.count_documents(query)

    # Update campaign
    campaign.status = "sent"
    campaign.sent_at = datetime.now(timezone.utc)
    campaign.targeted_count = targeted_count
    # Send real emails via SendGrid if configured
    delivered = 0
    if SENDGRID_API_KEY:
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Email, To, Content
            sg = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)

            # Get targeted customers
            targeted_customers = list(db.customers.find(query))

            tenant = db.tenants.find_one({"id": token_data.tenant_id})
            tenant_name = tenant.get("name", "Your Business") if tenant else "Your Business"
            campaign_content = campaign.content or campaign.name

            for cust in targeted_customers:
                if cust.get("email"):
                    try:
                        message = Mail(
                            from_email=Email(SENDGRID_FROM_EMAIL, tenant_name),
                            to_emails=To(cust["email"]),
                            subject=f"{tenant_name} - {campaign.name}",
                            html_content=f"""
                            <div style="font-family: 'Manrope', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #FDFBF7;">
                                <div style="text-align: center; margin-bottom: 30px;">
                                    <h1 style="font-family: 'Georgia', serif; color: #1C1917; font-size: 28px; margin-bottom: 5px;">{tenant_name}</h1>
                                    <div style="width: 50px; height: 3px; background: #B85C38; margin: 0 auto;"></div>
                                </div>
                                <div style="background: white; border-radius: 12px; padding: 30px; border: 1px solid #E7E5E4;">
                                    <h2 style="color: #B85C38; font-size: 22px; margin-bottom: 15px;">{campaign.name}</h2>
                                    <p style="color: #57534E; line-height: 1.6; font-size: 16px;">Dear {cust.get('name', 'Valued Customer')},</p>
                                    <p style="color: #57534E; line-height: 1.6; font-size: 16px;">{campaign_content}</p>
                                    <div style="margin-top: 25px; padding: 15px; background: #F3EFE7; border-radius: 8px; text-align: center;">
                                        <p style="color: #B85C38; font-weight: 600; font-size: 14px;">Your Loyalty Status: {cust.get('tier', 'Bronze').title()} Tier</p>
                                        <p style="color: #57534E; font-size: 13px;">Points: {cust.get('points', cust.get('visits', 0) * 10)} | Visits: {cust.get('visits', 0)}</p>
                                    </div>
                                </div>
                                <p style="text-align: center; color: #A8A29E; font-size: 12px; margin-top: 25px;">Powered by FidéliTour Loyalty Platform</p>
                            </div>
                            """
                        )
                        sg.send(message)
                        delivered += 1
                    except Exception as email_err:
                        print(f"Email send error for {cust.get('email')}: {email_err}")
        except ImportError:
            delivered = targeted_count  # No sendgrid library, assume mock delivery
        except Exception as sg_err:
            print(f"SendGrid error: {sg_err}")
            delivered = targeted_count
    else:
        delivered = targeted_count  # No API key, mock delivery

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
    if filters.get("has_wallet_pass"):
        query["pass_issued"] = True
    if filters.get("min_amount_paid"):
        query["total_amount_paid"] = {"$gte": filters["min_amount_paid"]}

    count = db.customers.count_documents(query)
    return {"matching_customers": count}

class ScanRequest(BaseModel):
    barcode_id: str
    points: Optional[int] = None
    amount_paid: float = 0.0

@app.post("/api/owner/scan")
def scan_visit(
    req: ScanRequest,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Scan visit - record timestamp and update customer"""
    cust = db.customers.find_one({"tenant_id": token_data.tenant_id, "barcode_id": req.barcode_id})
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    c_obj = Customer(**cust)

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

    # Update tier
    if c_obj.visits >= 20:
        c_obj.tier = "gold"
    elif c_obj.visits >= 10:
        c_obj.tier = "silver"
    else:
        c_obj.tier = "bronze"

    db.customers.update_one({"id": c_obj.id}, {"$set": c_obj.model_dump()})

    # Record visit with timestamp
    visit_time = datetime.now(timezone.utc)
    v = Visit(
        id=str(uuid.uuid4()),
        tenant_id=token_data.tenant_id,
        customer_id=c_obj.id,
        points_awarded=points_to_add,
        amount_paid=req.amount_paid,
        visit_time=visit_time
    )
    db.visits.insert_one(v.model_dump())

    # Check for reward notifications
    card_template = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
    if card_template:
        visits_per_stamp = card_template.get("visits_per_stamp", 1)
        reward_threshold_stamps = card_template.get("reward_threshold_stamps", 10)
        notify_before_reward = card_template.get("notify_before_reward", 1)

        stamps_earned = c_obj.visits // visits_per_stamp
        stamps_for_reward = reward_threshold_stamps

        # Check if just hit reward threshold
        if stamps_earned == stamps_for_reward:
            notification = {
                "customer_id": c_obj.id,
                "tenant_id": token_data.tenant_id,
                "title": "Reward Unlocked!",
                "body": f"You've earned your reward: {card_template.get('reward_description', 'Reward')}",
                "type": "reward_unlocked",
                "sent_at": datetime.now(timezone.utc)
            }
            db.push_notifications.insert_one(notification)
        # Check if near reward threshold
        elif stamps_earned >= (stamps_for_reward - notify_before_reward) and stamps_earned < stamps_for_reward:
            stamps_remaining = stamps_for_reward - stamps_earned
            notification = {
                "customer_id": c_obj.id,
                "tenant_id": token_data.tenant_id,
                "title": "Almost there!",
                "body": f"You're {stamps_remaining} {'stamp' if stamps_remaining == 1 else 'stamps'} away from your reward!",
                "type": "near_reward",
                "sent_at": datetime.now(timezone.utc)
            }
            db.push_notifications.insert_one(notification)

    return c_obj.model_dump()

@app.get("/api/owner/card-template")
def get_card_template(token_data: TokenData = Depends(require_role(["business_owner"]))):
    t = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
    if t:
        t.pop("_id", None)
        return t
    return CardTemplate(tenant_id=token_data.tenant_id).model_dump()

@app.post("/api/owner/card-template")
def save_card_template(req: CardTemplate, token_data: TokenData = Depends(require_role(["business_owner"]))):
    req.tenant_id = token_data.tenant_id
    db.card_templates.update_one({"tenant_id": token_data.tenant_id}, {"$set": req.model_dump()}, upsert=True)
    return req.model_dump()

@app.get("/api/owner/analytics")
def owner_analytics(
    token_data: TokenData = Depends(require_role(["business_owner"])),
    branch_id: Optional[str] = Query(None)
):
    """Comprehensive owner analytics"""
    t_id = token_data.tenant_id
    # Note: branch_id parameter is available for future filtering if needed

    # Basic counts
    total_customers = db.customers.count_documents({"tenant_id": t_id})
    total_visits = db.visits.count_documents({"tenant_id": t_id})
    wallet_passes_issued = db.customers.count_documents({"tenant_id": t_id, "pass_issued": True})

    # Repeat rate calculation
    customers = list(db.customers.find({"tenant_id": t_id}))
    repeat_customers = sum(1 for c in customers if c.get("visits", 0) > 1)
    repeat_rate = (repeat_customers / total_customers * 100) if total_customers > 0 else 0

    # Visits by day (last 90 days)
    visits_by_day = {}
    now = datetime.now(timezone.utc)
    for i in range(90):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.visits.count_documents({
            "tenant_id": t_id,
            "visit_time": {"$gte": day_start, "$lt": day_end}
        })
        visits_by_day[day_start.strftime("%Y-%m-%d")] = count

    # New customers by week (last 12 weeks)
    new_customers_by_week = {}
    for i in range(12):
        week_start = now - timedelta(weeks=i+1)
        week_end = week_start + timedelta(weeks=1)
        count = db.customers.count_documents({
            "tenant_id": t_id,
            "created_at": {"$gte": week_start, "$lt": week_end}
        })
        new_customers_by_week[f"Week {i+1}"] = count

    # Tier distribution
    tier_distribution = {}
    for tier in ["bronze", "silver", "gold"]:
        count = db.customers.count_documents({"tenant_id": t_id, "tier": tier})
        tier_distribution[tier] = count

    # Campaign performance
    campaigns = list(db.campaigns.find({"tenant_id": t_id, "status": "sent"}))
    campaign_performance = []
    for camp in campaigns:
        visit_count = db.visits.count_documents({
            "tenant_id": t_id,
            "created_at": {"$gte": camp.get("sent_at", datetime.now(timezone.utc))}
        })
        campaign_performance.append({
            "name": camp.get("name", ""),
            "visits_after_send": visit_count,
            "delivered_count": camp.get("delivered_count", 0)
        })

    # Visit time heatmap (day x hour matrix)
    visit_heatmap = {}
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = list(range(7, 20))  # 7am to 7pm
    for day in days:
        visit_heatmap[day] = {str(hour): 0 for hour in hours}

    visits_list = list(db.visits.find({"tenant_id": t_id}))
    for visit in visits_list:
        if visit.get("visit_time"):
            visit_time = visit["visit_time"]
            day_name = days[visit_time.weekday()]
            hour = visit_time.hour
            if 7 <= hour < 20:
                visit_heatmap[day_name][str(hour)] += 1

    return {
        "total_customers": total_customers,
        "total_visits": total_visits,
        "repeat_rate": f"{repeat_rate:.1f}%",
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
def get_customers_map(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """Get customers with approximated lat/lng + department for France-wide map display."""
    customers = list(db.customers.find({"tenant_id": token_data.tenant_id}))
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
            "postal_code": postal_code,
            "lat": lat,
            "lng": lng,
            "department_code": dept_code,
            "department_name": dept_name,
            "tier": cust.get("tier", "bronze"),
            "total_visits": cust.get("visits", 0),
            "total_amount_paid": cust.get("total_amount_paid", 0),
            "acquisition_source": cust.get("acquisition_source"),
            "has_real_gps": real_lat is not None and real_lng is not None,
        })

    return result

@app.post("/api/owner/campaigns/send-to-group")
def send_campaign_to_group(
    req: Dict[str, Any],
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Create and send campaign to specific group of customers"""
    customer_ids = req.get("customer_ids", [])
    if not customer_ids:
        raise HTTPException(status_code=400, detail="customer_ids required")

    campaign = Campaign(
        id=str(uuid.uuid4()),
        tenant_id=token_data.tenant_id,
        name=req.get("name", "Group Campaign"),
        content=req.get("content", ""),
        status="sent",
        filters={"custom": "group_send"},
        sent_at=datetime.now(timezone.utc),
        targeted_count=len(customer_ids),
        delivered_count=len(customer_ids),
        recipient_ids=customer_ids
    )

    db.campaigns.insert_one(campaign.model_dump())
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

    # Calculate metrics
    delivered = campaign.get("delivered_count", 0)
    opens = campaign.get("opens", 0)
    opens_unique = campaign.get("opens_unique", 0)
    visits_from_campaign = campaign.get("visits_from_campaign", 0)

    open_rate_pct = (opens_unique / delivered * 100) if delivered > 0 else 0
    visits_rate_pct = (visits_from_campaign / delivered * 100) if delivered > 0 else 0

    # Get recipient details
    recipient_ids = campaign.get("recipient_ids", [])
    recipients = []
    for cid in recipient_ids:
        customer = db.customers.find_one({"id": cid})
        if customer:
            # Check if customer opened this campaign
            opened = bool(db.campaign_opens.find_one({"campaign_id": campaign_id, "customer_id": cid}))
            recipients.append({
                "customer_id": cid,
                "name": customer.get("name", ""),
                "opened": opened,
                "visited_after": opened  # simplified
            })

    return {
        "campaign_id": campaign_id,
        "name": campaign.get("name", ""),
        "sent_at": campaign.get("sent_at"),
        "targeted_count": campaign.get("targeted_count", 0),
        "delivered_count": delivered,
        "opens_unique": opens_unique,
        "open_rate_pct": round(open_rate_pct, 1),
        "visits_from_campaign": visits_from_campaign,
        "visits_rate_pct": round(visits_rate_pct, 1),
        "recipients": recipients
    }

@app.get("/api/owner/campaigns/{campaign_id}/track-open/{customer_id}")
def track_campaign_open(
    campaign_id: str,
    customer_id: str,
    token_data: TokenData = Depends(require_role(["business_owner"]))
):
    """Pixel tracking endpoint - logs open and returns 1x1 PNG"""
    # Verify campaign belongs to tenant
    campaign = db.campaigns.find_one({"id": campaign_id, "tenant_id": token_data.tenant_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Log the open
    open_record = {
        "campaign_id": campaign_id,
        "customer_id": customer_id,
        "opened_at": datetime.now(timezone.utc)
    }
    db.campaign_opens.insert_one(open_record)

    # Update campaign opens count
    db.campaigns.update_one(
        {"id": campaign_id},
        {
            "$inc": {
                "opens": 1,
                "opens_unique": 1
            }
        }
    )

    # Return 1x1 PNG
    return Response(content=PIXEL_PNG_BYTES, media_type="image/png")

@app.get("/api/owner/analytics/highest-paying")
def get_highest_paying_customers(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """Return ALL tenant customers so the dashboard can sort by max/min spent/visits client-side."""
    customers = list(
        db.customers.find({"tenant_id": token_data.tenant_id})
        .sort("total_amount_paid", -1)
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
def get_cards_filled_analytics(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """Get card fill completion metrics"""
    # Get card template settings
    card_template = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
    if not card_template:
        reward_threshold = 10
        visits_per_stamp = 1
    else:
        reward_threshold = card_template.get("reward_threshold_stamps", 10)
        visits_per_stamp = card_template.get("visits_per_stamp", 1)

    visits_needed = reward_threshold * visits_per_stamp

    # Count customers by filled cards
    customers = list(db.customers.find({"tenant_id": token_data.tenant_id}))

    total_cards_filled = 0
    cards_filled_this_month = 0
    cards_filled_last_month = 0
    tier_filled = {"bronze": 0, "silver": 0, "gold": 0}

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)
    last_month_end = month_start

    for cust in customers:
        visits = cust.get("visits", 0)
        cards_filled = visits // visits_needed

        if cards_filled > 0:
            total_cards_filled += cards_filled
            tier = cust.get("tier", "bronze")
            if tier in tier_filled:
                tier_filled[tier] += cards_filled

            # Check when visits happened
            customer_visits = list(db.visits.find({"customer_id": cust["id"]}))
            for v in customer_visits:
                visit_date = v.get("visit_time", v.get("created_at", now))
                if visit_date >= month_start:
                    cards_filled_this_month += 1
                elif last_month_start <= visit_date < last_month_end:
                    cards_filled_last_month += 1

    return {
        "total_cards_filled": total_cards_filled,
        "cards_filled_this_month": cards_filled_this_month,
        "cards_filled_last_month": cards_filled_last_month,
        "by_tier": tier_filled
    }

@app.get("/api/owner/analytics/recovered")
def get_recovered_customers(
    token_data: TokenData = Depends(require_role(["business_owner"])),
    inactive_days: int = Query(30),
    window_days: int = Query(30)
):
    """Get customers who were inactive but returned"""
    now = datetime.now(timezone.utc)
    inactive_threshold = now - timedelta(days=inactive_days)
    recovery_window_start = now - timedelta(days=window_days)

    customers = list(db.customers.find({"tenant_id": token_data.tenant_id}))
    recovered = []

    for cust in customers:
        last_visit = cust.get("last_visit_date")
        if not last_visit:
            continue

        # Was inactive > inactive_days ago
        if last_visit < inactive_threshold:
            # Check if they visited again within window
            recent_visits = list(db.visits.find({
                "customer_id": cust["id"],
                "visit_time": {"$gte": recovery_window_start}
            }))

            if recent_visits:
                recovered.append({
                    "id": cust["id"],
                    "name": cust.get("name", ""),
                    "email": cust.get("email", ""),
                    "last_inactive_date": last_visit,
                    "returned_date": recent_visits[-1].get("visit_time"),
                    "tier": cust.get("tier", "bronze")
                })

    recovery_pct = (len(recovered) / len(customers) * 100) if customers else 0

    return {
        "count": len(recovered),
        "percentage": round(recovery_pct, 1),
        "customers": recovered,
        "recovered_this_period": len(recovered)
    }

@app.get("/api/owner/analytics/acquisition-sources")
def get_acquisition_sources(
    token_data: TokenData = Depends(require_role(["business_owner"])),
    days: int = Query(90)
):
    """Get breakdown of customer acquisition sources"""
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=days)

    # Get customers in period with acquisition_source
    customers = list(db.customers.find({
        "tenant_id": token_data.tenant_id,
        "created_at": {"$gte": period_start}
    }))

    sources_count = {}
    for cust in customers:
        source = cust.get("acquisition_source", "unknown")
        sources_count[source] = sources_count.get(source, 0) + 1

    total = len(customers)
    sources = []
    for source, count in sorted(sources_count.items(), key=lambda x: x[1], reverse=True):
        sources.append({
            "source": source,
            "count": count,
            "percentage": round((count / total * 100), 1) if total > 0 else 0
        })

    return {
        "sources": sources,
        "total": total,
        "period_days": days
    }

@app.get("/api/owner/analytics/summary")
def get_analytics_summary(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """Quick summary stats for dashboard"""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    ninety_days_ago = now - timedelta(days=90)

    # Highest paying
    highest_paying = list(
        db.customers.find({"tenant_id": token_data.tenant_id})
        .sort("total_amount_paid", -1)
        .limit(5)
    )
    highest_paying_list = [
        {"name": c.get("name", ""), "amount": c.get("total_amount_paid", 0)}
        for c in highest_paying
    ]

    # Cards filled
    card_template = db.card_templates.find_one({"tenant_id": token_data.tenant_id})
    reward_threshold = card_template.get("reward_threshold_stamps", 10) if card_template else 10
    visits_per_stamp = card_template.get("visits_per_stamp", 1) if card_template else 1
    visits_needed = reward_threshold * visits_per_stamp

    customers = list(db.customers.find({"tenant_id": token_data.tenant_id}))
    total_cards_filled = sum(c.get("visits", 0) // visits_needed for c in customers)

    # Recovered
    inactive_threshold = now - timedelta(days=30)
    recovered_count = 0
    for cust in customers:
        last_visit = cust.get("last_visit_date")
        if last_visit and last_visit < inactive_threshold:
            recent = db.visits.find_one({
                "customer_id": cust["id"],
                "visit_time": {"$gte": ninety_days_ago}
            })
            if recent:
                recovered_count += 1

    recovered_pct = (recovered_count / len(customers) * 100) if customers else 0

    # Acquisition sources (last 90 days)
    recent_customers = list(db.customers.find({
        "tenant_id": token_data.tenant_id,
        "created_at": {"$gte": ninety_days_ago}
    }))
    sources_count = {}
    for c in recent_customers:
        source = c.get("acquisition_source", "unknown")
        sources_count[source] = sources_count.get(source, 0) + 1

    source_breakdown = [
        {"source": k, "count": v}
        for k, v in sorted(sources_count.items(), key=lambda x: x[1], reverse=True)
    ]

    # Active customers
    thirty_days_ago = now - timedelta(days=30)
    active_customers = db.customers.count_documents({
        "tenant_id": token_data.tenant_id,
        "last_visit_date": {"$gte": thirty_days_ago}
    })

    # New this week
    new_this_week = db.customers.count_documents({
        "tenant_id": token_data.tenant_id,
        "created_at": {"$gte": week_ago}
    })

    return {
        "highest_paying": highest_paying_list,
        "total_cards_filled": total_cards_filled,
        "recovered_count": recovered_count,
        "recovered_pct": round(recovered_pct, 1),
        "source_breakdown": source_breakdown,
        "active_customers": active_customers,
        "new_this_week": new_this_week
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
def list_branches(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """List branches for current tenant"""
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

# ========================
# ENHANCED ADMIN ENDPOINTS
# ========================

@app.get("/api/admin/enhanced-analytics")
def get_admin_enhanced_analytics(token_data: TokenData = Depends(require_role(["super_admin"]))):
    """Enhanced admin analytics with business health"""
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))

    now = datetime.now(timezone.utc)
    fourteen_days_ago = now - timedelta(days=14)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    business_health = {"regular": [], "growing": [], "declining": []}
    top_performers = []
    businesses_at_risk = []

    for t in tenants:
        tid = t["id"]
        customer_count = db.customers.count_documents({"tenant_id": tid})
        total_visits = db.visits.count_documents({"tenant_id": tid})
        recent_visits = db.visits.count_documents({"tenant_id": tid, "created_at": {"$gte": fourteen_days_ago}})
        last_month_visits = db.visits.count_documents({"tenant_id": tid, "created_at": {"$gte": thirty_days_ago, "$lt": fourteen_days_ago}})
        new_customers_recent = db.customers.count_documents({"tenant_id": tid, "created_at": {"$gte": thirty_days_ago}})

        # Calculate avg points
        customers = list(db.customers.find({"tenant_id": tid}))
        avg_points = sum(c.get("points", c.get("visits", 0) * 10) for c in customers) / max(len(customers), 1)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
