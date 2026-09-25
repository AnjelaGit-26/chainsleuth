"""
routes_auth.py – Officer Session Endpoints (auth-free mode).

Auth0 has been removed. Returns a default officer profile for all requests.

GET /api/v1/auth/me    – Return officer profile
GET /api/v1/auth/roles – Return RBAC role definitions
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.core.auth import User, get_current_user

router = APIRouter(prefix="/auth", tags=["Identity & RBAC"])


@router.get(
    "/me",
    response_model=dict[str, Any],
    summary="Get officer profile",
    description="Returns the current officer identity, roles, and permissions.",
)
async def get_current_officer_profile(user: User = Depends(get_current_user)) -> dict[str, Any]:
    """Returns the current officer profile."""
    return {
        "status": "authenticated",
        "sub": user.sub,
        "email": user.email,
        "name": user.name or "Law Enforcement Officer",
        "roles": user.roles,
        "permissions": user.permissions,
        "is_admin": user.has_role("admin"),
        "is_investigator": user.has_role("investigator"),
    }


@router.get(
    "/roles",
    summary="List law enforcement RBAC role hierarchy",
    description="Returns available system roles and their investigative permission scopes.",
)
async def list_rbac_roles() -> dict[str, Any]:
    return {
        "roles": [
            {
                "role": "investigator",
                "title": "Cyber Crime Investigating Officer",
                "description": "Can initiate multi-chain graph traces, analyze wallet clusters, and generate FIR/BNSS legal dockets.",
                "permissions": ["trace:read", "trace:write", "notice:generate", "cases:read"],
            },
            {
                "role": "admin",
                "title": "Cyber Cell Administrator / Senior SP",
                "description": "Full access to custom VASP labels, continuous intelligence enrichment, and system configuration.",
                "permissions": ["*"],
            },
            {
                "role": "compliance_officer",
                "title": "VASP Nodal / Exchange Compliance Officer",
                "description": "Restricted access to receive Section 94 BNSS notices and provide KYC transaction responses.",
                "permissions": ["notice:read", "kyc:respond"],
            },
        ]
    }
