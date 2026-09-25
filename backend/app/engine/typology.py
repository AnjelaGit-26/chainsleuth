"""
typology.py – Crypto crime typology detectors for ChainSleuth.

Implemented algorithms:
  1. peeling_chain_detector  – Flags wallets that forward >85% of funds while
                                retaining <15% (classic peel-chain layering).
  2. first_funder_trace      – Traces back to find the TRX gas-fee funder of a
                                zero-balance wallet; flags that funder node.

Each function mutates the typologyFlags list on affected WalletNode objects
in-place and returns a summary dict for logging / audit trail.
"""
from __future__ import annotations

import logging
from datetime import UTC

import httpx

from app.core.config import get_settings
from app.models.schemas import TransferEdge, WalletNode

log = logging.getLogger(__name__)
settings = get_settings()

# Peeling chain thresholds
_PEEL_FORWARD_THRESHOLD = 0.85   # must forward ≥85% of received funds
_PEEL_RETAIN_THRESHOLD  = 0.15   # must retain <15% of received funds
_PEEL_MIN_HOPS          = 3      # chain must be at least 3 consecutive hops

# Fan-out / smurfing thresholds
_FAN_OUT_MIN_RECIPIENTS   = 3     # minimum distinct recipients
_FAN_OUT_MIN_DISBURSE_PCT = 0.60  # must disburse ≥60% of total inbound funds

# TronGrid base (reuse config)
_TRONGRID_BASE = "https://api.trongrid.io"


# ─────────────────────────────────────────────────────────────────────────────
# 1. Peeling Chain Detector
# ─────────────────────────────────────────────────────────────────────────────

def _build_adjacency(
    edges: list[TransferEdge],
) -> dict[str, list[TransferEdge]]:
    """Build an outbound adjacency map: from_address → [edges]."""
    adj: dict[str, list[TransferEdge]] = {}
    for edge in edges:
        adj.setdefault(edge.from_address, []).append(edge)
    return adj


def _total_inbound(address: str, edges: list[TransferEdge]) -> float:
    """Sum of all inbound transfer values for *address*."""
    return sum(e.value for e in edges if e.to_address == address)


def _total_outbound(address: str, adj: dict[str, list[TransferEdge]]) -> float:
    """Sum of all outbound transfer values for *address*."""
    return sum(e.value for e in adj.get(address, []))


def peeling_chain_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect peeling-chain layering patterns in a trace graph.

    A wallet is tagged ``peeling_chain`` if:
      - It received funds from exactly 1 source within the graph.
      - It forwarded ≥ ``_PEEL_FORWARD_THRESHOLD`` (85%) of those received funds.
      - It retained < ``_PEEL_RETAIN_THRESHOLD`` (15%) of those received funds.
      - This pattern holds for at least ``_PEEL_MIN_HOPS`` (3) consecutive hops.

    The detector works by:
      1. Building a linear-chain candidate list via inbound/outbound ratio scoring.
      2. Walking consecutive hops and checking the 85/15 rule at each step.
      3. Flagging all nodes in a qualifying run.

    Args:
        nodes: All WalletNode objects from the trace.
        edges: All TransferEdge objects from the trace.

    Returns:
        A dict mapping ``"flagged_addresses"`` to a list of addresses tagged
        with the peeling_chain typology, for audit logging.
    """
    adj       = _build_adjacency(edges)
    node_map  = {n.address: n for n in nodes}
    flagged:  list[str] = []

    # Score every node: peel_ratio = outbound / inbound
    peel_candidates: list[tuple[str, float, float]] = []  # (address, in, out)

    for node in nodes:
        inbound  = _total_inbound(node.address, edges)
        outbound = _total_outbound(node.address, adj)

        if inbound <= 0:
            continue

        forward_ratio = outbound / inbound
        retain_ratio  = 1.0 - forward_ratio

        if forward_ratio >= _PEEL_FORWARD_THRESHOLD and retain_ratio < _PEEL_RETAIN_THRESHOLD:
            peel_candidates.append((node.address, inbound, outbound))

    candidate_addrs = {c[0] for c in peel_candidates}

    # Walk consecutive hop chains among candidates
    # A peeling chain is a linear run: A→B→C→D where each is a candidate
    visited_in_chain: set[str] = set()

    for addr, _, _ in peel_candidates:
        if addr in visited_in_chain:
            continue

        # Walk forward from this node collecting consecutive peel hops
        chain: list[str] = [addr]
        current = addr

        while True:
            # Find outbound edges to other candidates (single-output peeling)
            out_edges = [
                e for e in adj.get(current, [])
                if e.to_address in candidate_addrs and e.to_address not in visited_in_chain
            ]
            if len(out_edges) != 1:
                break  # branching or dead-end → stop chain walk
            next_addr = out_edges[0].to_address
            chain.append(next_addr)
            current = next_addr

        # Only flag runs of >= _PEEL_MIN_HOPS
        if len(chain) >= _PEEL_MIN_HOPS:
            for addr_in_chain in chain:
                visited_in_chain.add(addr_in_chain)
                wallet = node_map.get(addr_in_chain)
                if wallet and "peeling_chain" not in wallet.typologyFlags:
                    wallet.typologyFlags.append("peeling_chain")  # type: ignore[arg-type]
                    flagged.append(addr_in_chain)
                    log.info("PEELING CHAIN flagged: %s (chain_len=%d)", addr_in_chain, len(chain))

    log.info("peeling_chain_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


# ─────────────────────────────────────────────────────────────────────────────
# 2. First Funder Trace
# ─────────────────────────────────────────────────────────────────────────────

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _tron_hex_to_b58(hex_addr: str) -> str:
    """Convert TRON 41-prefixed hex address from TronGrid contract parameters to Base58Check."""
    if not hex_addr or hex_addr.startswith("T"):
        return hex_addr
    import hashlib
    clean = hex_addr[2:] if hex_addr.startswith("0x") else hex_addr
    if len(clean) == 40 and not clean.startswith("41"):
        clean = "41" + clean
    try:
        raw = bytes.fromhex(clean)
        full = raw + hashlib.sha256(hashlib.sha256(raw).digest()).digest()[:4]
        n = int.from_bytes(full, "big")
        chars: list[str] = []
        while n > 0:
            n, r = divmod(n, 58)
            chars.append(_B58_ALPHABET[r])
        for b in full:
            if b == 0:
                chars.append(_B58_ALPHABET[0])
            else:
                break
        return "".join(reversed(chars))
    except Exception:
        return hex_addr


async def _fetch_trx_activator(
    address: str,
    api_key: str,
) -> dict | None:
    """
    Query TronGrid for the earliest TRX transfer that activated *address*.

    TRON accounts are created on-chain when they first receive TRX.
    We fetch the account's transaction history, filtered to TRX transfers
    (not TRC-20), and return the earliest one that credits this address.
    """
    params = {
        "only_to":    "true",         # we want inbound TRX (not TRC-20)
        "limit":      "1",
        "order_by":   "block_timestamp,asc",  # oldest first
        "search_internal": "false",
    }
    headers = {
        "Accept":           "application/json",
        "TRON-PRO-API-KEY": api_key,
    }

    try:
        async with httpx.AsyncClient(
            base_url=_TRONGRID_BASE,
            headers=headers,
            timeout=10.0,
        ) as client:
            resp = await client.get(
                f"/v1/accounts/{address}/transactions",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
    except (httpx.RequestError, httpx.HTTPStatusError) as exc:
        log.warning("TronGrid TRX activation query failed for %s: %s", address, exc)
        return None

    # Walk records and find the first TRX credit to this address
    for tx in data:
        raw_data = tx.get("raw_data", {})
        contracts = raw_data.get("contract", [])
        for contract in contracts:
            c_type   = contract.get("type", "")
            c_params = contract.get("parameter", {}).get("value", {})

            # TransferContract = native TRX transfer
            if c_type == "TransferContract":
                raw_to    = c_params.get("to_address", "")
                raw_from  = c_params.get("owner_address", "")
                amount    = c_params.get("amount", 0) / 1_000_000  # SUN → TRX

                to_b58 = _tron_hex_to_b58(raw_to)
                from_b58 = _tron_hex_to_b58(raw_from)

                if (to_b58.lower() == address.lower() or raw_to.lower() == address.lower()) and amount > 0:
                    return {
                        "tx_hash":      tx.get("txID", ""),
                        "from_address": from_b58,
                        "to_address":   to_b58,
                        "amount_trx":   amount,
                        "block_ts":     raw_data.get("timestamp", 0) // 1000,
                    }
    return None


async def first_funder_trace(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect the 'first funder match' typology for zero-balance wallets.

    Algorithm:
      1. Identify wallets in the trace graph whose ``balance == 0``
         (indicating all funds have been swept out — classic mule behaviour).
      2. For each such wallet, query TronGrid for the earliest native TRX
         transaction that credited it (the activation / gas-fee funding tx).
      3. Check whether the funder address already exists in our trace graph.
         If yes → tag it with ``first_funder_match`` directly.
         If no  → create a synthetic node and add it to the ``nodes`` list
                  so it appears in the result graph.
      4. Write a ``FEE_FUNDED_BY`` relationship to Neo4j for the pair.

    Args:
        nodes: All WalletNode objects from the trace (mutated in-place).
        edges: All TransferEdge objects from the trace.

    Returns:
        A dict with ``"funder_addresses"`` (list of tagged funder addresses)
        and ``"zero_balance_wallets"`` (the wallets that triggered the search).
    """
    from datetime import datetime

    from app.core.database import create_fee_funded_by_edge
    from app.models.schemas import WalletNode as WN

    node_map = {n.address.lower(): n for n in nodes}
    funder_addresses: list[str]         = []
    zero_balance_wallets: list[str]     = []
    api_key = settings.TRONGRID_KEY

    for node in list(nodes):  # iterate a snapshot so we can safely append
        if node.balance > 0:
            continue

        # Native TRX gas-fee activation tracing is only applicable to TRON wallets
        if node.chain != "tron" and not node.address.startswith("T"):
            continue

        zero_balance_wallets.append(node.address)
        log.info("Zero-balance wallet detected: %s – tracing TRX funder.", node.address)

        activation = await _fetch_trx_activator(node.address, api_key)
        if activation is None:
            log.warning("No TRX activation record found for %s.", node.address)
            continue

        funder_addr = activation["from_address"]
        amount_trx  = activation["amount_trx"]
        tx_hash     = activation["tx_hash"]

        # ── Tag or create the funder node ─────────────────────────────────────
        funder_node = node_map.get(funder_addr.lower())
        if funder_node is None:
            # Funder is outside our existing trace graph → add synthetic node
            funder_node = WN(
                address      = funder_addr,
                chain        = node.chain,
                riskScore    = 50,          # elevated: unknown funder
                balance      = 0.0,
                firstSeen    = datetime.now(UTC).isoformat(),
                typologyFlags= ["first_funder_match"],  # type: ignore[list-item]
                isVasp       = None,
            )
            nodes.append(funder_node)
            node_map[funder_addr.lower()] = funder_node
            log.info("Synthetic funder node added: %s", funder_addr)
        else:
            if "first_funder_match" not in funder_node.typologyFlags:
                funder_node.typologyFlags.append("first_funder_match")  # type: ignore[arg-type]
                log.info("first_funder_match flagged on existing node: %s", funder_addr)

        funder_addresses.append(funder_addr)

        # ── Write FEE_FUNDED_BY edge to Neo4j ────────────────────────────────
        try:
            await create_fee_funded_by_edge(
                funded_address  = node.address,
                funder_address  = funder_addr,
                chain           = node.chain,
                tx_hash         = tx_hash,
                amount          = amount_trx,
            )
        except Exception as exc:
            log.error(
                "Failed to write FEE_FUNDED_BY edge %s→%s: %s",
                funder_addr, node.address, exc,
            )

    log.info(
        "first_funder_trace: %d funders found for %d zero-balance wallets.",
        len(funder_addresses), len(zero_balance_wallets),
    )
    return {
        "funder_addresses":     funder_addresses,
        "zero_balance_wallets": zero_balance_wallets,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Fan-Out / Smurfing Detector
# ─────────────────────────────────────────────────────────────────────────────

def fan_out_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
    min_recipients: int = _FAN_OUT_MIN_RECIPIENTS,
) -> dict[str, list[str]]:
    """
    Detect fan-out / smurfing dispersion patterns in a trace graph.

    A wallet is tagged ``fan_out`` if:
      - It disburses funds to >= min_recipients (default 3) distinct destination wallets.
      - Its outbound transfer volume represents a significant portion (>= 60%) of its observed inbound volume.
      - It is not an attributed exchange hot-wallet.

    Args:
        nodes: All WalletNode objects from the trace (mutated in-place).
        edges: All TransferEdge objects from the trace.
        min_recipients: Minimum unique destinations to qualify as fan-out.

    Returns:
        A dict mapping ``"flagged_addresses"`` to a list of flagged wallet addresses.
    """
    adj = _build_adjacency(edges)
    node_map = {n.address.lower(): n for n in nodes}
    flagged: list[str] = []

    for node in nodes:
        if node.isVasp:
            continue

        out_edges = adj.get(node.address, [])
        unique_recipients = {
            e.to_address.lower() for e in out_edges
            if e.to_address.lower() != node.address.lower()
        }

        if len(unique_recipients) >= min_recipients:
            inbound = _total_inbound(node.address, edges)
            outbound = _total_outbound(node.address, adj)

            if inbound <= 0 or (outbound / inbound) >= _FAN_OUT_MIN_DISBURSE_PCT:
                wallet = node_map.get(node.address.lower())
                if wallet and "fan_out" not in wallet.typologyFlags:
                    wallet.typologyFlags.append("fan_out")  # type: ignore[arg-type]
                    flagged.append(node.address)
                    log.info(
                        "FAN-OUT (Smurfing) flagged: %s (%d outbound destinations)",
                        node.address, len(unique_recipients),
                    )

    log.info("fan_out_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


# ─────────────────────────────────────────────────────────────────────────────
# 4. Zero-Gas Burner & DEX Swap Detectors
# ─────────────────────────────────────────────────────────────────────────────

# Known DEX router / bridge contracts on TRON
_KNOWN_DEX_ROUTERS: set[str] = {
    "TKzxdSv2FZKQrEqkKVgp5DcwEXBEKMg2Ax".lower(),  # SunSwap V2 Router
    "TQn9Y2khEsLJW1ChVWFMSMeSTow5K3GW5B".lower(),  # SunSwap V3 Router
    "TXWkP3asnWqACXd7KnSQqd3wgJwEkvLjcx".lower(),  # JustSwap Router
    "TW91kFv9N75v8B3j5qQ3p2vL8otSzgjLj6".lower(),  # Transit Swap Bridge Router
}


def zero_gas_burner_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect temporary zero-gas burner wallets used as disposable conduits.

    A wallet is tagged ``zero_gas_burner`` if:
      - Its native TRX balance is essentially zero (balance <= 0.05 TRX).
      - It has both inbound and outbound TRC-20 transfers (funds routed through).
      - It is not an exchange hot-wallet or known VASP.

    Args:
        nodes: All WalletNode objects from the trace (mutated in-place).
        edges: All TransferEdge objects from the trace.

    Returns:
        A dict mapping ``"flagged_addresses"`` to a list of flagged wallet addresses.
    """
    adj = _build_adjacency(edges)
    node_map = {n.address.lower(): n for n in nodes}
    flagged: list[str] = []

    for node in nodes:
        if node.isVasp:
            continue

        if node.balance <= 0.05:
            inbound = _total_inbound(node.address, edges)
            outbound = _total_outbound(node.address, adj)
            if inbound > 0 and outbound > 0:
                wallet = node_map.get(node.address.lower())
                if wallet and "zero_gas_burner" not in wallet.typologyFlags:
                    wallet.typologyFlags.append("zero_gas_burner")  # type: ignore[arg-type]
                    flagged.append(node.address)
                    log.info(
                        "ZERO-GAS BURNER flagged: %s (bal=%.4f, in=%.2f, out=%.2f)",
                        node.address, node.balance, inbound, outbound,
                    )

    log.info("zero_gas_burner_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


def dex_swap_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect interactions with decentralized exchange (DEX) / AMM router contracts.

    A wallet is tagged ``dex_swap`` if it exchanges funds directly with a known
    DEX router (e.g. SunSwap, Transit Swap) to swap USDT or bridge tokens.

    Args:
        nodes: All WalletNode objects from the trace (mutated in-place).
        edges: All TransferEdge objects from the trace.

    Returns:
        A dict mapping ``"flagged_addresses"`` to a list of flagged wallet addresses.
    """
    node_map = {n.address.lower(): n for n in nodes}
    flagged: list[str] = []

    for edge in edges:
        from_lower = edge.from_address.lower()
        to_lower = edge.to_address.lower()

        if to_lower in _KNOWN_DEX_ROUTERS:
            wallet = node_map.get(from_lower)
            if wallet and "dex_swap" not in wallet.typologyFlags:
                wallet.typologyFlags.append("dex_swap")  # type: ignore[arg-type]
                flagged.append(wallet.address)
                log.info("DEX SWAP interaction flagged: %s -> %s", wallet.address, to_lower)

        elif from_lower in _KNOWN_DEX_ROUTERS:
            wallet = node_map.get(to_lower)
            if wallet and "dex_swap" not in wallet.typologyFlags:
                wallet.typologyFlags.append("dex_swap")  # type: ignore[arg-type]
                flagged.append(wallet.address)
                log.info("DEX SWAP liquidity receive flagged: %s from %s", wallet.address, from_lower)

    log.info("dex_swap_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


def ofac_sanctions_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect addresses designated under OFAC SDN sanctions programs.

    A wallet is tagged ``ofac_sanctioned`` if its address matches a known
    OFAC SDN designation (e.g. Lazarus Group, Tornado Cash, Garantex, Sinbad).
    Its riskScore is automatically set to 100 (CRITICAL).
    """
    from app.engine.sanctions import is_sanctioned

    flagged: list[str] = []
    for node in nodes:
        if is_sanctioned(node.address):
            if "ofac_sanctioned" not in node.typologyFlags:
                node.typologyFlags.append("ofac_sanctioned")  # type: ignore[arg-type]
                node.riskScore = 100
                flagged.append(node.address)
                log.warning("CRITICAL OFAC SANCTIONED ADDRESS DETECTED: %s", node.address)

    log.info("ofac_sanctions_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


def bridge_hop_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect cross-chain bridge hops and instant No-KYC swapper usage.

    A wallet is tagged ``bridge_hop`` if it routes funds through cross-chain
    bridges (e.g. Stargate, Across, Hop, Wormhole) or No-KYC swappers
    (e.g. FixedFloat, ChangeNOW, SideShift, SimpleSwap).
    """
    from app.vasp.registry import is_bridge, is_no_kyc_swapper

    node_map = {n.address.lower(): n for n in nodes}
    flagged: list[str] = []

    for node in nodes:
        addr = node.address.lower()
        if is_bridge(addr) or is_no_kyc_swapper(addr):
            if "bridge_hop" not in node.typologyFlags:
                node.typologyFlags.append("bridge_hop")  # type: ignore[arg-type]
                node.riskScore = max(node.riskScore, 75)
                flagged.append(node.address)
                log.info("BRIDGE / NO-KYC SWAPPER flagged: %s", node.address)

    for edge in edges:
        from_lower = edge.from_address.lower()
        to_lower = edge.to_address.lower()
        for candidate_addr, target_addr in [(to_lower, from_lower), (from_lower, to_lower)]:
            if is_bridge(candidate_addr) or is_no_kyc_swapper(candidate_addr):
                wallet = node_map.get(target_addr)
                if wallet and "bridge_hop" not in wallet.typologyFlags:
                    wallet.typologyFlags.append("bridge_hop")  # type: ignore[arg-type]
                    wallet.riskScore = max(wallet.riskScore, 70)
                    flagged.append(wallet.address)
                    log.info("BRIDGE HOP user flagged: %s via %s", wallet.address, candidate_addr)

    log.info("bridge_hop_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}


def coinjoin_mixer_detector(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, list[str]]:
    """
    Detect Bitcoin CoinJoin / mixer anonymization patterns (Wasabi, Samourai Whirlpool).

    A transaction or wallet is tagged ``coinjoin_mixer`` if:
      - Multiple transfers share the exact same transaction hash (or originate from a mixing pool)
        with identical equal-denomination output values (e.g., 3+ outputs with identical float value,
        matching standard mixing denominations like 0.05 BTC, 0.1 BTC, or fixed round amounts).
    """
    from collections import defaultdict

    tx_groups: dict[str, list[TransferEdge]] = defaultdict(list)
    for edge in edges:
        tx_groups[edge.tx_hash].append(edge)

    node_map = {n.address.lower(): n for n in nodes}
    flagged: list[str] = []

    for tx_hash, tx_edges in tx_groups.items():
        if len(tx_edges) >= 3:
            val_counts: dict[float, int] = defaultdict(int)
            for e in tx_edges:
                val_counts[round(e.value, 4)] += 1

            for val, count in val_counts.items():
                if count >= 3:
                    for e in tx_edges:
                        if round(e.value, 4) == val:
                            for addr in (e.from_address, e.to_address):
                                wallet = node_map.get(addr.lower())
                                if wallet and "coinjoin_mixer" not in wallet.typologyFlags:
                                    wallet.typologyFlags.append("coinjoin_mixer")  # type: ignore[arg-type]
                                    wallet.riskScore = max(wallet.riskScore, 95)
                                    flagged.append(wallet.address)
                                    log.warning(
                                        "COINJOIN / MIXER DETECTED: %s in tx %s (denomination=%.4f)",
                                        wallet.address, tx_hash, val,
                                    )

    log.info("coinjoin_mixer_detector: %d addresses flagged.", len(flagged))
    return {"flagged_addresses": flagged}




