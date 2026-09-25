"""
clustering.py – Exchange wallet clustering & criminal syndicate correlation engine.

Implements clustering heuristics for:
  1. VASP Sweep Clusters (wallets depositing into the same exchange sweep pool)
  2. Syndicate Gas Funder Clusters (disposable wallets funded by the same activator)
  3. Layering / Peeling Transit Cells
  4. Smurfing / Fan-Out Dispersion Cells
"""
from __future__ import annotations

import logging
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models.schemas import TransferEdge, VASPAttribution, WalletNode
from app.vasp.registry import get_vasp_by_hot_wallet, is_hot_wallet

log = logging.getLogger(__name__)


# ── Pydantic Models ───────────────────────────────────────────────────────────

ClusterType = Literal["vasp_sweep", "syndicate_gas", "layering_cell", "smurfing_cell", "dex_liquidity"]


class WalletCluster(BaseModel):
    """A cluster of associated wallets grouped by forensic relationship."""

    cluster_id: str = Field(..., description="Unique cluster identifier")
    cluster_type: ClusterType = Field(..., description="Classification category of the cluster")
    label: str = Field(..., description="Human-readable title of the cluster")
    entity_name: str | None = Field(default=None, description="Identified exchange or syndicate name")
    member_addresses: list[str] = Field(..., description="Wallet addresses belonging to this cluster")
    total_volume_usdt: float = Field(default=0.0, description="Aggregate volume transferred by cluster members")
    dominant_risk_score: int = Field(default=0, ge=0, le=100, description="Highest risk score in the cluster")
    description: str = Field(..., description="Forensic rationale for the clustering grouping")


class CaseClustersResponse(BaseModel):
    """Cluster analysis response for a case."""

    case_id: str
    cluster_count: int
    clusters: list[WalletCluster]


# ── Clustering Heuristics ─────────────────────────────────────────────────────

def compute_case_clusters(
    case_id: str,
    nodes: list[WalletNode],
    edges: list[TransferEdge],
    attribution: VASPAttribution | None = None,
) -> list[WalletCluster]:
    """
    Cluster nodes in a case graph using multi-tiered forensic heuristics:

      Tier 1: VASP Sweep Clustering – Groups deposit addresses feeding into the same exchange hot wallet.
      Tier 2: Syndicate Gas Clustering – Groups burner wallets activated by the same master gas funder.
      Tier 3: Layering Cell Clustering – Groups wallets participating in peeling chains.
      Tier 4: Smurfing Cell Clustering – Groups wallets involved in rapid fan-out dispersion.

    Returns:
        List of populated :class:`WalletCluster` objects.
    """
    clusters: list[WalletCluster] = []
    node_map = {n.address.lower(): n for n in nodes}

    # ── 1. VASP Sweep Clusters ────────────────────────────────────────────────
    # Map each hot wallet to all sender addresses that sweep into it
    hot_wallet_sweeps: dict[str, set[str]] = {}
    sweep_volumes: dict[str, float] = {}

    for edge in edges:
        to_addr = edge.to_address
        if is_hot_wallet(to_addr):
            hot_wallet_sweeps.setdefault(to_addr.lower(), set()).add(edge.from_address)
            sweep_volumes[to_addr.lower()] = sweep_volumes.get(to_addr.lower(), 0.0) + edge.value

    for hw_lower, sender_addrs in hot_wallet_sweeps.items():
        vasp_entry = get_vasp_by_hot_wallet(hw_lower)
        vasp_name = vasp_entry.name if vasp_entry else "Unknown Exchange"
        members = sorted(list(sender_addrs))
        # Include the hot wallet itself
        cluster_members = members + [hw_lower]
        member_scores = [node_map[a.lower()].riskScore for a in members if a.lower() in node_map]
        dom_risk = max(member_scores) if member_scores else 60

        clusters.append(
            WalletCluster(
                cluster_id=f"cluster-vasp-{str(uuid4())[:8]}",
                cluster_type="vasp_sweep",
                label=f"{vasp_name} Deposit & Sweep Sub-Network",
                entity_name=vasp_name,
                member_addresses=cluster_members,
                total_volume_usdt=round(sweep_volumes.get(hw_lower, 0.0), 2),
                dominant_risk_score=dom_risk,
                description=(
                    f"Cluster of {len(members)} user deposit accounts sweeping funds into "
                    f"the {vasp_name} hot-wallet sweep address ({hw_lower})."
                ),
            )
        )

    # ── 2. Syndicate Gas Funder Clusters ──────────────────────────────────────
    funder_nodes = [n for n in nodes if "first_funder_match" in n.typologyFlags]
    if funder_nodes:
        funder_addrs = [n.address for n in funder_nodes]
        # Find all zero-balance mules or nodes funded by them
        zero_bal_mules = [n.address for n in nodes if n.balance <= 0.05 and n.address not in funder_addrs]
        syndicate_members = list(set(funder_addrs + zero_bal_mules))

        clusters.append(
            WalletCluster(
                cluster_id=f"cluster-syndicate-{str(uuid4())[:8]}",
                cluster_type="syndicate_gas",
                label="Criminal Syndicate Gas Co-ordinator Cluster",
                entity_name="Syndicate Infrastructure",
                member_addresses=syndicate_members,
                total_volume_usdt=round(sum(e.value for e in edges if e.from_address in syndicate_members), 2),
                dominant_risk_score=90,
                description=(
                    f"Common infrastructure cluster linked by master gas fee sponsor ({funder_addrs[0]}). "
                    f"Controls {len(zero_bal_mules)} disposable transit mules."
                ),
            )
        )

    # ── 3. Layering / Peeling Transit Clusters ────────────────────────────────
    peel_nodes = [n.address for n in nodes if "peeling_chain" in n.typologyFlags]
    if len(peel_nodes) >= 2:
        clusters.append(
            WalletCluster(
                cluster_id=f"cluster-peel-{str(uuid4())[:8]}",
                cluster_type="layering_cell",
                label="Automated Peeling-Chain Layering Cell",
                entity_name="Laundering Transit Conduits",
                member_addresses=peel_nodes,
                total_volume_usdt=round(sum(e.value for e in edges if e.from_address in peel_nodes), 2),
                dominant_risk_score=85,
                description=(
                    f"Linear transit chain of {len(peel_nodes)} addresses executing sequential "
                    f"peel-and-forward splitting to obfuscate source of funds."
                ),
            )
        )

    # ── 4. Smurfing / Fan-Out Clusters ────────────────────────────────────────
    smurf_nodes = [n.address for n in nodes if "fan_out" in n.typologyFlags]
    if smurf_nodes:
        # Include outbound recipient addresses
        smurf_recipients = {e.to_address for e in edges if e.from_address in smurf_nodes}
        all_smurf = list(set(smurf_nodes + list(smurf_recipients)))
        clusters.append(
            WalletCluster(
                cluster_id=f"cluster-smurf-{str(uuid4())[:8]}",
                cluster_type="smurfing_cell",
                label="Structuring / Smurfing Dispersion Cluster",
                entity_name="Dispersion Cell",
                member_addresses=all_smurf,
                total_volume_usdt=round(sum(e.value for e in edges if e.from_address in smurf_nodes), 2),
                dominant_risk_score=80,
                description=(
                    f"High-fanout cluster dispersing capital from {len(smurf_nodes)} root nodes "
                    f"into {len(smurf_recipients)} parallel branches to evade transaction limits."
                ),
            )
        )

    log.info("Clustering complete for case %s: %d clusters identified.", case_id, len(clusters))
    return clusters
