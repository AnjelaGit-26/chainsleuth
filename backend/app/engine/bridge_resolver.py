"""
bridge_resolver.py – Cross-Chain Bridge Monitoring & Hop Resolution Engine.

Resolves cross-chain fund movements across major bridge protocols
(Stargate, Across, Hop, Celer, Wormhole, Connext, Polygon Bridge)
using the Li.Fi Status API and on-chain bridge registry lookups.

When a suspect wallet deposits funds into a bridge contract, this resolver
extracts:
  - The destination chain (e.g. Ethereum -> Polygon / Arbitrum / Solana)
  - The destination transaction hash on the receiving network
  - The recipient / cash-out wallet address on the destination chain
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Any

import httpx

from app.core.database import cache_get, cache_set
from app.models.schemas import TransferEdge
from app.vasp.registry import get_vasp_by_hot_wallet, is_bridge

log = logging.getLogger(__name__)

_LIFI_STATUS_URL = "https://li.quest/v1/status"
_CACHE_TTL = 600  # 10 minutes cache

# Known EVM chain IDs mapped to standard chain identifiers
CHAIN_ID_MAP: dict[int, str] = {
    1: "ethereum",
    10: "optimism",
    56: "bsc",
    137: "polygon",
    8453: "base",
    42161: "arbitrum",
    43114: "avalanche",
    728126428: "tron",
    1151111081099710: "solana",
}


@dataclass
class BridgeHopResult:
    """Forensic result of a cross-chain bridge transfer resolution."""
    source_tx_hash: str
    source_chain: str
    destination_chain: str
    destination_tx_hash: str | None
    recipient_address: str | None
    bridge_tool: str
    status: str  # "COMPLETED", "PENDING", "DETECTED_AT_BRIDGE"
    token_sent: str
    token_received: str
    amount_usd: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


async def resolve_bridge_hop(
    tx_hash: str,
    bridge_contract: str | None = None,
    source_chain_hint: str = "ethereum",
    amount_usd_hint: float | None = None,
    token_hint: str = "USDT",
) -> BridgeHopResult | None:
    """
    Resolve a single transaction hash against the Li.Fi cross-chain status API.
    Falls back to on-chain registry detection if the API does not have the tx.

    Returns:
        BridgeHopResult with receiving network and recipient address, or None.
    """
    if not tx_hash:
        return None

    cache_key = f"bridge:hop:{tx_hash.lower()}"
    cached = await cache_get(cache_key)
    if cached is not None and isinstance(cached, dict):
        return BridgeHopResult(**cached)

    # 1. Query Li.Fi API
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_LIFI_STATUS_URL, params={"txHash": tx_hash})
            if resp.status_code == 200:
                data = resp.json()
                sending = data.get("sending", {})
                receiving = data.get("receiving", {})

                src_chain_id = sending.get("chainId")
                dst_chain_id = receiving.get("chainId")

                src_chain = CHAIN_ID_MAP.get(src_chain_id, source_chain_hint)
                dst_chain = CHAIN_ID_MAP.get(dst_chain_id, "unknown_chain")

                dst_tx = receiving.get("txHash")
                receiver = receiving.get("receiver")
                tool = data.get("tool", "cross_chain_bridge")
                status = "COMPLETED" if data.get("status") == "DONE" else data.get("status", "PENDING")

                token_sent = sending.get("token", {}).get("symbol", token_hint)
                token_recv = receiving.get("token", {}).get("symbol", token_sent)
                amount_usd_str = receiving.get("amountUSD") or sending.get("amountUSD")
                amount_usd = float(amount_usd_str) if amount_usd_str else amount_usd_hint

                result = BridgeHopResult(
                    source_tx_hash=tx_hash,
                    source_chain=src_chain,
                    destination_chain=dst_chain,
                    destination_tx_hash=dst_tx,
                    recipient_address=receiver,
                    bridge_tool=tool,
                    status=status,
                    token_sent=token_sent,
                    token_received=token_recv,
                    amount_usd=amount_usd,
                )
                await cache_set(cache_key, result.to_dict(), ttl=_CACHE_TTL)
                return result
    except Exception as exc:
        log.warning("Li.Fi bridge status query failed for %s: %s", tx_hash, exc)

    # 2. Fallback to registry heuristic if bridge contract is known
    target_addr = bridge_contract or ""
    if is_bridge(target_addr):
        entry = get_vasp_by_hot_wallet(target_addr)
        tool_name = entry.name if entry else "Cross-Chain Liquidity Bridge"
        result = BridgeHopResult(
            source_tx_hash=tx_hash,
            source_chain=source_chain_hint,
            destination_chain="cross_chain_destination",
            destination_tx_hash=None,
            recipient_address=None,
            bridge_tool=tool_name,
            status="DETECTED_AT_BRIDGE",
            token_sent=token_hint,
            token_received=token_hint,
            amount_usd=amount_usd_hint,
        )
        await cache_set(cache_key, result.to_dict(), ttl=_CACHE_TTL)
        return result

    return None


async def scan_edges_for_bridge_hops(
    edges: list[TransferEdge],
    chain_hint: str = "ethereum",
) -> list[BridgeHopResult]:
    """
    Scan trace graph edges and resolve any interactions with cross-chain bridges.
    """
    resolved: list[BridgeHopResult] = []
    for edge in edges:
        if is_bridge(edge.to_address) or is_bridge(edge.from_address):
            contract = edge.to_address if is_bridge(edge.to_address) else edge.from_address
            amt_hint = edge.value if "USD" in edge.token.upper() else None
            res = await resolve_bridge_hop(
                tx_hash=edge.tx_hash,
                bridge_contract=contract,
                source_chain_hint=chain_hint,
                amount_usd_hint=amt_hint,
                token_hint=edge.token,
            )
            if res:
                resolved.append(res)
    return resolved
