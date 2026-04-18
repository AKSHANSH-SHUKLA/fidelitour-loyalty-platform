from datetime import datetime, timezone, timedelta
import uuid
import random
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Request, Response, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    UserInDB, UserCreate, Tenant, Customer, Visit, CardTemplate, Campaign, PaymentTransaction, AIQueryRequest,
    PLAN_FEATURES, PLAN_PRICES
)
from auth import (
    hash_password, verify_password, create_access_token, get_current_user_data,
    require_role, check_plan_feature, TokenData, ACCESS_TOKEN_EXPIRE_MINUTES
)

import os
import pymongo

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

class LoginRequest(BaseModel):
    email: str
    password: str

def generate_varied_customers(tenant_id: str, count: int = 15) -> List[dict]:
    """Generate customers with varied data for realistic testing"""
    customers = []
    names = ["Jean Dupont", "Marie Martin", "Pierre Bernard", "Sophie Laurent", "Luc Moreau", "Emma Petit",
             "Thomas Dubois", "Julie Mercier", "Olivier Fontaine", "Isabelle Arnould", "David Rousseau",
             "Claire Leblanc", "Marc Renard", "Francoise Deschamps", "Philippe Marchand"]
    postal_codes = [f"7500{i}" for i in range(1, 11)] + [f"7501{i}" for i in range(0, 5)]

    now = datetime.now(timezone.utc)
    for i in range(count):
        visits = random.randint(0, 30)
        postal = random.choice(postal_codes)
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
            name=names[i],
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
            address="123 Rue de Paris, 75001 Paris",
            phone="01-23-45-67-89",
            website="cafe-lumiere.fr",
            id="tenant-1",
            geo_enabled=True,
            geo_radius_meters=500,
            geo_cooldown_days=1
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
            targeted_count=10
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
            targeted_count=6
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
            targeted_count=15
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
            primary_color="#8B4513",
            secondary_color="#D2B48C",
            text_content="Café Lumière - Your Loyalty Card",
            logo_url="https://example.com/cafe-logo.png",
            design_mode="modern",
            font_family="Playfair Display",
            show_points=True,
            customer_name_visible=True,
            customer_birthday_visible=False
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

    # === Test user: akshanshshukla963@gmail.com ===
    # Check and seed test admin
    if not db.users.find_one({"email": "akshanshshukla963@gmail.com"}):
        test_admin = UserInDB(
            email="akshanshshukla963@gmail.com",
            role="super_admin",
            hashed_password=hash_password("AkshFT!2026")
        )
        db.users.insert_one(test_admin.model_dump())

    # Also add as customer for Café Lumière
    if not db.customers.find_one({"email": "akshanshshukla963@gmail.com", "tenant_id": "tenant-1"}):
        test_customer = Customer(
            id=str(uuid.uuid4()),
            tenant_id="tenant-1",
            barcode_id="FT-" + str(uuid.uuid4().hex[:8]).upper(),
            name="Akshansh Shukla",
            email="akshanshshukla963@gmail.com",
            phone="+91-9999999999",
            postal_code="75001",
            birthday="1998-01-15",
            tier="gold",
            visits=12,
            total_amount_paid=245.50,
            points=1200,
            pass_issued=True
        )
        db.customers.insert_one(test_customer.model_dump())

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
    """Enhanced admin analytics"""
    # Plans distribution from actual DB
    tenants = list(db.tenants.find({"is_active": {"$ne": False}}))

    plan_counts = {"basic": 0, "gold": 0, "vip": 0}
    for t in tenants:
        plan = t.get("plan", "basic")
        if plan in plan_counts:
            plan_counts[plan] += 1

    plans_distribution = [
        {"name": "Basic", "value": plan_counts["basic"]},
        {"name": "Gold", "value": plan_counts["gold"]},
        {"name": "VIP", "value": plan_counts["vip"]}
    ]

    # Growth data (mock month-based)
    growth = [
        {"month": "Jan", "tenants": 10},
        {"month": "Feb", "tenants": 20},
        {"month": "Mar", "tenants": 40},
        {"month": "Apr", "tenants": len(tenants)}
    ]

    # Tenant performance: top tenants by visits
    tenant_performance = []
    for t in tenants[:5]:
        visit_count = db.visits.count_documents({"tenant_id": t["id"]})
        customer_count = db.customers.count_documents({"tenant_id": t["id"]})
        tenant_performance.append({
            "name": t["name"],
            "customers": customer_count,
            "visits": visit_count,
            "plan": t.get("plan", "basic")
        })

    return {
        "plans_distribution": plans_distribution,
        "growth": growth,
        "tenant_performance": tenant_performance
    }

@app.get("/api/admin/tenants-by-plan/{plan}")
def get_tenants_by_plan(
    plan: str,
    token_data: TokenData = Depends(require_role(["super_admin"]))
):
    """Get list of tenants for a specific plan tier"""
    if plan not in ["basic", "gold", "vip"]:
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
    points: int = 1
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
    c_obj.points += req.points
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
        points_awarded=req.points,
        amount_paid=req.amount_paid,
        visit_time=visit_time
    )
    db.visits.insert_one(v.model_dump())

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
def owner_analytics(token_data: TokenData = Depends(require_role(["business_owner"]))):
    """Comprehensive owner analytics"""
    t_id = token_data.tenant_id

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

@app.post("/api/join/{slug}")
def join_program(slug: str, req: JoinRequest):
    t = db.tenants.find_one({"slug": slug})
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tid = t["id"]
    existing = db.customers.find_one({"tenant_id": tid, "email": req.email})
    if existing:
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
        birthday=req.birthday
    )
    db.customers.insert_one(c.model_dump())
    return {"barcode_id": barcode_id, "message": "Welcome!"}

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
