from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

PLAN_FEATURES = {
    "basic": {
        "max_customers": 500,
        "campaigns_per_month": 2,
        "ai_queries_per_day": 0,
        "csv_export": False,
        "geo_proximity": False,
    },
    "gold": {
        "max_customers": 2000,
        "campaigns_per_month": 10,
        "ai_queries_per_day": 20,
        "csv_export": True,
        "geo_proximity": True,
    },
    "vip": {
        "max_customers": 10000,
        "campaigns_per_month": 100,
        "ai_queries_per_day": 35,
        "csv_export": True,
        "geo_proximity": True,
    }
}

PLAN_PRICES = {
    "basic": 29,
    "gold": 79,
    "vip": 199
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Visit(BaseModel):
    id: str
    tenant_id: str
    customer_id: str
    points_awarded: int
    amount_paid: float = 0.0
    visit_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CardTemplate(BaseModel):
    tenant_id: str
    primary_color: str = "#B85C38"
    secondary_color: str = "#4A5D23"
    text_content: str = ""
    logo_url: str = ""
    design_mode: str = "classic"
    font_family: str = "Manrope"
    show_points: bool = True
    customer_name_visible: bool = True
    customer_birthday_visible: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIQueryRequest(BaseModel):
    message: str

class PaymentTransaction(BaseModel):
    session_id: str
    tenant_id: str
    plan: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
