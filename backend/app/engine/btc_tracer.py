"""
btc_tracer.py – Async Bitcoin UTXO transaction tracer using public Blockstream / Mempool APIs.

Design:
  - Connects to public Blockstream / Mempool.space REST APIs.
  - Decomposes UTXO inputs (vin) and outputs (vout) into directional fund-flow edges.
  - Normalizes satoshis to BTC (10^8 satoshis = 1 BTC).
  - Deduplicates and caches lookups in Redis (5-min TTL).
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.database import cache_get, cache_set

log = logging.getLogger(__name__)
settings = get_settings()

MEMPOOL_API_BASE = settings.MEMPOOL_API_URL or "https://mempool.space/api"
BLOCKSTREAM_API_BASE = "https://blockstream.info/api"
_CACHE_TTL = 300

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}


def _cache_key(address: str) -> str:
    return f"btc:transfers:{address}"


def _parse_esplora_txs(
    txs: list[dict[str, Any]],
    address: str,
    only_outbound: bool,
    min_value_btc: float,
) -> list[dict[str, Any]]:
    """Parse Blockstream / Mempool.space Esplora format transactions."""
    transfers: list[dict[str, Any]] = []
    for tx in txs:
        tx_id = tx.get("txid", "")
        status_info = tx.get("status", {})
        block_time = status_info.get("block_time") or 0

        vins = tx.get("vin", [])
        is_sender = any(
            vin.get("prevout", {}).get("scriptpubkey_address", "").lower() == address.lower()
            for vin in vins
        )

        if only_outbound and not is_sender:
            continue

        vouts = tx.get("vout", [])
        for vout in vouts:
            dest = vout.get("scriptpubkey_address", "")
            if dest.lower() == address.lower() and len(vouts) > 1:
                continue

            satoshis = vout.get("value", 0)
            btc_val = satoshis / 100_000_000

            if btc_val < min_value_btc:
                continue

            transfers.append({
                "tx_hash": tx_id,
                "from_address": address if is_sender else (
                    vins[0].get("prevout", {}).get("scriptpubkey_address", "") if vins else "Coinbase"
                ),
                "to_address": dest or "Unknown Output",
                "value": round(btc_val, 8),
                "token": "BTC",
                "contract": "NATIVE",
                "block_ts": block_time * 1000,
                "timestamp": block_time,
            })
    return transfers


def _parse_blockchain_info_txs(
    txs: list[dict[str, Any]],
    address: str,
    only_outbound: bool,
    min_value_btc: float,
) -> list[dict[str, Any]]:
    """Parse Blockchain.info format transactions."""
    transfers: list[dict[str, Any]] = []
    for tx in txs:
        tx_id = tx.get("hash", "")
        block_time = tx.get("time", 0)

        inputs = tx.get("inputs", [])
        is_sender = any(
            inp.get("prev_out", {}).get("addr", "").lower() == address.lower()
            for inp in inputs
        )

        if only_outbound and not is_sender:
            continue

        outs = tx.get("out", [])
        for out in outs:
            dest = out.get("addr", "")
            if dest and dest.lower() == address.lower() and len(outs) > 1:
                continue

            satoshis = out.get("value", 0)
            btc_val = satoshis / 100_000_000

            if btc_val < min_value_btc:
                continue

            from_addr = address if is_sender else (
                inputs[0].get("prev_out", {}).get("addr", "") if inputs else "Coinbase"
            )

            transfers.append({
                "tx_hash": tx_id,
                "from_address": from_addr,
                "to_address": dest or "Unknown Output",
                "value": round(btc_val, 8),
                "token": "BTC",
                "contract": "NATIVE",
                "block_ts": block_time * 1000,
                "timestamp": block_time,
            })
    return transfers


async def fetch_btc_transfers(
    address: str,
    only_outbound: bool = True,
    min_value_btc: float = 0.0,
) -> list[dict[str, Any]]:
    """
    Fetch confirmed UTXO transactions for a Bitcoin address with multi-provider fallback.
    Tries Mempool.space -> Blockstream -> Blockchain.info.
    """
    cache_key = _cache_key(address)
    cached = await cache_get(cache_key)
    if cached is not None:
        log.debug("Cache HIT – Bitcoin transfers for %s (%d records)", address, len(cached))
        return cached

    all_transfers: list[dict[str, Any]] = []

    # 1. Try Mempool.space / Blockstream Esplora REST API
    for api_base in (MEMPOOL_API_BASE, BLOCKSTREAM_API_BASE):
        try:
            async with httpx.AsyncClient(headers=_HEADERS, timeout=4.0) as client:
                resp = await client.get(f"{api_base}/address/{address}/txs")
                if resp.status_code == 200:
                    raw_txs = resp.json()
                    all_transfers = _parse_esplora_txs(raw_txs, address, only_outbound, min_value_btc)
                    break
        except Exception as exc:
            log.debug("Esplora fetch at %s failed for %s: %s", api_base, address, type(exc).__name__)

    # 2. Fallback to Blockchain.info rawaddr API (highly reliable from cloud datacenters)
    if not all_transfers:
        try:
            async with httpx.AsyncClient(headers=_HEADERS, timeout=5.0) as client:
                resp = await client.get(f"https://blockchain.info/rawaddr/{address}?limit=50")
                if resp.status_code == 200:
                    data = resp.json()
                    raw_txs = data.get("txs", [])
                    all_transfers = _parse_blockchain_info_txs(raw_txs, address, only_outbound, min_value_btc)
        except Exception as exc:
            log.warning("Blockchain.info fallback query failed for %s: %s: %s", address, type(exc).__name__, exc)

    log.info("Bitcoin fetch complete: %s -> %d transfer edges", address, len(all_transfers))
    await cache_set(cache_key, all_transfers, ttl=_CACHE_TTL)
    return all_transfers


async def get_btc_balance(address: str) -> float:
    """Fetch current confirmed balance in BTC for a Bitcoin address with multi-provider fallback."""
    # 1. Try Mempool.space / Blockstream
    for api_base in (MEMPOOL_API_BASE, BLOCKSTREAM_API_BASE):
        try:
            async with httpx.AsyncClient(headers=_HEADERS, timeout=3.5) as client:
                resp = await client.get(f"{api_base}/address/{address}")
                if resp.status_code == 200:
                    stats = resp.json().get("chain_stats", {})
                    funded = stats.get("funded_txo_sum", 0)
                    spent = stats.get("spent_txo_sum", 0)
                    satoshis = funded - spent
                    return max(0.0, satoshis / 100_000_000)
        except Exception as exc:
            log.debug("Esplora balance fetch at %s failed for %s: %s", api_base, address, type(exc).__name__)

    # 2. Fallback to Blockchain.info
    try:
        async with httpx.AsyncClient(headers=_HEADERS, timeout=4.0) as client:
            resp = await client.get(f"https://blockchain.info/rawaddr/{address}?limit=1")
            if resp.status_code == 200:
                satoshis = resp.json().get("final_balance", 0)
                return max(0.0, satoshis / 100_000_000)
    except Exception as exc:
        log.debug("Could not fetch Bitcoin balance from Blockchain.info for %s: %s", address, type(exc).__name__)

    return 0.0
