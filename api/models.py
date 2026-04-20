from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from uuid import uuid4

PLAN_FEATURES = {
    "basic": {
        "max_customers": 500,
        "campaigns_per_month": 2,
        "ai_queries_per_day": 0,
        "csv_export": False,
        "geo_proximity": False,
        "multi_branch": False,
    },
    "gold": {
        "max_customers": 2000,
        "campaigns_per_month": 10,
        "ai_queries_per_day": 20,
        "csv_export": True,
        "geo_proximity": True,
        "multi_branch": False,
    },
    "vip": {
        "max_customers": 10000,
        "campaigns_per_month": 100,
        "ai_queries_per_day": 35,
        "csv_export": True,
        "geo_proximity": True,
        "multi_branch": False,
    },
    "chain": {
        "max_customers": 50000,
        "campaigns_per_month": 300,
        "ai_queries_per_day": 50,
        "csv_export": True,
        "geo_proximity": True,
        "multi_branch": True,
    }
}

PLAN_PRICES = {
    "basic": 29,
    "gold": 79,
    "vip": 199,
    "chain": 349
}

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    tenant_id: Optional[str] = None

class UserBase(BaseModel):
    email: str
    role: str
    tenant_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TenantBase(BaseModel):
    slug: str
    name: str
    plan: str
    address: Optional[str] = ""
    phone: Optional[str] = ""
    website: Optional[str] = ""
    geo_radius_meters: Optional[int] = None
    geo_cooldown_days: Optional[int] = 1
    geo_enabled: bool = False
    branches: List[Dict[str, Any]] = []
    parent_tenant_id: Optional[str] = None

class Tenant(TenantBase):
    id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

class CustomerBase(BaseModel):
    name: str
    email: str
    phone: str
    postal_code: str
    birthday: str

class Customer(CustomerBase):
    id: str
    tenant_id: str
    barcode_id: str
    points: int = 0
    visits: int = 0
    total_amount_paid: float = 0.0
    tier: str = "bronze"
    pass_issued: bool = False
    last_visit_date: Optional[datetime] = None
    acquisition_source: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Visit(BaseModel):
    id: str
    tenant_id: str
    customer_id: str
    points_awarded: int
    amount_paid: float = 0.0
    visit_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TierDesign(BaseModel):
    primary_color: str = "#B85C38"
    secondary_color: str = "#1C1917"
    text_color: str = "#FFFFFF"
    accent_color: str = "#D4A574"
    font_family: str = "Inter"
    gradient_direction: str = "135deg"
    background_image_url: Optional[str] = None
    hexagon_color: str = "#D4A574"
    hexagon_filled_color: str = "#B85C38"

class CardTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    logo_url: Optional[str] = None
    active_offer_url: Optional[str] = None
    active_offer_title: Optional[str] = None
    active_offer_description: Optional[str] = None
    active_offer_active: bool = False
    design_mode: str = "hexagon_stamps"
    points_per_visit: int = 10
    visits_per_stamp: int = 1
    reward_threshold_stamps: int = 10
    reward_description: str = "Un café gratuit"
    notify_before_reward: int = 1
    bronze_design: TierDesign = Field(default_factory=TierDesign)
    silver_design: TierDesign = Field(default_factory=lambda: TierDesign(primary_color="#A0A0A0", accent_color="#C0C0C0"))
    gold_design: TierDesign = Field(default_factory=lambda: TierDesign(primary_color="#D4A574", accent_color="#FFD700"))
    show_customer_name: bool = True
    show_customer_birthday: bool = True
    show_points: bool = True
    show_progress_meter: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Campaign(BaseModel):
    id: str
    tenant_id: str
    name: str
    status: str = "draft"
    content: str
    filters: Dict[str, Any] = {}
    sent_at: Optional[datetime] = None
    delivered_count: int = 0
    targeted_count: int = 0
    opens: int = 0
    opens_unique: int = 0
    visits_from_campaign: int = 0
    recipient_ids: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIQueryRequest(BaseModel):
    message: str

class PaymentTransaction(BaseModel):
    session_id: str
    tenant_id: str
    plan: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
