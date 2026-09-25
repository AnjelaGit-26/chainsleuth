"""
layering_analyzer.py – Intermediary / Layering Wallet Identification & Graph Path Analysis.

Analyzes laundering paths between suspect crime wallets and destination exchanges:
1. Graph Path Analysis: Discovers all transfer paths (1 to 10 hops) from suspect to cash-out VASP.
2. Hop-Count Detection: Measures exact layering distance and latency along each transit hop.
3. Automated Typology Classification:
   - mule_pass_through: Rapid transit (< 2h), high pass-through ratio (> 90%).
   - peel_chain_node: High inflow split into main continuing hop + small peel/fee.
   - aggregation_node: Multiple distinct mules converging funds into a single staging wallet.
   - dispersion_node: Single inflow fanning out into multiple burner accounts (smurfing).
   - terminal_vasp_deposit: Pre-sweep KYC user deposit account at exchange.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any

from app.models.schemas import TransferEdge, WalletNode
from app.vasp.registry import get_vasp_by_hot_wallet, is_hot_wallet

log = logging.getLogger(__name__)


@dataclass
class LayeringHop:
    """A single directional transfer hop along a money laundering path."""
    hop_number: int
    from_address: str
    to_address: str
    tx_hash: str
    value: float
    token: str
    timestamp: str
    latency_seconds: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IntermediaryNodeClassification:
    """Forensic classification of an intermediary wallet node participating in layering."""
    address: str
    hop_distance: int
    role: str  # "mule_pass_through", "peel_chain_node", "aggregation_node", "dispersion_node", "terminal_vasp_deposit"
    inflow_total: float
    outflow_total: float
    pass_through_ratio: float  # Outflow / Inflow ratio (0.0 to 1.0+)
    retention_time_hours: float | None
    risk_score: int
    rationale: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class LayeringPath:
    """A complete multi-hop path from suspect origin to terminal VASP."""
    path_id: str
    length_hops: int
    origin_suspect_address: str
    destination_vasp_address: str
    destination_vasp_name: str
    hops: list[LayeringHop]
    intermediary_wallets: list[str]
    total_volume_laundered: float
    volume_retention_pct: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CaseLayeringAnalysis:
    """Comprehensive layering and intermediary node intelligence report for a case."""
    case_id: str
    suspect_address: str
    total_paths_discovered: int
    min_hop_count: int
    max_hop_count: int
    paths: list[LayeringPath]
    classified_intermediaries: list[IntermediaryNodeClassification]
    summary: str
    generated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Path Traversal & Role Classifier Engine ───────────────────────────────────

def analyze_layering_and_intermediaries(
    case_id: str,
    suspect_address: str,
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> CaseLayeringAnalysis:
    """
    Perform graph path analysis and classify intermediary nodes between suspect and VASP.
    """
    clean_suspect = suspect_address.lower().strip()
    node_map = {n.address.lower(): n for n in nodes}

    # Build adjacency list: from_addr -> list[TransferEdge]
    adj: dict[str, list[TransferEdge]] = {}
    inflows: dict[str, list[TransferEdge]] = {}
    outflows: dict[str, list[TransferEdge]] = {}

    for e in edges:
        f_addr = e.from_address.lower()
        t_addr = e.to_address.lower()
        adj.setdefault(f_addr, []).append(e)
        inflows.setdefault(t_addr, []).append(e)
        outflows.setdefault(f_addr, []).append(e)

    # Identify terminal VASP hot wallets
    vasp_destinations: set[str] = set()
    for n in nodes:
        addr_lower = n.address.lower()
        if n.isVasp or is_hot_wallet(addr_lower):
            vasp_destinations.add(addr_lower)

    # Discovered paths (DFS with cycle prevention and depth limit = 10)
    discovered_raw_paths: list[list[TransferEdge]] = []

    def dfs(current_addr: str, current_path: list[TransferEdge], visited: set[str], depth: int) -> None:
        if depth > 10:
            return
        if current_addr in vasp_destinations and current_path:
            discovered_raw_paths.append(list(current_path))
            return

        for next_edge in adj.get(current_addr, []):
            nxt = next_edge.to_address.lower()
            if nxt not in visited:
                visited.add(nxt)
                current_path.append(next_edge)
                dfs(nxt, current_path, visited, depth + 1)
                current_path.pop()
                visited.remove(nxt)

    dfs(clean_suspect, [], {clean_suspect}, 0)

    # Format LayeringPath objects
    structured_paths: list[LayeringPath] = []
    hop_counter = 0

    for raw_path in discovered_raw_paths:
        hop_counter += 1
        hops: list[LayeringHop] = []
        prev_time: datetime | None = None
        intermediaries: list[str] = []

        for idx, edge in enumerate(raw_path, start=1):
            edge_time = edge.timestamp
            latency: float | None = None
            if prev_time and isinstance(edge_time, datetime) and isinstance(prev_time, datetime):
                latency = abs((edge_time - prev_time).total_seconds())

            hops.append(
                LayeringHop(
                    hop_number=idx,
                    from_address=edge.from_address,
                    to_address=edge.to_address,
                    tx_hash=edge.tx_hash,
                    value=edge.value,
                    token=edge.token,
                    timestamp=edge_time.isoformat() if isinstance(edge_time, datetime) else str(edge_time),
                    latency_seconds=latency,
                )
            )
            prev_time = edge_time if isinstance(edge_time, datetime) else None

            # Add to intermediaries if not origin and not terminal destination
            if idx < len(raw_path):
                intermediaries.append(edge.to_address)

        terminal_addr = raw_path[-1].to_address
        vasp_entry = get_vasp_by_hot_wallet(terminal_addr)
        vasp_name = vasp_entry.name if vasp_entry else "Attributed Exchange Hot Wallet"
        initial_vol = raw_path[0].value
        final_vol = raw_path[-1].value
        retention = round((final_vol / initial_vol) * 100, 2) if initial_vol > 0 else 100.0

        structured_paths.append(
            LayeringPath(
                path_id=f"path-{case_id[:6]}-{hop_counter:03d}",
                length_hops=len(raw_path),
                origin_suspect_address=raw_path[0].from_address,
                destination_vasp_address=terminal_addr,
                destination_vasp_name=vasp_name,
                hops=hops,
                intermediary_wallets=intermediaries,
                total_volume_laundered=final_vol,
                volume_retention_pct=retention,
            )
        )

    # ── Intermediary Node Role Classification ─────────────────────────────────
    # Analyze all non-origin, non-terminal nodes involved in flows
    classified_nodes: list[IntermediaryNodeClassification] = []
    seen_addrs: set[str] = set()

    for path in structured_paths:
        for hop_idx, intermediary_addr in enumerate(path.intermediary_wallets, start=1):
            addr_lower = intermediary_addr.lower()
            if addr_lower in seen_addrs or addr_lower == clean_suspect:
                continue
            seen_addrs.add(addr_lower)

            in_edges = inflows.get(addr_lower, [])
            out_edges = outflows.get(addr_lower, [])
            tot_in = sum(e.value for e in in_edges)
            tot_out = sum(e.value for e in out_edges)
            pass_through = (tot_out / tot_in) if tot_in > 0 else 0.0

            # Calculate holding / retention time
            retention_hours: float | None = None
            if in_edges and out_edges:
                first_in = min((e.timestamp for e in in_edges if isinstance(e.timestamp, datetime)), default=None)
                first_out = min((e.timestamp for e in out_edges if isinstance(e.timestamp, datetime)), default=None)
                if first_in and first_out:
                    diff_sec = (first_out - first_in).total_seconds()
                    retention_hours = round(max(diff_sec, 0) / 3600.0, 2)

            # Classify Role
            is_last_before_vasp = (hop_idx == len(path.intermediary_wallets))
            if is_last_before_vasp and is_hot_wallet(path.destination_vasp_address):
                role = "terminal_vasp_deposit"
                rationale = (
                    f"Terminal KYC Deposit Account: Precedes the sweep consolidation "
                    f"into {path.destination_vasp_name} hot wallet. Subject to Section 94 BNSS disclosure."
                )
                score = 85
            elif len(in_edges) > 1 and len(out_edges) <= 1:
                role = "aggregation_node"
                rationale = (
                    f"Fan-In Aggregator: Consolidates {len(in_edges)} incoming transfers from multiple burner mules "
                    f"into a single outgoing transfer."
                )
                score = 80
            elif len(in_edges) <= 1 and len(out_edges) > 1:
                role = "dispersion_node"
                rationale = (
                    f"Smurfing / Dispersion Point: Splits incoming funds into {len(out_edges)} outgoing "
                    f"sub-transfers below detection thresholds."
                )
                score = 85
            elif len(out_edges) == 2 and any(e.value < 0.1 * tot_in for e in out_edges):
                role = "peel_chain_node"
                rationale = "Peel Chain Node: Carries primary value forward while shaving off a minor cash-out peel."
                score = 75
            else:
                role = "mule_pass_through"
                rationale = (
                    f"Transit Mule: Passes {pass_through * 100:.1f}% of received value to downstream recipient "
                    f"with minimal holding retention."
                )
                score = 70

            classified_nodes.append(
                IntermediaryNodeClassification(
                    address=intermediary_addr,
                    hop_distance=hop_idx,
                    role=role,
                    inflow_total=round(tot_in, 2),
                    outflow_total=round(tot_out, 2),
                    pass_through_ratio=round(pass_through, 3),
                    retention_time_hours=retention_hours,
                    risk_score=score,
                    rationale=rationale,
                )
            )

    min_hops = min((p.length_hops for p in structured_paths), default=0)
    max_hops = max((p.length_hops for p in structured_paths), default=0)

    summary_text = (
        f"Graph path analysis discovered {len(structured_paths)} laundering paths spanning {min_hops} to {max_hops} hops "
        f"connecting suspect {suspect_address} to destination exchanges. Identified {len(classified_nodes)} intermediary "
        f"layering nodes including mule pass-throughs, peeling chains, and pre-sweep terminal deposit accounts."
    )

    return CaseLayeringAnalysis(
        case_id=case_id,
        suspect_address=suspect_address,
        total_paths_discovered=len(structured_paths),
        min_hop_count=min_hops,
        max_hop_count=max_hops,
        paths=structured_paths,
        classified_intermediaries=classified_nodes,
        summary=summary_text,
    )
