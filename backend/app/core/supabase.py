"""
supabase.py – Supabase Cloud PostgreSQL Client & Integration Engine.

Provides:
1. Singleton Supabase Client connection.
2. Cloud CRUD operations for:
   - Custom Law Enforcement wallet attribution labels (`custom_wallet_labels`)
   - Investigation case records (`cases`)
   - Section 65B cryptographic evidence certificates (`evidence_certificates`)
3. Zero-downtime fallback to SQLite if Supabase is not configured yet.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

_supabase_client = None


def get_supabase_client():
    """
    Return a cached Supabase client if configured, or None.
    Prioritizes SUPABASE_SERVICE_ROLE_KEY for admin operations, or SUPABASE_KEY.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = (settings.SUPABASE_URL or "").strip()
    key = (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY or "").strip()

    if not url or not key:
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(url, key)
        log.info("Supabase Client connected successfully to: %s", url)
        return _supabase_client
    except Exception as exc:
        log.error("Failed to initialize Supabase client: %s", exc)
        return None


def is_supabase_enabled() -> bool:
    """Return True if Supabase is configured and ready."""
    return get_supabase_client() is not None


# ── Custom Wallet Labels CRUD ────────────────────────────────────────────────

def supabase_upsert_label(data: dict[str, Any]) -> bool:
    """Upsert a wallet label record into Supabase custom_wallet_labels table."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        payload = {
            "address": data.get("address", "").strip(),
            "entity_name": data.get("entity_name", ""),
            "entity_type": data.get("entity_type", "exchange"),
            "chain": data.get("chain", "ethereum").lower(),
            "confidence": float(data.get("confidence", 1.0)),
            "source": data.get("source", "LE_Investigation"),
            "case_reference": data.get("case_reference"),
            "notes": data.get("notes"),
            "tags": data.get("tags") if isinstance(data.get("tags"), list) else [],
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if "created_at" in data:
            payload["created_at"] = data["created_at"]

        res = client.table("custom_wallet_labels").upsert(payload).execute()
        return bool(res.data)
    except Exception as exc:
        log.warning("Supabase upsert_label failed: %s", exc)
        return False


def supabase_get_label(address: str) -> dict[str, Any] | None:
    """Fetch a wallet label from Supabase custom_wallet_labels by address."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("custom_wallet_labels").select("*").ilike("address", address.strip()).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        log.warning("Supabase get_label query failed: %s", exc)
        return None


def supabase_search_labels(
    query: str = "",
    chain: str | None = None,
    entity_type: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[dict[str, Any]] | None:
    """Search wallet labels in Supabase."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        req = client.table("custom_wallet_labels").select("*")
        if chain:
            req = req.eq("chain", chain.lower())
        if entity_type:
            req = req.eq("entity_type", entity_type.lower())
        if query:
            q = f"%{query}%"
            req = req.or_(f"address.ilike.{q},entity_name.ilike.{q},notes.ilike.{q},case_reference.ilike.{q}")

        req = req.order("updated_at", desc=True).range(skip, skip + limit - 1)
        res = req.execute()
        return res.data or []
    except Exception as exc:
        log.warning("Supabase search_labels failed: %s", exc)
        return None


def supabase_count_labels() -> int | None:
    """Count total custom wallet labels in Supabase."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("custom_wallet_labels").select("address", count="exact").execute()
        return res.count if res.count is not None else len(res.data or [])
    except Exception as exc:
        log.warning("Supabase count_labels failed: %s", exc)
        return None


# ── Case Records CRUD ────────────────────────────────────────────────────────

def supabase_save_case(case_data: dict[str, Any]) -> bool:
    """Insert or update a case summary in Supabase cases table."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        payload = {
            "id": case_data.get("id"),
            "title": case_data.get("title", f"Case {case_data.get('id')}"),
            "status": case_data.get("status", "active"),
            "chain": case_data.get("chain", "ethereum"),
            "root_address": case_data.get("root_address", ""),
            "fir_number": case_data.get("fir_number"),
            "police_station": case_data.get("police_station"),
            "state": case_data.get("state"),
            "officer_name": case_data.get("officer_name"),
            "officer_designation": case_data.get("officer_designation"),
            "total_stolen_inr": case_data.get("total_stolen_inr", 0),
            "node_count": case_data.get("node_count", 0),
            "edge_count": case_data.get("edge_count", 0),
            "attribution": case_data.get("attribution"),
            "updated_at": datetime.now(UTC).isoformat(),
        }
        res = client.table("cases").upsert(payload).execute()
        return bool(res.data)
    except Exception as exc:
        log.warning("Supabase save_case failed: %s", exc)
        return False


def supabase_get_case(case_id: str) -> dict[str, Any] | None:
    """Fetch a case record by case_id from Supabase."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("cases").select("*").eq("id", case_id).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        log.warning("Supabase get_case failed: %s", exc)
        return None


def supabase_list_cases(skip: int = 0, limit: int = 20) -> list[dict[str, Any]] | None:
    """List cases with pagination from Supabase."""
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("cases").select("*").order("updated_at", desc=True).range(skip, skip + limit - 1).execute()
        return res.data or []
    except Exception as exc:
        log.warning("Supabase list_cases failed: %s", exc)
        return None


# ── Evidence Certificates CRUD ───────────────────────────────────────────────

def supabase_save_certificate(cert_data: dict[str, Any]) -> bool:
    """Persist a Section 65B cryptographic evidence certificate to Supabase."""
    client = get_supabase_client()
    if not client:
        return False
    try:
        payload = {
            "certificate_id": cert_data.get("certificate_id"),
            "case_id": cert_data.get("case_id"),
            "root_address": cert_data.get("root_address", ""),
            "sha256_hash": cert_data.get("sha256_hash", ""),
            "signature": cert_data.get("signature", ""),
            "certified_by": cert_data.get("certified_by", "Investigating Officer"),
            "system_dossier": cert_data.get("system_dossier"),
        }
        res = client.table("evidence_certificates").upsert(payload).execute()
        return bool(res.data)
    except Exception as exc:
        log.warning("Supabase save_certificate failed: %s", exc)
        return False
