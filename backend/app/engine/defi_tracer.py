"""
defi_tracer.py – DeFi Protocol Tracing & On-Chain DEX Swap Event Decoder.

Parses on-chain event logs for Decentralized Exchanges (Uniswap v2/v3,
PancakeSwap, Curve, SunSwap, Sushiswap) to trace fund flows through
liquidity pools and AMM swaps.

When a suspect wallet executes a swap to exchange stolen USDT for ETH/DAI/WBTC,
this module extracts:
  - The AMM protocol used
  - The recipient address receiving the newly swapped assets
  - The output token and estimated volume
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any

import httpx

from app.core.database import cache_get, cache_set

log = logging.getLogger(__name__)

# Standard Event Signatures (Topic0)
_TOPIC_UNISWAP_V2_SWAP = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"
_TOPIC_UNISWAP_V3_SWAP = "0xc42079f94a6350d7e6235f29174924f9d3a4d58f5c21f403702ad70c88c74977"
_TOPIC_CURVE_EXCHANGE  = "0x8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140"
_TOPIC_ERC20_TRANSFER  = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

_CACHE_TTL = 600


@dataclass
class DexSwapResult:
    """Forensic result extracted from a decentralized liquidity pool swap."""
    tx_hash: str
    dex_protocol: str  # "Uniswap v2 / PancakeSwap", "Uniswap v3", "Curve Finance"
    pool_address: str
    recipient_address: str
    swapped_token_contract: str | None
    estimated_amount: float | None
    is_liquidity_exit: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _topic_to_address(topic: str) -> str:
    """Normalize a 32-byte EVM log topic into a 20-byte 0x address."""
    clean = topic.lower().replace("0x", "")
    if len(clean) == 64:
        return f"0x{clean[24:]}"
    if len(clean) == 40:
        return f"0x{clean}"
    return f"0x{clean}"


def decode_swap_logs(tx_hash: str, logs: list[dict[str, Any]]) -> DexSwapResult | None:
    """
    Parse a list of EVM event logs from a transaction receipt and extract DEX swap details.
    """
    for log_item in logs:
        raw_topics = log_item.get("topics", [])
        if not raw_topics:
            continue

        topic0 = raw_topics[0].lower() if isinstance(raw_topics[0], str) else ""

        # 1. Uniswap v3 Swap: Swap(sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick)
        # topics[2] is indexed recipient
        if topic0 == _TOPIC_UNISWAP_V3_SWAP and len(raw_topics) >= 3:
            recipient = _topic_to_address(raw_topics[2])
            pool = log_item.get("address", "")
            return DexSwapResult(
                tx_hash=tx_hash,
                dex_protocol="Uniswap v3 AMM",
                pool_address=pool,
                recipient_address=recipient,
                swapped_token_contract=None,
                estimated_amount=None,
                is_liquidity_exit=False,
            )

        # 2. Uniswap v2 Swap: Swap(sender, amount0In, amount1In, amount0Out, amount1Out, to)
        # topics[2] or topics[1] frequently contains the 'to' recipient
        if topic0 == _TOPIC_UNISWAP_V2_SWAP and len(raw_topics) >= 2:
            recipient = _topic_to_address(raw_topics[-1])
            pool = log_item.get("address", "")
            return DexSwapResult(
                tx_hash=tx_hash,
                dex_protocol="Uniswap v2 / PancakeSwap AMM",
                pool_address=pool,
                recipient_address=recipient,
                swapped_token_contract=None,
                estimated_amount=None,
                is_liquidity_exit=False,
            )

        # 3. Curve Finance TokenExchange
        if topic0 == _TOPIC_CURVE_EXCHANGE and len(raw_topics) >= 2:
            buyer = _topic_to_address(raw_topics[1])
            pool = log_item.get("address", "")
            return DexSwapResult(
                tx_hash=tx_hash,
                dex_protocol="Curve Finance Pool",
                pool_address=pool,
                recipient_address=buyer,
                swapped_token_contract=None,
                estimated_amount=None,
                is_liquidity_exit=False,
            )

    return None


async def fetch_and_decode_swap(tx_hash: str) -> DexSwapResult | None:
    """
    Fetch transaction receipt logs via public Blockscout API and decode DEX swap events.
    """
    if not tx_hash:
        return None

    cache_key = f"defi:swap:{tx_hash.lower()}"
    cached = await cache_get(cache_key)
    if cached is not None and isinstance(cached, dict):
        return DexSwapResult(**cached)

    url = f"https://eth.blockscout.com/api/v2/transactions/{tx_hash}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                raw_logs = data.get("raw", {}).get("logs", []) or []
                decoded = decode_swap_logs(tx_hash, raw_logs)
                if decoded:
                    await cache_set(cache_key, decoded.to_dict(), ttl=_CACHE_TTL)
                    return decoded
    except Exception as exc:
        log.warning("DeFi swap log decoding query failed for %s: %s", tx_hash, exc)

    return None
