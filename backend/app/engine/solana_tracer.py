"""
solana_tracer.py – Async Solana JSON-RPC client for SPL token & native SOL tracing.

Design:
  - Connects to Solana Mainnet RPC (public endpoint / customizable via env).
  - Fetches signatures via `getSignaturesForAddress` and parses token/native transfers.
  - Normalizes amounts (lamports / 10^9 for SOL, 6 decimals for SPL USDT/USDC).
  - Redis caching with 5-minute TTL.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.database import cache_get, cache_set

log = logging.getLogger(__name__)
settings = get_settings()

SOLANA_RPC_URL = settings.SOLANA_RPC_URL or "https://api.mainnet-beta.solana.com"
_CACHE_TTL = 300


def _cache_key(address: str) -> str:
    return f"solana:transfers:{address}"


async def fetch_solana_transfers(
    address: str,
    only_outbound: bool = True,
    min_value: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Fetch confirmed transfers for a Solana wallet address.
    """
    cache_key = _cache_key(address)
    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT – Solana transfers for %s (%d records)", address, len(cached))
        return cached

    all_transfers: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Get recent signatures
            sig_req = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getSignaturesForAddress",
                "params": [address, {"limit": 20}],
            }
            resp = await client.post(SOLANA_RPC_URL, json=sig_req)
            if resp.status_code == 200:
                signatures_data = resp.json().get("result", [])

                for sig_info in signatures_data[:10]:  # batch inspect top 10
                    tx_hash = sig_info.get("signature")
                    block_time = sig_info.get("blockTime") or 0

                    tx_req = {
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getParsedTransaction",
                        "params": [tx_hash, {"maxSupportedTransactionVersion": 0}],
                    }
                    tx_resp = await client.post(SOLANA_RPC_URL, json=tx_req)
                    if tx_resp.status_code != 200:
                        continue

                    tx_data = tx_resp.json().get("result")
                    if not tx_data:
                        continue

                    message = tx_data.get("transaction", {}).get("message", {})
                    instructions = message.get("instructions", [])

                    for inst in instructions:
                        parsed = inst.get("parsed")
                        if not isinstance(parsed, dict):
                            continue

                        info = parsed.get("info", {})
                        p_type = parsed.get("type", "")

                        # SPL Token Transfer
                        if p_type in ("transfer", "transferChecked"):
                            source = info.get("source") or info.get("authority", "")
                            dest = info.get("destination", "")
                            amount_val = float(info.get("amount", 0)) / 1_000_000

                            if only_outbound and source.lower() != address.lower():
                                continue
                            if amount_val < min_value:
                                continue

                            all_transfers.append({
                                "tx_hash": tx_hash,
                                "from_address": source,
                                "to_address": dest,
                                "value": amount_val,
                                "token": "USDT",
                                "contract": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
                                "block_ts": block_time * 1000,
                                "timestamp": block_time,
                            })

                        # Native SOL Transfer
                        elif p_type == "transfer" and "lamports" in info:
                            source = info.get("source", "")
                            dest = info.get("destination", "")
                            amount_val = float(info.get("lamports", 0)) / 1_000_000_000

                            if only_outbound and source.lower() != address.lower():
                                continue
                            if amount_val < min_value:
                                continue

                            all_transfers.append({
                                "tx_hash": tx_hash,
                                "from_address": source,
                                "to_address": dest,
                                "value": amount_val,
                                "token": "SOL",
                                "contract": "11111111111111111111111111111111",
                                "block_ts": block_time * 1000,
                                "timestamp": block_time,
                            })
    except Exception as exc:
        log.warning("Solana RPC query failed for %s: %s", address, exc)

    log.info("Solana fetch complete: %s -> %d transfers", address, len(all_transfers))
    await cache_set(cache_key, all_transfers, ttl=_CACHE_TTL)
    return all_transfers


async def get_solana_balance(address: str) -> float:
    """Fetch native SOL balance for a Solana address."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            req = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getBalance",
                "params": [address],
            }
            resp = await client.post(SOLANA_RPC_URL, json=req)
            if resp.status_code == 200:
                lamports = resp.json().get("result", {}).get("value", 0)
                return float(lamports) / 1_000_000_000
    except Exception as exc:
        log.debug("Could not fetch Solana balance for %s: %s", address, exc)
    return 0.0
