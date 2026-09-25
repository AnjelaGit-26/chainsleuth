"""
auth.py – Supabase Auth verification for ChainSleuth.

Uses the official Supabase Python client to validate Bearer tokens.
The frontend signs in with Supabase and sends the access_token as Bearer.
This module calls supabase.auth.get_user(token) which validates it server-side.

No JWT secret, no PyJWT, no manual decoding needed.

Configuration:
  - AUTH_ENABLED=False  → Dev mode, return default officer (no token needed)
  - AUTH_ENABLED=True   → Enforce real Supabase token verification
"""
from __future__ import annotations

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

token_auth_scheme = HTTPBearer(auto_error=False)


# ── User Identity Model ────────────────────────────────────────────────────────

class User(BaseModel):
    """Authenticated user profile from Supabase Auth."""
    sub: str = Field(..., description="Supabase user UUID")
    email: str | None = Field(default=None)
    name: str | None = Field(default=None)
    roles: list[str] = Field(default_factory=lambda: ["investigator"])
    permissions: list[str] = Field(default_factory=list)
    is_authenticated: bool = Field(default=True)

    def has_role(self, role: str) -> bool:
        return (
            role.lower() in [r.lower() for r in self.roles]
            or "admin" in [r.lower() for r in self.roles]
        )


# ── Supabase Token Verification ────────────────────────────────────────────────

async def _verify_with_supabase(token: str) -> User:
    """
    Validate the Bearer token by calling supabase.auth.get_user(token).
    Supabase validates the token server-side — no secret or JWT library needed.
    """
    try:
        from app.core.supabase import get_supabase_client
        client = get_supabase_client()

        if client is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase client not configured. Set SUPABASE_URL and SUPABASE_KEY in .env.",
            )

        # This calls Supabase's /auth/v1/user endpoint with the Bearer token
        response = client.auth.get_user(token)

        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Supabase session. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = response.user
        meta = user.app_metadata or {}
        u_meta = user.user_metadata or {}

        # Role resolution from app_metadata
        raw_role = meta.get("role") or meta.get("roles") or "investigator"
        if isinstance(raw_role, str):
            roles = [raw_role]
        elif isinstance(raw_role, list):
            roles = raw_role
        else:
            roles = ["investigator"]

        # service_role → admin
        roles = ["admin" if r == "service_role" else r for r in roles]

        name = u_meta.get("name") or u_meta.get("full_name") or user.email

        return User(
            sub=user.id,
            email=user.email,
            name=name,
            roles=roles,
            permissions=meta.get("permissions", []),
            is_authenticated=True,
        )

    except HTTPException:
        raise
    except Exception as exc:
        log.error("Supabase auth.get_user failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI Dependency ─────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(token_auth_scheme),
) -> User:
    """
    FastAPI dependency — verify Supabase Bearer token and return User.
    Falls back to dev officer when AUTH_ENABLED=False.
    """
    if not settings.AUTH_ENABLED:
        return User(
            sub="supabase|officer_dev_mode",
            email="investigating_officer@cybercrime.gov.in",
            name="Nodal Cyber Crime Officer",
            roles=["admin", "investigator"],
            permissions=["trace:read", "trace:write", "notice:generate", "labels:manage"],
            is_authenticated=True,
        )

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Provide: Authorization: Bearer <supabase_access_token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return await _verify_with_supabase(credentials.credentials)


# ── RBAC Role Guard ────────────────────────────────────────────────────────────

def require_role(required_role: str):
    """
    Role enforcement dependency.
    Usage: @router.post("/...", dependencies=[Depends(require_role("admin"))])
    """
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if not user.has_role(required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: your account does not have the '{required_role}' role.",
            )
        return user

    return role_checker
