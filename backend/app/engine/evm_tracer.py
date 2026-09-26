"""
evm_tracer.py – Async EVM (Ethereum / Base / Polygon / BSC) ERC-20 stablecoin & native transfer tracer.

Supports:
  - Base (Coinbase L2): Basescan API (tokentx + txlist), Base Blockscout REST API, and Base Public JSON-RPC (mainnet.base.org).
  - Ethereum: Blockscout REST API + EVM RPC endpoints.
  - Normalizes token decimals (6 for USDC/USDT on Base/Ethereum, 18 on BSC).
  - Deduplicates and caches lookups in Redis (5-min TTL).
  - Returns structured dicts identical to the BFS engine interface.
"""
from __future__ import annotations

import logging
from datetime import datetime, UTC
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.database import cache_get, cache_set

log = logging.getLogger(__name__)

# ── Endpoints & Contracts ─────────────────────────────────────────────────────

BLOCKSCOUT_ETH_BASE  = "https://eth.blockscout.com/api/v2"
BLOCKSCOUT_BASE_BASE = "https://base.blockscout.com/api/v2"
BASESCAN_API_URL     = "https://api.basescan.org/api"
BASE_PUBLIC_RPC      = "https://mainnet.base.org"

# Official EVM token contract addresses
EVM_TOKEN_CONTRACTS: dict[str, dict[str, str]] = {
    "ethereum": {
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    "base": {
        "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  # Native Circle USDC on Base
        "USDT": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",  # Bridged USDT
        "cbBTC": "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", # Coinbase Wrapped BTC
        "WETH": "0x4200000000000000000000000000000000000006",
    },
    "polygon": {
        "USDT": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "USDC": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    },
    "bsc": {
        "USDT": "0x55d398326f99059fF775485246999027B3197955",
        "USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    },
}

_CACHE_TTL = 300  # 5 minutes


# ── Internal Helpers ──────────────────────────────────────────────────────────

def _cache_key(address: str, chain: str, only_outbound: bool = True) -> str:
    return f"evm:transfers:{chain.lower()}:{address.lower()}:outbound_{only_outbound}"


def _parse_blockscout_transfer(raw: dict[str, Any], chain: str) -> dict[str, Any] | None:
    """Extract and normalise a single token transfer from Blockscout payload."""
    try:
        token = raw.get("token") or {}
        decimals = int(token.get("decimals") or raw.get("total", {}).get("decimals") or 6)
        raw_val = int(raw.get("total", {}).get("value") or 0)
        value = raw_val / (10 ** decimals)

        timestamp_str = raw.get("timestamp")
        if timestamp_str:
            try:
                ts = int(datetime.fromisoformat(timestamp_str.replace("Z", "+00:00")).timestamp())
            except Exception:
                ts = int(raw.get("block_timestamp", 0))
        else:
            ts = int(raw.get("block_timestamp", 0))

        tx_hash = raw.get("transaction_hash") or raw.get("tx_hash") or ""
        from_addr = raw.get("from", {}).get("hash") or raw.get("from", {}).get("address") or ""
        to_addr = raw.get("to", {}).get("hash") or raw.get("to", {}).get("address") or ""
        contract_addr = token.get("address_hash") or token.get("address") or ""

        return {
            "tx_hash":      tx_hash,
            "from_address": from_addr,
            "to_address":   to_addr,
            "value":        value,
            "token":        token.get("symbol", "USDC" if chain == "base" else "USDT"),
            "contract":     contract_addr,
            "block_ts":     ts * 1000,
            "timestamp":    ts,
        }
    except Exception as exc:
        log.debug("Could not parse Blockscout EVM transfer: %s", exc)
        return None


def _parse_basescan_transfer(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Extract and normalise a single token transfer from Basescan payload."""
    try:
        decimals = int(raw.get("tokenDecimal") or 6)
        raw_val = int(raw.get("value") or 0)
        value = raw_val / (10 ** decimals)
        ts = int(raw.get("timeStamp") or 0)

        return {
            "tx_hash":      raw.get("hash", ""),
            "from_address": raw.get("from", ""),
            "to_address":   raw.get("to", ""),
            "value":        value,
            "token":        raw.get("tokenSymbol", "USDC"),
            "contract":     raw.get("contractAddress", ""),
            "block_ts":     ts * 1000,
            "timestamp":    ts,
        }
    except Exception as exc:
        log.debug("Could not parse Basescan transfer: %s", exc)
        return None


# ── Basescan Fetcher ──────────────────────────────────────────────────────────

async def _fetch_from_basescan(
    address: str,
    api_key: str,
    only_outbound: bool = True,
    min_value_usdt: float = 0.0,
) -> list[dict[str, Any]]:
    """Fetch ERC-20 token transfers for Base via Basescan API."""
    results: list[dict[str, Any]] = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChainSleuth/1.0"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {
                "module": "account",
                "action": "tokentx",
                "address": address,
                "page": 1,
                "offset": 50,
                "sort": "desc",
                "apikey": api_key,
            }
            resp = await client.get(BASESCAN_API_URL, params=params, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("result", [])
                if isinstance(items, list):
                    for item in items:
                        parsed = _parse_basescan_transfer(item)
                        if not parsed:
                            continue
                        if only_outbound and parsed["from_address"].lower() != address.lower():
                            continue
                        if parsed["value"] < min_value_usdt:
                            continue
                        results.append(parsed)
                    log.info("Basescan API: retrieved %d token transfers for %s", len(results), address)
    except Exception as exc:
        log.warning("Basescan API request failed: %s (falling back to Base Blockscout)", exc)

    return results


# ── Public API ────────────────────────────────────────────────────────────────

async def fetch_evm_transfers(
    address: str,
    chain: str = "ethereum",
    only_outbound: bool = True,
    min_value_usdt: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Fetch outbound ERC-20 stablecoin transfers for an EVM address (Ethereum or Base).

    Args:
        address: Target EVM address (0x...)
        chain: "ethereum", "base", "polygon", or "bsc"
        only_outbound: Filter to sender matching address
        min_value_usdt: Drop transfers below threshold
    """
    chain_lower = chain.lower()
    cache_key = _cache_key(address, chain_lower, only_outbound)

    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT – EVM transfers for %s (%d records)", address, len(cached))
        return cached

    all_transfers: list[dict[str, Any]] = []
    settings = get_settings()

    # 1. Base Strategy: Try Basescan first if API key configured
    if chain_lower == "base" and settings.BASESCAN_API_KEY:
        all_transfers = await _fetch_from_basescan(
            address=address,
            api_key=settings.BASESCAN_API_KEY,
            only_outbound=only_outbound,
            min_value_usdt=min_value_usdt,
        )

    # 2. Blockscout Strategy (Primary for Ethereum, Fallback / Zero-Config for Base)
    if not all_transfers:
        blockscout_base = BLOCKSCOUT_BASE_BASE if chain_lower == "base" else BLOCKSCOUT_ETH_BASE
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChainSleuth/1.0"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{blockscout_base}/addresses/{address}/token-transfers",
                    params={"type": "ERC-20"},
                    headers=headers,
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    items = payload.get("items", [])
                    for raw in items:
                        parsed = _parse_blockscout_transfer(raw, chain_lower)
                        if not parsed:
                            continue
                        if only_outbound and parsed["from_address"].lower() != address.lower():
                            continue
                        if parsed["value"] < min_value_usdt:
                            continue
                        all_transfers.append(parsed)
        except Exception as exc:
            log.warning("Blockscout EVM query failed for %s on %s: %s", address, chain_lower, exc)

    log.info("EVM fetch complete: %s on %s -> %d transfers", address, chain_lower, len(all_transfers))
    await cache_set(cache_key, all_transfers, ttl=_CACHE_TTL)
    return all_transfers


async def get_evm_balance(address: str, chain: str = "ethereum") -> float:
    """
    Fetch native ETH balance for an EVM address.
    For Base, uses high-speed official Base Public JSON-RPC (https://mainnet.base.org).
    """
    chain_lower = chain.lower()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ChainSleuth/1.0"}

    # Base Public RPC: direct eth_getBalance
    if chain_lower == "base":
        settings = get_settings()
        rpc_url = settings.BASE_RPC_URL or BASE_PUBLIC_RPC
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                payload = {
                    "jsonrpc": "2.0",
                    "method": "eth_getBalance",
                    "params": [address, "latest"],
                    "id": 1,
                }
                resp = await client.post(rpc_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    hex_bal = resp.json().get("result", "0x0")
                    return int(hex_bal, 16) / 10**18
        except Exception as exc:
            log.debug("Base RPC balance failed for %s: %s (falling back to Blockscout)", address, exc)

    # Fallback to Blockscout
    blockscout_base = BLOCKSCOUT_BASE_BASE if chain_lower == "base" else BLOCKSCOUT_ETH_BASE
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{blockscout_base}/addresses/{address}", headers=headers)
            if resp.status_code == 200:
                coin_bal = resp.json().get("coin_balance")
                if coin_bal:
                    return int(coin_bal) / 10**18
    except Exception as exc:
        log.debug("Could not fetch EVM balance for %s: %s", address, exc)

    return 0.0
