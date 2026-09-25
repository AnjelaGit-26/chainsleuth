"""
threat_intel.py – Commercial & OSINT Threat Intelligence Aggregator for VASP Tagging.

Provides a unified attribution interface across:
1. Commercial Threat Intelligence APIs (TRM Labs, Chainalysis, Elliptic) when API keys are configured.
2. High-speed built-in OSINT intelligence engine containing known exchange hot wallets,
   OFAC SDN sanctioned entities, No-KYC swappers, bridges, and FIU-registered reporting entities.
3. In-memory / Redis caching to avoid redundant queries and latency.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.database import cache_get, cache_set
from app.engine.sanctions import check_sanctions
from app.vasp.registry import get_vasp_by_hot_wallet, is_bridge, is_hot_wallet, is_no_kyc_swapper

log = logging.getLogger(__name__)
settings = get_settings()

_CACHE_TTL_TAGS = 3600  # 1 hour cache for threat intelligence lookups


@dataclass
class WalletTagResult:
    """Forensic threat intelligence & attribution tag for a cryptocurrency wallet."""
    address: str
    chain: str
    entity_name: str
    category: str  # "exchange", "bridge", "no_kyc_swapper", "sanctioned", "mixer", "scam", "dex", "unattributed"
    confidence: float  # 0.0 to 1.0
    source: str  # "trm_labs", "chainalysis", "elliptic", "internal_vasp_registry", "ofac_sdn", "unattributed"
    is_fiu_registered: bool
    risk_level: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Commercial Provider Connectors ───────────────────────────────────────────

async def _query_trm_labs(address: str, chain: str) -> WalletTagResult | None:
    """Query TRM Labs public intelligence search API if TRM_API_KEY is configured."""
    api_key = settings.TRM_API_KEY
    if not api_key:
        return None

    url = "https://api.trmlabs.com/public/v1/search"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = [{"search": address, "chain": chain}]

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                if data and isinstance(data, list):
                    item = data[0]
                    entities = item.get("entities", [])
                    if entities:
                        e = entities[0]
                        name = e.get("entityName") or "Unknown TRM Entity"
                        cat = e.get("category", "exchange").lower()
                        risk = "HIGH" if e.get("isSanctioned") else "LOW"
                        return WalletTagResult(
                            address=address,
                            chain=chain,
                            entity_name=name,
                            category=cat,
                            confidence=0.98,
                            source="trm_labs",
                            is_fiu_registered=False,
                            risk_level=risk,
                            tags=e.get("tags", ["trm_intel"]),
                            metadata={"trm_id": e.get("trmId")},
                        )
    except Exception as exc:
        log.warning("TRM Labs API lookup failed for %s: %s", address, exc)

    return None


async def _query_chainalysis(address: str, chain: str) -> WalletTagResult | None:
    """Query Chainalysis KYT / Oracle API if CHAINALYSIS_API_KEY is configured."""
    api_key = settings.CHAINALYSIS_API_KEY
    if not api_key:
        return None

    url = f"https://api.chainalysis.com/api/kyt/v1/users/{address}"
    headers = {"Token": api_key, "Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                cluster = data.get("cluster", {})
                name = cluster.get("name") or "Chainalysis Labeled Entity"
                cat = cluster.get("category", "exchange").lower()
                return WalletTagResult(
                    address=address,
                    chain=chain,
                    entity_name=name,
                    category=cat,
                    confidence=0.99,
                    source="chainalysis",
                    is_fiu_registered=False,
                    risk_level=data.get("risk", "LOW").upper(),
                    tags=["chainalysis_kyt"],
                    metadata=cluster,
                )
    except Exception as exc:
        log.warning("Chainalysis API lookup failed for %s: %s", address, exc)

    return None


async def _query_elliptic(address: str, chain: str) -> WalletTagResult | None:
    """Query Elliptic Forensics API if ELLIPTIC_API_KEY is configured."""
    api_key = settings.ELLIPTIC_API_KEY
    if not api_key:
        return None

    url = f"https://api.elliptic.co/v2/wallet/{address}"
    headers = {"x-access-key": api_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                entity = data.get("entity", {})
                name = entity.get("name", "Elliptic Labeled Entity")
                return WalletTagResult(
                    address=address,
                    chain=chain,
                    entity_name=name,
                    category=entity.get("type", "exchange").lower(),
                    confidence=0.97,
                    source="elliptic",
                    is_fiu_registered=False,
                    risk_level="HIGH" if data.get("risk_score", 0) > 7 else "LOW",
                    tags=["elliptic_intel"],
                    metadata=entity,
                )
    except Exception as exc:
        log.warning("Elliptic API lookup failed for %s: %s", address, exc)

    return None


# ── Built-In High-Speed OSINT Intelligence Engine ────────────────────────────

def query_internal_osint_intel(address: str, chain: str) -> WalletTagResult | None:
    """
    Query internal curated OSINT databases:
      1. OFAC Sanctions dataset (SDN List)
      2. Internal VASP Registry (Hot wallets, sweep addresses)
      3. No-KYC Swapper catalog
      4. Cross-chain liquidity bridge registry
    """
    # 1. OFAC SDN Sanctions Check
    sanction_match = check_sanctions(address)
    if sanction_match:
        return WalletTagResult(
            address=address,
            chain=chain,
            entity_name=sanction_match["entity"],
            category="sanctioned",
            confidence=1.0,
            source="ofac_sdn",
            is_fiu_registered=False,
            risk_level="CRITICAL",
            tags=["ofac_sdn", "sanctions_evasion", "blacklisted"],
            metadata={"program": sanction_match.get("program")},
        )

    # 2. No-KYC Swapper Catalog (FixedFloat, ChangeNOW, SideShift, SimpleSwap)
    if is_no_kyc_swapper(address):
        entry = get_vasp_by_hot_wallet(address)
        name = entry.name if entry else "Instant No-KYC Swapper"
        return WalletTagResult(
            address=address,
            chain=chain,
            entity_name=name,
            category="no_kyc_swapper",
            confidence=0.95,
            source="internal_vasp_registry",
            is_fiu_registered=False,
            risk_level="HIGH",
            tags=["no_kyc_swapper", "privacy_coin_gateway", "fixedfloat_changenow"],
            metadata={"nodal_officer_email": entry.nodal_officer_email if entry else ""},
        )

    # 3. Cross-Chain Bridge Registry
    if is_bridge(address):
        entry = get_vasp_by_hot_wallet(address)
        name = entry.name if entry else "Cross-Chain Liquidity Bridge"
        return WalletTagResult(
            address=address,
            chain=chain,
            entity_name=name,
            category="bridge",
            confidence=0.96,
            source="internal_vasp_registry",
            is_fiu_registered=False,
            risk_level="MEDIUM",
            tags=["bridge", "cross_chain_liquidity"],
            metadata={},
        )

    # 4. Standard VASP Hot Wallet / Exchange Attribution
    if is_hot_wallet(address):
        entry = get_vasp_by_hot_wallet(address)
        if entry:
            return WalletTagResult(
                address=address,
                chain=chain,
                entity_name=entry.name,
                category="exchange",
                confidence=0.98,
                source="internal_vasp_registry",
                is_fiu_registered=entry.is_fiu_registered,
                risk_level=entry.risk_level.upper(),
                tags=entry.tags + ["hot_wallet", "sweep_collector"],
                metadata={
                    "jurisdiction": entry.jurisdiction,
                    "nodal_officer_email": entry.nodal_officer_email,
                },
            )

    return None


# ── Unified Tagging Dispatcher ────────────────────────────────────────────────

async def tag_wallet(address: str, chain: str = "ethereum") -> WalletTagResult:
    """
    Unified attribution query across commercial APIs and internal OSINT intelligence.
    Checks Redis/in-memory cache first, then commercial providers (if configured),
    then internal curated database.
    """
    if not address:
        return WalletTagResult(
            address="",
            chain=chain,
            entity_name="Invalid Address",
            category="unattributed",
            confidence=0.0,
            source="unattributed",
            is_fiu_registered=False,
            risk_level="LOW",
        )

    clean_addr = address.strip()
    cache_key = f"threat:tag:{clean_addr.lower()}"

    # 1. Cache Check
    cached = await cache_get(cache_key)
    if cached and isinstance(cached, dict):
        return WalletTagResult(**cached)

    # 2. Commercial Connectors (if keys configured)
    if settings.TRM_API_KEY:
        trm_res = await _query_trm_labs(clean_addr, chain)
        if trm_res:
            await cache_set(cache_key, trm_res.to_dict(), ttl=_CACHE_TTL_TAGS)
            return trm_res

    if settings.CHAINALYSIS_API_KEY:
        chain_res = await _query_chainalysis(clean_addr, chain)
        if chain_res:
            await cache_set(cache_key, chain_res.to_dict(), ttl=_CACHE_TTL_TAGS)
            return chain_res

    if settings.ELLIPTIC_API_KEY:
        ell_res = await _query_elliptic(clean_addr, chain)
        if ell_res:
            await cache_set(cache_key, ell_res.to_dict(), ttl=_CACHE_TTL_TAGS)
            return ell_res

    # 3. Built-In High-Confidence OSINT Registry Check
    osint_res = query_internal_osint_intel(clean_addr, chain)
    if osint_res:
        await cache_set(cache_key, osint_res.to_dict(), ttl=_CACHE_TTL_TAGS)
        return osint_res

    # 4. Default / Unattributed
    unattr = WalletTagResult(
        address=clean_addr,
        chain=chain,
        entity_name="Unattributed Non-Custodial Wallet",
        category="unattributed",
        confidence=0.1,
        source="unattributed",
        is_fiu_registered=False,
        risk_level="LOW",
        tags=["unlabeled", "self_custody"],
        metadata={},
    )
    await cache_set(cache_key, unattr.to_dict(), ttl=_CACHE_TTL_TAGS)
    return unattr
