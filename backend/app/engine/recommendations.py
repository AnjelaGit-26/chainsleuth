"""
recommendations.py – Automated investigative recommendations & real-time cash-out SLA engine.

Generates contextual, actionable next steps for Investigating Officers (IOs)
based on detected typologies, VASP attribution, and cash-out window urgency.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime

from app.models.schemas import TransferEdge, VASPAttribution, WalletNode

log = logging.getLogger(__name__)


def generate_recommendations(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
    attribution: VASPAttribution | None,
    suspect_address: str,
    chain: str = "tron",
) -> tuple[list[str], str]:
    """
    Produce an SLA cash-out alert and an ordered list of actionable recommendations for the IO.

    Returns:
        (recommendations, sla_cashout_alert)
    """
    recs: list[str] = []

    # ── 1. Real-time Cash-Out SLA Assessment ──────────────────────────────────
    sla_alert = (
        "NORMAL MONITORING: Transaction activity evaluated. Proceed with standard "
        "investigative documentation."
    )

    if edges:
        # Find latest edge by timestamp
        latest_edge = max(edges, key=lambda e: e.timestamp)
        now_utc = datetime.now(UTC)
        edge_time = latest_edge.timestamp
        if edge_time.tzinfo is None:
            edge_time = edge_time.replace(tzinfo=UTC)

        delta = now_utc - edge_time
        mins_elapsed = max(0, int(delta.total_seconds() / 60))

        if mins_elapsed <= 45:
            sla_alert = (
                f"⚡ CRITICAL 30-MIN CASH-OUT WINDOW: Latest on-chain transfer occurred "
                f"~{mins_elapsed} minutes ago. High probability of immediate P2P/fiat liquidation. "
                f"Serve Section 94 BNSS freeze notice immediately to prevent irreversible loss."
            )
        elif mins_elapsed <= 180:
            hours_elapsed = max(1, mins_elapsed // 60)
            sla_alert = (
                f"⚠️ HIGH URGENCY: Activity recorded ~{hours_elapsed} hours ago. Off-ramp "
                f"settlement may still be pending or locked in exchange holding periods. "
                f"Notify VASP nodal officer immediately."
            )
        else:
            days_elapsed = max(1, mins_elapsed // 1440)
            sla_alert = (
                f"📋 HISTORICAL FLOW: Trail represents movement from ~{days_elapsed} days ago. "
                f"Funds likely swept or off-ramped. Serve Section 94 BNSS production notice "
                f"for complete KYC records, bank accounts, and linked UPI IDs."
            )

    # ── 2. VASP Attribution Directives ────────────────────────────────────────
    if attribution:
        fiu_text = (
            "FIU-IND Registered VASP"
            if attribution.is_fiu_registered
            else "Unregistered / Offshore VASP (Requires Interpol / FIU Escalation)"
        )
        recs.append(
            f"1. SERVE LEGAL FREEZE DIRECTIVE: Issue Section 94 BNSS notice to {attribution.vasp_name} "
            f"({fiu_text}) Nodal Officer at {attribution.nodal_officer_email}. Compel immediate freeze of "
            f"funds on KYC Deposit Address: {attribution.deposit_address}."
        )
        recs.append(
            f"2. REQUISITION KYC & BANK TRAILS: Request full user profile for {attribution.deposit_address} "
            f"from {attribution.vasp_name}, including national ID (Aadhaar/PAN/Passport), registered phone, "
            f"login IP audit trails, and INR bank withdrawal / P2P counterpart accounts."
        )
        recs.append(
            f"3. JURISDICTION NOTICE: Note that {attribution.hot_wallet_address} is a shared hot-wallet "
            f"pool. Direct all asset freeze orders exclusively to deposit address {attribution.deposit_address} "
            f"to prevent legal disputes or erroneous hot-wallet blockage."
        )
    else:
        recs.append(
            "1. EXTEND GRAPH TRAVERSAL: No direct exchange deposit identified within current hop limit. "
            "Increase max_hops or lower value_threshold_pct to track downstream layering."
        )

    # ── 3. Typology-Specific Action Items ─────────────────────────────────────
    # Check for First Funder / Syndicate Gas Funder
    funder_nodes = [
        n.address for n in nodes
        if "first_funder_match" in n.typologyFlags
    ]
    if funder_nodes:
        recs.append(
            f"4. SYNDICATE GAS ACTIVATION LEAD: Mule wallet was activated by funder {funder_nodes[0]}. "
            f"Cross-match this gas funder across NCRP / SAHYOG portals to identify co-linked FIR "
            f"complaints belonging to the same cybercrime syndicate."
        )

    # Check for Peeling Chain / Layering
    peel_nodes = [
        n.address for n in nodes
        if "peeling_chain" in n.typologyFlags
    ]
    if peel_nodes:
        recs.append(
            f"5. PEELING-CHAIN LAYERING DETECTED: {len(peel_nodes)} transit wallets identified "
            f"exhibiting classic peel-chain layering (>85% forward / <15% peel). Evidence of "
            f"automated laundering tumbler script."
        )

    # Check for Fan-Out / Smurfing
    fan_nodes = [
        n.address for n in nodes
        if "fan_out" in n.typologyFlags
    ]
    if fan_nodes:
        recs.append(
            f"6. SMURFING / FAN-OUT STRUCTURE: Address {fan_nodes[0]} split funds across multiple "
            f"parallel outputs to evade AML detection limits. Subpoena logs for all secondary recipients."
        )

    # Check for Zero-Gas Burners
    burner_nodes = [
        n.address for n in nodes
        if "zero_gas_burner" in n.typologyFlags
    ]
    if burner_nodes:
        recs.append(
            f"7. DISPOSABLE BURNER WALLET: Wallet {burner_nodes[0]} operated with zero native gas "
            f"balance as a disposable transit conduit. Subpoena preceding funder and destination exchange."
        )

    # Check for DEX Swap
    dex_nodes = [
        n.address for n in nodes
        if "dex_swap" in n.typologyFlags
    ]
    if dex_nodes:
        recs.append(
            f"8. DEFI / DEX LIQUIDITY SWAP DETECTED: Address {dex_nodes[0]} interacted with a decentralized "
            f"exchange (DEX) pool router. Query on-chain swap events to extract the swapped token contract and recipient address."
        )

    # ── 4. Court Admissibility Protocol ───────────────────────────────────────
    recs.append(
        "9. DIGITAL EVIDENCE PROTOCOL: Generate Section 63 BSA Digital Evidence Certificate and embed "
        "the deterministic SHA-256 integrity seal in the case diary for courtroom admissibility."
    )

    return recs, sla_alert
