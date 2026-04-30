"""
Customizable Registration Forms — additive feature module.

Status: ✅ Implemented.
Mounts at: /api/owner/registration-form and /api/join-form/{slug}
Collection: `registration_forms`

The merchant defines the schema of fields shown on their public join page
(beyond the existing required name/email/phone/postal_code/birthday). The
frontend reads /api/join-form/{slug} to render the form, and any extra
field values are stored in `customer_extras` (a separate collection so we
don't touch the existing Customer schema).

Existing /api/join/{slug} signup endpoint is NOT modified. After signup,
the frontend calls POST /api/customer/extras to attach the extra fields.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_role
from models import TokenData

router = APIRouter(tags=["registration-forms"])
_db = None


def init(db):
    global _db
    _db = db
    try:
        db.registration_forms.create_index("tenant_id", unique=True)
        db.customer_extras.create_index([("tenant_id", 1), ("customer_id", 1)], unique=True)
    except Exception:
        pass


class FormField(BaseModel):
    key: str                              # internal column name (snake_case)
    label: str                            # what the customer sees
    type: str = "text"                    # text | email | tel | select | checkbox | date | textarea
    required: bool = False
    placeholder: str = ""
    options: List[str] = Field(default_factory=list)   # for type == 'select'
    help_text: str = ""


class RegistrationForm(BaseModel):
    tenant_id: Optional[str] = None
    extra_fields: List[FormField] = Field(default_factory=list)
    consent_marketing_required: bool = True
    consent_marketing_text: str = "I agree to receive personalised offers."
    privacy_url: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CustomerExtras(BaseModel):
    tenant_slug: str
    barcode_id: str
    values: Dict[str, Any] = Field(default_factory=dict)


# ---------- Owner endpoints ----------
@router.get("/api/owner/registration-form")
def get_form(token_data: TokenData = Depends(require_role(["business_owner", "manager"]))):
    doc = _db.registration_forms.find_one({"tenant_id": token_data.tenant_id})
    if not doc:
        return RegistrationForm(tenant_id=token_data.tenant_id).model_dump()
    doc.pop("_id", None)
    return doc


@router.put("/api/owner/registration-form")
def update_form(
    form: RegistrationForm,
    token_data: TokenData = Depends(require_role(["business_owner"])),
):
    form.tenant_id = token_data.tenant_id
    form.updated_at = datetime.now(timezone.utc)
    payload = form.model_dump()
    _db.registration_forms.update_one(
        {"tenant_id": token_data.tenant_id},
        {"$set": payload},
        upsert=True,
    )
    return payload


# ---------- Public ----------
@router.get("/api/join-form/{slug}")
def public_form(slug: str):
    """Customer-facing endpoint the join page calls to render extra fields."""
    tenant = _db.tenants.find_one({"slug": slug})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    doc = _db.registration_forms.find_one({"tenant_id": tenant["id"]}) or {}
    return {
        "extra_fields": doc.get("extra_fields", []),
        "consent_marketing_required": doc.get("consent_marketing_required", True),
        "consent_marketing_text": doc.get("consent_marketing_text", ""),
        "privacy_url": doc.get("privacy_url", ""),
    }


@router.post("/api/customer/extras")
def save_extras(req: CustomerExtras):
    tenant = _db.tenants.find_one({"slug": req.tenant_slug})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    customer = _db.customers.find_one({"tenant_id": tenant["id"], "barcode_id": req.barcode_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Validate against the form schema (drop unknown keys, enforce required)
    form = _db.registration_forms.find_one({"tenant_id": tenant["id"]}) or {}
    schema = {f["key"]: f for f in form.get("extra_fields", [])}
    cleaned = {k: v for k, v in req.values.items() if k in schema}
    missing = [k for k, f in schema.items() if f.get("required") and not cleaned.get(k)]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {missing}")

    _db.customer_extras.update_one(
        {"tenant_id": tenant["id"], "customer_id": customer["id"]},
        {"$set": {
            "tenant_id": tenant["id"],
            "customer_id": customer["id"],
            "values": cleaned,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return {"saved": True}


@router.get("/api/owner/customers/{customer_id}/extras")
def get_extras(
    customer_id: str,
    token_data: TokenData = Depends(require_role(["business_owner", "manager"])),
):
    doc = _db.customer_extras.find_one({"tenant_id": token_data.tenant_id, "customer_id": customer_id})
    return doc.get("values", {}) if doc else {}
