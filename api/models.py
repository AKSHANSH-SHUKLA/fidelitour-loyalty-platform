from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
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
    sector: Optional[str] = None  # restaurant, pizzeria, spa, gym, etc. — drives reactivation templates
    campaign_sender_name: Optional[str] = None  # custom "from" name for push notifications/emails

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
    model_config = ConfigDict(extra="allow")
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
    branch_id: Optional[str] = None      # primary branch the customer is tied to
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Visit(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    tenant_id: str
    customer_id: str
    points_awarded: int
    amount_paid: float = 0.0
    branch_id: Optional[str] = None      # where this scan happened
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


class CardElementStyle(BaseModel):
    """Per-element styling placed on a card.

    `id` identifies which field the element represents. Known ids:
    logo, business_name, customer_name, points, tier, birthday, barcode,
    progress_meter, offer_banner. Unknown ids are rendered as free text.
    """
    model_config = ConfigDict(extra="allow")
    visible: bool = True
    x_pct: float = 50.0  # 0..100, element anchor x as % of card width
    y_pct: float = 50.0  # 0..100, element anchor y as % of card height
    width_pct: Optional[float] = None  # optional box width constraint
    font_family: str = "Inter"
    font_size: int = 14  # px
    font_weight: str = "normal"  # normal | bold
    font_style: str = "normal"  # normal | italic
    text_decoration: str = "none"  # none | underline
    color: str = "#FFFFFF"
    align: str = "left"  # left | center | right
    text: Optional[str] = None  # optional override / free-text; supports {name}, {tier}, etc.


class CardPromotionElement(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str = Field(default_factory=lambda: str(uuid4()))
    text: str = ""
    x_pct: float = 50.0
    y_pct: float = 50.0
    font_family: str = "Inter"
    font_size: int = 14
    font_weight: str = "normal"
    font_style: str = "normal"
    text_decoration: str = "none"
    color: str = "#FFFFFF"
    align: str = "center"
    link: Optional[str] = None  # optional clickable link on this element


class CardPromotion(BaseModel):
    """Optional promotion block that replaces the logo area when enabled."""
    model_config = ConfigDict(extra="allow")
    enabled: bool = False
    title: str = ""
    subtitle: str = ""
    body: str = ""
    link: Optional[str] = None
    link_label: str = "En savoir plus"
    expires_at: Optional[datetime] = None
    background_color: str = "#B85C38"
    text_color: str = "#FFFFFF"
    image_url: Optional[str] = None
    elements: List[CardPromotionElement] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CardDetailsSection(BaseModel):
    model_config = ConfigDict(extra="allow")
    title: str = ""
    body: str = ""


class CardDetails(BaseModel):
    """Expandable info section shown when customer taps the card."""
    model_config = ConfigDict(extra="allow")
    about: str = ""
    hours: str = ""
    address: str = ""
    phone: str = ""
    website: str = ""
    instagram: str = ""
    facebook: str = ""
    custom_sections: List[CardDetailsSection] = Field(default_factory=list)


class CardTemplate(BaseModel):
    # Allow legacy fields (primary_color, secondary_color, text_content, font_family, etc.)
    # to flow through and persist, so the new designer and any older clients coexist.
    model_config = ConfigDict(extra="allow")

    id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    logo_url: Optional[str] = None
    active_offer_url: Optional[str] = None
    active_offer_title: Optional[str] = None
    active_offer_description: Optional[str] = None
    active_offer_active: bool = False
    design_mode: str = "hexagon_stamps"
    # New: richer stamp style catalogue.
    # hexagon | classic_dots | bar | circles | stars | squares | none
    stamp_style: str = "hexagon"
    show_meter: bool = True  # alias of show_progress_meter (new name, kept in sync)
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
    # --- New fields for the modern card designer ---
    elements: Dict[str, CardElementStyle] = Field(default_factory=dict)
    promotion: CardPromotion = Field(default_factory=CardPromotion)
    details: CardDetails = Field(default_factory=CardDetails)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CardTypedNotification(BaseModel):
    """Typed push notification that attaches to a customer's wallet card.

    Types: news | offer | flash_sale | voucher_expiry | event |
           order_status | safety | custom
    """
    model_config = ConfigDict(extra="allow")
    type: str = "news"
    title: str
    body: str
    link: Optional[str] = None
    expires_at: Optional[datetime] = None
    filters: Dict[str, Any] = Field(default_factory=dict)

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
    # Feature 11: offer interaction tracking
    offer_clicks: int = 0
    offer_clicks_unique: int = 0
    push_dismissals: int = 0  # number of recipients who dismissed the push without opening
    sender_name: Optional[str] = None  # snapshot of tenant.campaign_sender_name when sent
    # Distribution channel this campaign was published on — used for per-channel performance analysis
    # Allowed values: 'push' (wallet push), 'email', 'instagram', 'facebook', 'tiktok', 'sms', 'other'
    source: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIQueryRequest(BaseModel):
    message: str

class PaymentTransaction(BaseModel):
    session_id: str
    tenant_id: str
    plan: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
