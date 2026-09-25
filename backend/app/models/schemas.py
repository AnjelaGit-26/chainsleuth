"""
schemas.py – Strict Pydantic v2 models for ChainSleuth.

All models use explicit Field validations, Literal types, and aliases
where the JSON key differs from the Python attribute name.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── 1. Chain ─────────────────────────────────────────────────────────────────

Chain = Literal["tron", "solana", "ethereum", "bitcoin"]


# ── 2. TypologyFlag ──────────────────────────────────────────────────────────

TypologyFlag = Literal[
    "peeling_chain",
    "fan_out",
    "zero_gas_burner",
    "first_funder_match",
    "dex_swap",
    "ofac_sanctioned",
    "bridge_hop",
    "coinjoin_mixer",
    "burner_wallet",
]


# ── 3. TraceRequest ───────────────────────────────────────────────────────────

class TraceRequest(BaseModel):
    """Payload for initiating a blockchain address trace."""

    suspect_address: str = Field(
        ...,
        min_length=10,
        description="Blockchain wallet address under investigation",
    )
    chain: Chain = Field(
        ...,
        description="Blockchain network: 'tron', 'solana', or 'ethereum'",
    )
    max_hops: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum graph traversal depth (1–10)",
    )
    value_threshold_pct: float = Field(
        default=2.0,
        gt=0.0,
        le=100.0,
        description="Minimum transfer value as % of root balance to include in graph",
    )
    complaint_id: str | None = Field(
        default=None,
        description="Optional FIR / complaint reference ID to link this trace",
    )

    @field_validator("suspect_address")
    @classmethod
    def strip_address(cls, v: str) -> str:
        return v.strip()


# ── 4. WalletNode ─────────────────────────────────────────────────────────────

class WalletNode(BaseModel):
    """A single wallet node in the transaction graph."""

    address: str = Field(..., description="On-chain wallet address")
    chain: Chain = Field(..., description="Blockchain the wallet belongs to")
    riskScore: int = Field(
        ...,
        ge=0,
        le=100,
        description="Composite risk score between 0 (clean) and 100 (critical)",
    )
    balance: float = Field(
        ...,
        ge=0.0,
        description="Current balance in the native token (e.g. TRX / SOL / ETH)",
    )
    firstSeen: str = Field(
        ...,
        description="ISO-8601 datetime string of the wallet's first observed transaction",
    )
    typologyFlags: list[TypologyFlag] = Field(
        default_factory=list,
        description="List of detected crime typology patterns for this wallet",
    )
    isVasp: bool | None = Field(
        default=None,
        description="True if this wallet belongs to a known VASP / exchange",
    )
    gnn_risk_score: int | None = Field(
        default=None,
        description="GraphSAGE GNN topological risk score (0-100)",
    )
    anomaly_score: float | None = Field(
        default=None,
        description="Isolation Forest anomaly index (0.0 to 1.0)",
    )
    typology_score: int | None = Field(
        default=None,
        description="XGBoost typology severity score (0-100)",
    )
    heuristics_score: int | None = Field(
        default=None,
        description="Heuristic rules score (0-100)",
    )
    risk_category: str | None = Field(
        default=None,
        description="Risk tier: LOW, MEDIUM, HIGH, CRITICAL",
    )
    explanation: str | None = Field(
        default=None,
        description="Forensic explanation of why this wallet was flagged",
    )
    pmla_flag: bool | None = Field(
        default=None,
        description="True if detected behavior constitutes a PMLA 2002 predicate offense",
    )

    @field_validator("firstSeen")
    @classmethod
    def validate_iso_datetime(cls, v: str) -> str:
        """Ensure firstSeen is a valid ISO-8601 datetime string."""
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"firstSeen must be a valid ISO-8601 datetime string, got: '{v}'")
        return v


# ── 5. TransferEdge ───────────────────────────────────────────────────────────

class TransferEdge(BaseModel):
    """A directional on-chain transfer between two wallets."""

    model_config = ConfigDict(populate_by_name=True)

    txHash: str = Field(..., description="On-chain transaction hash")
    from_address: str = Field(
        ...,
        alias="from",
        description="Sender wallet address",
    )
    to_address: str = Field(
        ...,
        alias="to",
        description="Recipient wallet address",
    )
    value: float = Field(
        ...,
        ge=0.0,
        description="Transfer amount in the specified token",
    )
    token: str = Field(
        ...,
        min_length=1,
        description="Token symbol / contract identifier (e.g. 'USDT', 'TRX')",
    )
    timestamp: datetime = Field(
        ...,
        description="UTC datetime when the transaction was confirmed on-chain",
    )

    @property
    def tx_hash(self) -> str:
        """Alias property for txHash."""
        return self.txHash


# ── 6. VASPAttribution ───────────────────────────────────────────────────────

class VASPAttribution(BaseModel):
    """Attribution details for a Virtual Asset Service Provider (VASP / exchange)."""

    vasp_name: str = Field(
        ...,
        min_length=1,
        description="Legal / trade name of the VASP (e.g. 'Binance', 'WazirX')",
    )
    is_fiu_registered: bool = Field(
        ...,
        description="Whether the VASP is registered with India's FIU-IND",
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Attribution confidence from 0.0 (uncertain) to 1.0 (certain)",
    )
    deposit_address: str = Field(
        ...,
        description="Suspect's deposit address at the VASP",
    )
    hot_wallet_address: str = Field(
        ...,
        description="VASP's identified hot wallet address",
    )
    nodal_officer_email: str = Field(
        ...,
        description="Email address of the VASP's designated nodal / compliance officer",
    )
    nodal_officer_phone: str | None = Field(
        default=None,
        description="Phone number of the VASP's nodal officer (optional)",
    )


# ── 7. TraceResult ────────────────────────────────────────────────────────────

class TraceResult(BaseModel):
    """Full result of a completed blockchain trace operation."""

    case_id: str = Field(..., description="Unique case / investigation identifier")
    suspect_address: str = Field(..., description="Root address that was traced")
    chain: Chain = Field(..., description="Blockchain network the trace ran on")
    nodes: list[WalletNode] = Field(
        default_factory=list,
        description="All wallet nodes discovered during traversal",
    )
    edges: list[TransferEdge] = Field(
        default_factory=list,
        description="All transfer edges connecting the discovered nodes",
    )
    attribution: VASPAttribution | None = Field(
        default=None,
        description="VASP attribution for the suspect address, if resolved",
    )
    overall_risk_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Aggregated risk score for the entire trace graph (0–100)",
    )
    created_at: datetime = Field(
        ...,
        description="UTC datetime when this trace result was generated",
    )
    status: str = Field(
        ...,
        description="Trace lifecycle status (e.g. 'pending', 'completed', 'failed')",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Automated actionable recommendations and next steps for the IO",
    )
    sla_cashout_alert: str | None = Field(
        default=None,
        description="Real-time alert indicating cash-out SLA urgency and timeline",
    )


# ── 8. LegalNoticePayload ─────────────────────────────────────────────────────

class LegalNoticePayload(BaseModel):
    """Payload used to generate a legal notice addressed to a VASP."""

    case_number: str = Field(
        ...,
        min_length=1,
        description="Official FIR / case reference number",
    )
    suspect_address: str = Field(
        ...,
        description="On-chain address of the suspect named in the notice",
    )
    attributed_vasp: VASPAttribution = Field(
        ...,
        description="Full VASP attribution details for the notice recipient",
    )
    loss_amount_inr: float = Field(
        ...,
        gt=0.0,
        description="Estimated financial loss in Indian Rupees (INR)",
    )
    flow_summary: str = Field(
        ...,
        min_length=10,
        description="Human-readable summary of the transaction flow for the notice body",
    )
    sha256_evidence_hash: str = Field(
        ...,
        min_length=64,
        max_length=64,
        description="SHA-256 hex digest of the evidence bundle for chain-of-custody",
    )

    @field_validator("sha256_evidence_hash")
    @classmethod
    def validate_sha256_hex(cls, v: str) -> str:
        """Ensure the hash is a valid lowercase 64-char hex string."""
        if not all(c in "0123456789abcdef" for c in v.lower()):
            raise ValueError("sha256_evidence_hash must be a valid hexadecimal string")
        return v.lower()


# ── 9. FIRCreate / FIRResponse ────────────────────────────────────────────────

class FIRCreate(BaseModel):
    """Payload for generating a blockchain FIR document."""

    case_id: str = Field(..., description="Investigation case identifier")
    complainant_name: str = Field(..., min_length=2)
    complainant_designation: str = Field(..., min_length=2)
    incident_description: str = Field(..., min_length=20)
    suspect_addresses: list[str] = Field(default_factory=list)
    estimated_loss_inr: float | None = Field(default=None, gt=0)
    date_of_incident: datetime


class FIRResponse(BaseModel):
    """Response after FIR document generation."""

    fir_id: str = Field(..., description="Unique FIR document ID")
    case_id: str
    fir_number: str
    complainant_name: str
    incident_description: str
    suspect_addresses: list[str]
    estimated_loss_inr: float | None = None
    date_of_incident: datetime
    generated_at: datetime
    pdf_url: str | None = None


# ── 10. CaseSummary (dashboard list item) ────────────────────────────────────

class CaseSummary(BaseModel):
    """Lightweight case summary for dashboard listing."""

    case_id: str
    suspect_address: str
    chain: Chain
    overall_risk_score: int = Field(..., ge=0, le=100)
    status: str
    node_count: int = Field(default=0, ge=0)
    edge_count: int = Field(default=0, ge=0)
    attributed_vasp: str | None = None
    attributed_vasp_name: str | None = None
    created_at: datetime


# ── 11. EvidenceCertificateResponse ──────────────────────────────────────────

class EvidenceCertificateResponse(BaseModel):
    """
    Electronic record admissibility certificate metadata under Section 63 BSA 2023
    (formerly Section 65B of the Indian Evidence Act, 1872).
    """

    certificate_type: str = Field(
        ...,
        description="Statutory certificate designation under Indian evidence law",
    )
    former_equivalent: str = Field(
        ...,
        description="Historical statutory equivalent under the Indian Evidence Act",
    )
    case_id: str = Field(
        ...,
        description="Investigation case identifier",
    )
    evidence_sha256_hash: str = Field(
        ...,
        description="Deterministic SHA-256 cryptographic checksum of authoritative evidence",
    )
    total_nodes_analyzed: int = Field(
        ...,
        ge=0,
        description="Total unique wallet nodes analyzed in the investigation graph",
    )
    total_transactions_traced: int = Field(
        ...,
        ge=0,
        description="Total transfer transactions traced on the blockchain",
    )
    attributed_vasp: str | None = Field(
        default=None,
        description="Authoritative VASP attribution name, or null if unassigned / non-custodial",
    )

