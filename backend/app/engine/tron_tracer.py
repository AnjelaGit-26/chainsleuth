"""
tron_tracer.py – Async TronGrid REST client for TRC-20 USDT outbound transfer fetching.

Design:
  - Uses httpx.AsyncClient (connection-pooled, timeout-controlled)
  - Targets the TronGrid v1 REST API (no SDK overhead)
  - Filters for outbound TRC-20 USDT transfers only
  - Deduplicates address lookups via Redis (5-min TTL)
  - Paginates automatically using TronGrid's `fingerprint` cursor
  - Returns structured dicts ready for the BFS traversal layer
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.database import cache_delete, cache_get, cache_set

log = logging.getLogger(__name__)
settings = get_settings()

# ── Constants ─────────────────────────────────────────────────────────────────

TRONGRID_BASE_URL = "https://api.trongrid.io"

# Official USDT TRC-20 contract address on TRON mainnet
USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

# TronGrid API limits
_PAGE_LIMIT = 200          # max records per page (TronGrid max = 200)
_MAX_PAGES  = 5            # safety cap: fetch at most 1 000 txns per address
_CACHE_TTL  = 300          # Redis TTL in seconds (5 minutes)

# Shared async HTTP client (one connection pool for the whole process)
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Return (or lazily create) the shared async HTTP client."""
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            base_url=TRONGRID_BASE_URL,
            headers={
                "Accept":          "application/json",
                "TRON-PRO-API-KEY": settings.TRONGRID_KEY,
            },
            timeout=httpx.Timeout(connect=5.0, read=20.0, write=5.0, pool=5.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30,
            ),
            follow_redirects=True,
        )
    return _http_client


async def close_http_client() -> None:
    """Close the shared HTTP client (call on app shutdown)."""
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


# ── Internal helpers ──────────────────────────────────────────────────────────

def _cache_key(address: str) -> str:
    return f"tron:usdt_transfers:{address}"


def _parse_transfer(raw: dict[str, Any]) -> dict[str, Any] | None:
    """
    Extract and normalise a single TRC-20 transfer record from the TronGrid payload.

    Returns None for records that cannot be parsed (malformed / missing fields).
    """
    try:
        token_info = raw.get("token_info", {})
        return {
            "tx_hash":      raw["transaction_id"],
            "from_address": raw["from"],
            "to_address":   raw["to"],
            # TronGrid returns raw integer amounts; USDT has 6 decimal places
            "value":        int(raw.get("value", 0)) / 1_000_000,
            "token":        token_info.get("symbol", "USDT"),
            "contract":     token_info.get("address", USDT_CONTRACT_ADDRESS),
            "block_ts":     raw.get("block_timestamp", 0),          # Unix ms
            "timestamp":    raw.get("block_timestamp", 0) // 1000,  # Unix s
        }
    except (KeyError, TypeError, ValueError) as exc:
        log.warning("Failed to parse transfer record: %s | raw=%s", exc, raw)
        return None


# ── Public API ────────────────────────────────────────────────────────────────

async def fetch_usdt_transfers(
    address: str,
    only_outbound: bool = True,
    min_value_usdt: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Fetch TRC-20 USDT transfers for *address* from TronGrid REST API.

    Behaviour:
      1. Check Redis cache — return immediately on hit.
      2. Paginate through TronGrid using ``fingerprint`` cursor (up to ``_MAX_PAGES`` pages).
      3. Filter to outbound transfers (``from == address``) when ``only_outbound=True``.
      4. Filter transfers below ``min_value_usdt``.
      5. Store results in Redis with a 5-minute TTL.

    Args:
        address:        TRON wallet address to query.
        only_outbound:  If True (default), only return transfers *from* this address.
        min_value_usdt: Drop transfers with USDT value below this threshold.

    Returns:
        A list of normalised transfer dicts::

            {
                "tx_hash":      str,
                "from_address": str,
                "to_address":   str,
                "value":        float,   # USDT with 6 dp applied
                "token":        str,
                "contract":     str,
                "block_ts":     int,     # milliseconds
                "timestamp":    int,     # seconds
            }
    """
    cache_key = _cache_key(address)

    # ── 1. Cache check ────────────────────────────────────────────────────────
    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT – USDT transfers for %s (%d records)", address, len(cached))
        return cached

    # ── 2. Paginated fetch ────────────────────────────────────────────────────
    client = _get_http_client()
    all_transfers: list[dict[str, Any]] = []
    fingerprint: str | None = None
    page: int = 0

    for page in range(1, _MAX_PAGES + 1):
        params: dict[str, Any] = {
            "contract_address": USDT_CONTRACT_ADDRESS,
            "limit":            _PAGE_LIMIT,
            "order_by":         "block_timestamp,desc",
        }
        if fingerprint:
            params["fingerprint"] = fingerprint

        try:
            response = await client.get(
                f"/v1/accounts/{address}/transactions/trc20",
                params=params,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            log.error(
                "TronGrid HTTP error %s for address %s (page %d): %s",
                exc.response.status_code, address, page, exc.response.text,
            )
            break
        except httpx.RequestError as exc:
            log.error("TronGrid request error for %s (page %d): %s", address, page, exc)
            break

        payload = response.json()
        records  = payload.get("data", [])
        meta     = payload.get("meta", {})

        if not records:
            log.debug("No records on page %d for %s – stopping pagination.", page, address)
            break

        # ── 3. Parse and filter ───────────────────────────────────────────────
        for raw in records:
            transfer = _parse_transfer(raw)
            if transfer is None:
                continue

            # Direction filter
            if only_outbound and transfer["from_address"].lower() != address.lower():
                continue

            # Value filter
            if transfer["value"] < min_value_usdt:
                continue

            all_transfers.append(transfer)

        # ── 4. Pagination cursor ──────────────────────────────────────────────
        fingerprint = meta.get("fingerprint")
        if not fingerprint or not meta.get("links", {}).get("next"):
            log.debug("No more pages after page %d for %s.", page, address)
            break

        log.debug("Fetched page %d (%d raw records) for %s.", page, len(records), address)

    log.info(
        "TronGrid fetch complete: %s → %d outbound USDT transfers (pages: %d)",
        address, len(all_transfers), page,
    )

    # ── 5. Cache result ───────────────────────────────────────────────────────
    await cache_set(cache_key, all_transfers, ttl=_CACHE_TTL)
    return all_transfers


async def invalidate_cache(address: str) -> None:
    """Force-expire the cached transfers for *address*."""
    await cache_delete(_cache_key(address))


async def get_account_balance(address: str) -> float:
    """
    Fetch the current TRX balance (in TRX units) for *address*.

    Returns 0.0 on error.
    """
    client = _get_http_client()
    try:
        response = await client.get(f"/v1/accounts/{address}")
        response.raise_for_status()
        data = response.json().get("data", [])
        if data:
            # balance is in SUN (1 TRX = 1,000,000 SUN)
            return data[0].get("balance", 0) / 1_000_000
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        log.warning("Could not fetch balance for %s: %s", address, exc)
    return 0.0
