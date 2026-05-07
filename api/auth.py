import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, Depends
from models import TokenData

SECRET_KEY = "a3f8b2c1d4e5f67890abcdef12345678abcdef9087654321fedcba0987654321"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user_data(request: Request) -> TokenData:
    # Try cookie first (browser-based auth), then Authorization: Bearer header
    # (mobile / API clients). This makes the auth path more forgiving when
    # the browser refuses to send the cookie on a JSON POST.
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        # Verbose diagnostic so the staff workspace can show us EXACTLY what's
        # missing on a failed scan. Lists which cookies / headers came through.
        cookie_keys = list(request.cookies.keys())
        has_auth_hdr = bool(request.headers.get("authorization") or request.headers.get("Authorization"))
        raise HTTPException(
            status_code=401,
            detail=(
                "Not authenticated — no access_token cookie or Authorization header. "
                f"cookies_received={cookie_keys} · auth_header_present={has_auth_hdr} · "
                f"path={request.url.path}"
            ),
        )
    try:
        if token.startswith("Bearer "):
            token = token[7:]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        tenant_id: str = payload.get("tenant_id")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid auth credentials (no sub claim)")
        return TokenData(email=email, role=role, tenant_id=tenant_id)
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)[:80]}")

def require_role(roles: list[str]):
    async def role_checker(token_data: TokenData = Depends(get_current_user_data)):
        if token_data.role not in roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return token_data
    return role_checker

def check_plan_feature(tenant_plan: str, feature_key: str):
    from models import PLAN_FEATURES
    features = PLAN_FEATURES.get(tenant_plan, {})
    if feature_key in ["csv_export", "geo_proximity"]:
        if not features.get(feature_key, False):
            raise HTTPException(status_code=403, detail="PLAN_FEATURE_DISABLED")
