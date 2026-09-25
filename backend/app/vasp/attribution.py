"""
attribution.py – VASP attribution with hot-wallet step-back algorithm.

Algorithm (Step-Back):
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Suspect address ──TRANSFER──► Hot Wallet (VASP sweep address)      │
  │                                                                     │
  │  When the trace lands on a known hot wallet, we step back exactly   │
  │  1 hop to the predecessor node. That predecessor is the KYC-linked  │
  │  deposit address that the VASP assigned to the suspect user.        │
  │                                                                     │
  │  suspect ──► deposit_address ──► hot_wallet (VASP)                  │
  │                      ↑                                              │
  │               This is the address with KYC data at the VASP.        │
  └─────────────────────────────────────────────────────────────────────┘

Returns a hydrated VASPAttribution model with the deposit address,
hot wallet, VASP metadata, and confidence score.
"""
from __future__ import annotations

import logging

from app.core.database import create_owned_by_vasp_edge, merge_vasp_node
from app.models.schemas import TransferEdge, VASPAttribution, WalletNode
from app.vasp.registry import VASPEntry, get_vasp_by_hot_wallet, is_hot_wallet

log = logging.getLogger(__name__)

# Confidence score constants
_CONFIDENCE_DIRECT_HIT    = 0.95   # Suspect's immediate next hop is a hot wallet
_CONFIDENCE_INDIRECT_HIT  = 0.75   # Hot wallet found 2+ hops away


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_inbound_index(edges: list[TransferEdge]) -> dict[str, list[TransferEdge]]:
    """
    Build an inbound edge index: to_address → [edges that arrive at that address].

    Used by the step-back algorithm to find the predecessor of a hot wallet.
    """
    index: dict[str, list[TransferEdge]] = {}
    for edge in edges:
        index.setdefault(edge.to_address, []).append(edge)
    return index


def _build_outbound_index(edges: list[TransferEdge]) -> dict[str, list[TransferEdge]]:
    """Build an outbound edge index: from_address → [edges leaving that address]."""
    index: dict[str, list[TransferEdge]] = {}
    for edge in edges:
        index.setdefault(edge.from_address, []).append(edge)
    return index


def _step_back_one_hop(
    hot_wallet_address: str,
    inbound_index: dict[str, list[TransferEdge]],
) -> str | None:
    """
    Step back exactly 1 hop from *hot_wallet_address*.

    Among all predecessor addresses, prefer the one with the highest total
    transfer value (most significant deposit channel).

    Returns the deposit address, or None if no predecessor exists in the graph.
    """
    predecessors = inbound_index.get(hot_wallet_address, [])
    if not predecessors:
        return None

    # Rank predecessors by total value DESC; pick the highest-value sender
    ranked = sorted(predecessors, key=lambda e: e.value, reverse=True)
    return ranked[0].from_address


def _hydrate_vasp_attribution(
    vasp_entry: VASPEntry,
    deposit_address: str,
    hot_wallet_address: str,
    confidence: float,
) -> VASPAttribution:
    """Build a VASPAttribution model from registry data + discovered addresses."""
    return VASPAttribution(
        vasp_name            = vasp_entry.name,
        is_fiu_registered    = vasp_entry.is_fiu_registered,
        confidence_score     = round(confidence, 4),
        deposit_address      = deposit_address,
        hot_wallet_address   = hot_wallet_address,
        nodal_officer_email  = vasp_entry.nodal_officer_email,
        nodal_officer_phone  = vasp_entry.nodal_officer_phone,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Primary attribution entry point
# ─────────────────────────────────────────────────────────────────────────────

async def attribute_vasp(
    suspect_address: str,
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> VASPAttribution | None:
    """
    Run the VASP attribution step-back algorithm over a completed trace graph.

    Steps:
      1. Scan all edges in the trace graph for any ``to_address`` that is a
         known VASP hot wallet (O(1) registry lookup per edge).
      2. When found, step back exactly 1 hop to isolate the deposit address.
      3. Hydrate a ``VASPAttribution`` model.
      4. Persist the VASP node + ``OWNED_BY_VASP`` relationship to Neo4j.
      5. Tag the deposit WalletNode with ``isVasp = True``.

    Priority:
      - A direct hit (suspect → deposit → hot_wallet within 2 hops) is
        returned immediately with confidence 0.95.
      - Deeper hits (3+ hops from suspect) are returned with confidence 0.75.
      - If multiple hot wallets are found, the one closest to the suspect
        (fewest hops in BFS order) is used.

    Args:
        suspect_address: The root address of the trace.
        nodes:           All WalletNode objects from the trace.
        edges:           All TransferEdge objects from the trace.

    Returns:
        A hydrated :class:`VASPAttribution` or ``None`` if no VASP was found.
    """
    inbound_index  = _build_inbound_index(edges)
    outbound_index = _build_outbound_index(edges)
    node_map       = {n.address.lower(): n for n in nodes}

    # ── BFS from suspect to find closest hot wallet ───────────────────────────
    # We track (current_address, depth, path) so we can:
    #   a) stop at the first hot wallet hit (closest = most significant)
    #   b) step back from it using the inbound index

    from collections import deque
    visited:  set[str]                   = {suspect_address.lower()}
    bfs_q:    deque[tuple[str, int]]     = deque([(suspect_address, 0)])
    hit_addr: str | None              = None
    hit_depth: int                       = 0

    while bfs_q:
        current, depth = bfs_q.popleft()

        # Check direct hot-wallet hit
        if is_hot_wallet(current) and current != suspect_address:
            hit_addr  = current
            hit_depth = depth
            log.info(
                "Hot wallet hit: %s (depth=%d) for suspect=%s",
                current, depth, suspect_address,
            )
            break

        # Don't expand beyond what the trace graph contains
        for edge in outbound_index.get(current, []):
            dest = edge.to_address
            if dest.lower() not in visited:
                visited.add(dest.lower())
                bfs_q.append((dest, depth + 1))

    if hit_addr is None:
        log.info("No VASP hot wallet found in trace graph for %s.", suspect_address)
        return None

    # ── Step back 1 hop from hot wallet → deposit address ────────────────────
    deposit_address = _step_back_one_hop(hit_addr, inbound_index)

    if deposit_address is None:
        log.warning(
            "Hot wallet %s found but no predecessor in graph – cannot isolate deposit address.",
            hit_addr,
        )
        return None

    log.info(
        "Step-back resolved: hot_wallet=%s → deposit_address=%s",
        hit_addr, deposit_address,
    )

    # ── Resolve VASP entry ────────────────────────────────────────────────────
    vasp_entry = get_vasp_by_hot_wallet(hit_addr)
    if vasp_entry is None:
        log.error("Hot wallet %s matched but no registry entry found – data inconsistency.", hit_addr)
        return None

    # ── Compute confidence ────────────────────────────────────────────────────
    confidence = _CONFIDENCE_DIRECT_HIT if hit_depth <= 2 else _CONFIDENCE_INDIRECT_HIT

    # ── Hydrate attribution model ─────────────────────────────────────────────
    attribution = _hydrate_vasp_attribution(
        vasp_entry      = vasp_entry,
        deposit_address = deposit_address,
        hot_wallet_address = hit_addr,
        confidence      = confidence,
    )

    # ── Persist to Neo4j (sequential to guarantee node exists before edge) ──
    try:
        await merge_vasp_node(
            name              = vasp_entry.name,
            is_fiu_registered = vasp_entry.is_fiu_registered,
            deposit_address   = deposit_address,
            hot_wallet        = hit_addr,
            nodal_email       = vasp_entry.nodal_officer_email,
        )
        await create_owned_by_vasp_edge(
            wallet_address = deposit_address,
            chain          = nodes[0].chain if nodes else "tron",
            vasp_name      = vasp_entry.name,
        )
    except Exception as exc:
        log.error("Neo4j write failed during VASP attribution: %s", exc)

    # ── Tag deposit wallet node (isVasp = True) ───────────────────────────────
    deposit_node = node_map.get(deposit_address.lower())
    if deposit_node:
        deposit_node.isVasp = True
        log.debug("Tagged deposit node isVasp=True: %s", deposit_address)

    return attribution


# ─────────────────────────────────────────────────────────────────────────────
# Batch attribution (for multi-address case files)
# ─────────────────────────────────────────────────────────────────────────────

async def attribute_nodes(nodes: list[WalletNode]) -> list[WalletNode]:
    """
    Lightweight single-node enrichment pass using the registry hot-wallet index.

    Tags each node's ``isVasp`` field without running the full step-back algorithm.
    Used for quick enrichment of individual nodes (e.g., during BFS expansion).
    """
    for node in nodes:
        if is_hot_wallet(node.address):
            node.isVasp = True
            vasp = get_vasp_by_hot_wallet(node.address)
            if vasp:
                node.typologyFlags = list(set(node.typologyFlags))  # deduplicate
                log.debug("Quick-tagged VASP node: %s → %s", node.address, vasp.name)
    return nodes
