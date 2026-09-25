"""
cioh_clusterer.py – Common Input Ownership Heuristic (CIOH) & Advanced Address Clustering.

Implements core forensic blockchain clustering algorithms:
1. Common Input Ownership Heuristic (CIOH) for UTXO / Bitcoin:
   Links all input addresses in a multi-input transaction into a single entity cluster
   under the cryptographic premise of co-signing key authority.
2. VASP Deposit-to-HotWallet Sweep Clustering:
   Groups user-specific deposit addresses consolidating into the same exchange sweep pool.
3. Co-Funding / Syndicate Gas Clustering:
   Clusters burner/mule wallets activated by the same master gas funder.
4. Disjoint-Set Union-Find (DSU) Data Structure:
   Guarantees deterministic, transitive graph clustering across multi-hop transactions.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.schemas import TransferEdge, WalletNode
from app.vasp.registry import get_vasp_by_hot_wallet, is_hot_wallet

log = logging.getLogger(__name__)


# ── Disjoint-Set Union-Find (DSU) ─────────────────────────────────────────────

class DisjointSet:
    """Disjoint-Set Union-Find data structure with path compression and union by rank."""

    def __init__(self) -> None:
        self.parent: dict[str, str] = {}
        self.rank: dict[str, int] = {}

    def make_set(self, x: str) -> None:
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0

    def find(self, x: str) -> str:
        if x not in self.parent:
            self.make_set(x)
            return x
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # Path compression
        return self.parent[x]

    def union(self, x: str, y: str) -> None:
        root_x = self.find(x)
        root_y = self.find(y)
        if root_x == root_y:
            return

        # Union by rank
        if self.rank[root_x] < self.rank[root_y]:
            self.parent[root_x] = root_y
        elif self.rank[root_x] > self.rank[root_y]:
            self.parent[root_y] = root_x
        else:
            self.parent[root_y] = root_x
            self.rank[root_x] += 1

    def get_clusters(self) -> dict[str, list[str]]:
        """Return mapping of root cluster representative -> list of member addresses."""
        clusters: dict[str, list[str]] = {}
        for elem in self.parent:
            root = self.find(elem)
            clusters.setdefault(root, []).append(elem)
        return clusters


# ── Cluster Response Models ───────────────────────────────────────────────────

@dataclass
class ClusteredEntity:
    """Forensically clustered group of wallet addresses."""
    cluster_id: str
    cluster_name: str
    cluster_type: str  # "cioh_btc_cluster", "vasp_sweep_cluster", "syndicate_gas_cluster"
    member_addresses: list[str]
    member_count: int
    total_volume: float
    dominant_risk_score: int
    heuristic_rationale: str
    identified_entity: str | None = None
    tags: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── CIOH & Multi-Heuristic Engine ─────────────────────────────────────────────

def cluster_bitcoin_cioh(
    multi_input_transactions: list[dict[str, Any]],
) -> list[ClusteredEntity]:
    """
    Apply Common Input Ownership Heuristic (CIOH) on a set of Bitcoin multi-input transactions.

    Args:
        multi_input_transactions: List of dicts, each containing:
            - "txid": str
            - "inputs": list[str] (input wallet addresses)
            - "outputs": list[dict] with "address" and "value"
            - "value": float

    Returns:
        List of ClusteredEntity records representing Bitcoin wallet clusters.
    """
    dsu = DisjointSet()
    tx_map: dict[str, list[str]] = {}

    for tx in multi_input_transactions:
        inputs = [inp for inp in tx.get("inputs", []) if isinstance(inp, str) and inp.strip()]
        if len(inputs) > 1:
            first_input = inputs[0]
            dsu.make_set(first_input)
            for other_input in inputs[1:]:
                dsu.make_set(other_input)
                dsu.union(first_input, other_input)
            tx_map[tx.get("txid", "unknown")] = inputs
        elif len(inputs) == 1:
            dsu.make_set(inputs[0])

    raw_clusters = dsu.get_clusters()
    results: list[ClusteredEntity] = []

    for root, members in raw_clusters.items():
        if len(members) < 2:
            continue  # Single-address components are not clusters

        c_id = f"cioh-btc-{abs(hash(root)) % 1000000:06d}"
        results.append(
            ClusteredEntity(
                cluster_id=c_id,
                cluster_name=f"Bitcoin CIOH Co-Spending Cluster ({len(members)} Wallets)",
                cluster_type="cioh_btc_cluster",
                member_addresses=sorted(members),
                member_count=len(members),
                total_volume=0.0,
                dominant_risk_score=75,
                heuristic_rationale=(
                    f"Common Input Ownership Heuristic: {len(members)} input addresses co-signed "
                    f"multi-input Bitcoin transactions, indicating control by the same entity/wallet."
                ),
                tags=["cioh", "bitcoin", "co_spending"],
            )
        )

    return results


def perform_unified_clustering(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
    multi_input_txs: list[dict[str, Any]] | None = None,
) -> list[ClusteredEntity]:
    """
    Perform multi-chain clustering combining:
      1. Bitcoin CIOH (if multi-input txs provided or discovered)
      2. Account-Based VASP Sweep Consolidation
      3. Syndicate Co-funding / Gas Activator Clusters
    """
    clusters: list[ClusteredEntity] = []
    node_map = {n.address.lower(): n for n in nodes}

    # 1. Bitcoin CIOH (if UTXO multi-input data provided)
    if multi_input_txs:
        cioh_clusters = cluster_bitcoin_cioh(multi_input_txs)
        clusters.extend(cioh_clusters)

    # 2. VASP Sweep Clusters (wallets sweeping into exchange hot wallets)
    sweeps_by_hw: dict[str, set[str]] = {}
    volumes_by_hw: dict[str, float] = {}

    for edge in edges:
        to_addr = edge.to_address
        if is_hot_wallet(to_addr):
            hw_key = to_addr.lower()
            sweeps_by_hw.setdefault(hw_key, set()).add(edge.from_address)
            volumes_by_hw[hw_key] = volumes_by_hw.get(hw_key, 0.0) + edge.value

    for hw_addr, senders in sweeps_by_hw.items():
        vasp_entry = get_vasp_by_hot_wallet(hw_addr)
        vasp_name = vasp_entry.name if vasp_entry else "Attributed Exchange"
        all_members = sorted(list(senders)) + [hw_addr]
        scores = [node_map[a.lower()].riskScore for a in senders if a.lower() in node_map]
        dom_risk = max(scores) if scores else 60

        clusters.append(
            ClusteredEntity(
                cluster_id=f"vasp-sweep-{str(uuid4())[:8]}",
                cluster_name=f"{vasp_name} Hot-Wallet Consolidation Sub-Network",
                cluster_type="vasp_sweep_cluster",
                member_addresses=all_members,
                member_count=len(all_members),
                total_volume=round(volumes_by_hw.get(hw_addr, 0.0), 2),
                dominant_risk_score=dom_risk,
                heuristic_rationale=(
                    f"Exchange Sweep Consolidation: {len(senders)} user deposit addresses "
                    f"sweep funds directly into {vasp_name} hot wallet ({hw_addr})."
                ),
                identified_entity=vasp_name,
                tags=["exchange", "sweep", vasp_name.lower().replace(" ", "_")],
            )
        )

    # 3. Syndicate Gas Co-funding Clusters
    funder_nodes = [n for n in nodes if "first_funder_match" in n.typologyFlags]
    if funder_nodes:
        funder_addrs = [n.address for n in funder_nodes]
        burner_mules = [n.address for n in nodes if n.balance <= 0.05 and n.address not in funder_addrs]
        syndicate_members = sorted(list(set(funder_addrs + burner_mules)))

        if len(syndicate_members) > 1:
            clusters.append(
                ClusteredEntity(
                    cluster_id=f"syndicate-gas-{str(uuid4())[:8]}",
                    cluster_name="Criminal Syndicate Gas Co-ordination Cluster",
                    cluster_type="syndicate_gas_cluster",
                    member_addresses=syndicate_members,
                    member_count=len(syndicate_members),
                    total_volume=0.0,
                    dominant_risk_score=90,
                    heuristic_rationale=(
                        f"Co-Funding Heuristic: {len(burner_mules)} disposable burner addresses "
                        f"were activated and gas-funded by a common master activator address."
                    ),
                    identified_entity="Syndicate Gas Funder",
                    tags=["syndicate", "co_funding", "burner_network"],
                )
            )

    return clusters
