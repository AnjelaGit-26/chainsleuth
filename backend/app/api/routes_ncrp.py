"""
routes_ncrp.py – Integration endpoints for National Cyber Crime Reporting Portal (NCRP) & SAHYOG.

Capabilities:
  1. POST /api/v1/ncrp/ingest         – Ingest batch complaint records (Ack numbers, fraud categories, wallets, loss).
  2. POST /api/v1/ncrp/batch-trace    – Automated parallel multi-wallet forensic tracing.
  3. GET  /api/v1/ncrp/correlations   – Cross-complaint syndicate discovery (shared gas funders / common deposit targets).
  4. GET  /api/v1/ncrp/categories     – Cyber fraud typology classification metadata.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.core.database import get_session
from app.engine.chain_router import validate_address
from app.engine.traversal import run_bfs_trace
from app.engine.typology import (
    bridge_hop_detector,
    coinjoin_mixer_detector,
    dex_swap_detector,
    fan_out_detector,
    first_funder_trace,
    ofac_sanctions_detector,
    peeling_chain_detector,
    zero_gas_burner_detector,
)
from app.models.schemas import Chain, TraceRequest, TraceResult
from app.vasp.attribution import attribute_vasp

log = logging.getLogger(__name__)
router = APIRouter(prefix="/ncrp", tags=["NCRP / SAHYOG Integration"])


# ── Pydantic DTOs ─────────────────────────────────────────────────────────────

FraudCategory = Literal[
    "Investment Scam",
    "Task-Based Fraud",
    "Sextortion",
    "Phishing",
    "Ransomware",
    "Darknet / Organised Crime",
    "Impersonation Fraud",
]


class NCRPComplaintRecord(BaseModel):
    """A standardized complaint record from NCRP / SAHYOG."""

    acknowledgement_number: str = Field(..., min_length=5, description="NCRP Acknowledgement / Reference Number")
    category: FraudCategory = Field(default="Investment Scam", description="Classification of fraud modus operandi")
    sub_category: str | None = Field(default=None, description="Detailed sub-category")
    complaint_date: datetime = Field(default_factory=lambda: datetime.now(UTC))
    incident_state: str = Field(default="Delhi", description="State / jurisdiction of the reporting victim")
    complainant_name: str = Field(..., min_length=2)
    complainant_contact: str | None = None
    suspect_wallet_address: str = Field(..., min_length=10)
    blockchain: Chain = Field(default="tron")
    reported_loss_inr: float | None = Field(default=None, ge=0)
    complaint_text: str | None = None


class NCRPBatchIngestRequest(BaseModel):
    """Batch ingestion payload from NCRP or SAHYOG portal exports."""

    batch_id: str = Field(default_factory=lambda: f"BATCH-{str(uuid4())[:8]}")
    source_portal: Literal["NCRP", "SAHYOG", "I4C_PORTAL"] = Field(default="NCRP")
    complaints: list[NCRPComplaintRecord] = Field(..., min_length=1)


class IngestedSummaryItem(BaseModel):
    acknowledgement_number: str
    case_id: str
    suspect_address: str
    chain: str
    is_valid_address: bool
    status: str


class NCRPBatchIngestResponse(BaseModel):
    batch_id: str
    source_portal: str
    total_complaints: int
    valid_wallets_count: int
    records: list[IngestedSummaryItem]
    ingested_at: datetime


class SyndicateCorrelationItem(BaseModel):
    correlation_id: str
    correlation_type: Literal["shared_gas_funder", "shared_vasp_deposit", "cross_jurisdiction_syndicate"]
    pivot_address: str
    pivot_entity_label: str
    linked_ncrp_ack_numbers: list[str]
    linked_suspect_addresses: list[str]
    total_aggregate_loss_inr: float
    reporting_states: list[str]
    syndicate_threat_level: Literal["CRITICAL", "HIGH", "MEDIUM"]
    action_recommendation: str


class SyndicateCorrelationsResponse(BaseModel):
    total_correlations: int
    correlations: list[SyndicateCorrelationItem]


# ── In-Memory Ingested Store (complements Neo4j) ──────────────────────────────
_INGESTED_NCRP_STORE: dict[str, NCRPComplaintRecord] = {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/ingest",
    response_model=NCRPBatchIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest batch complaints from NCRP / SAHYOG",
    description=(
        "Accepts structured complaint records exported from India's National Cyber Crime Reporting Portal "
        "(NCRP) or MHA/I4C SAHYOG. Validates wallet addresses and registers investigation references."
    ),
)
async def ingest_ncrp_batch(payload: NCRPBatchIngestRequest) -> NCRPBatchIngestResponse:
    """Validate and register batch cybercrime complaints."""
    records_summary: list[IngestedSummaryItem] = []
    valid_count = 0

    for c in payload.complaints:
        is_valid, detected = validate_address(c.suspect_wallet_address, declared_chain=c.blockchain)
        case_id = f"NCRP-{c.acknowledgement_number}"
        _INGESTED_NCRP_STORE[case_id] = c

        if is_valid:
            valid_count += 1

        records_summary.append(
            IngestedSummaryItem(
                acknowledgement_number=c.acknowledgement_number,
                case_id=case_id,
                suspect_address=c.suspect_wallet_address,
                chain=c.blockchain,
                is_valid_address=is_valid,
                status="queued_for_investigation" if is_valid else "invalid_address_format",
            )
        )

    log.info(
        "NCRP batch ingested: batch_id=%s total=%d valid=%d portal=%s",
        payload.batch_id, len(payload.complaints), valid_count, payload.source_portal,
    )

    return NCRPBatchIngestResponse(
        batch_id=payload.batch_id,
        source_portal=payload.source_portal,
        total_complaints=len(payload.complaints),
        valid_wallets_count=valid_count,
        records=records_summary,
        ingested_at=datetime.now(UTC),
    )


@router.post(
    "/batch-trace",
    response_model=list[TraceResult],
    summary="Execute automated multi-wallet forensic tracing for an NCRP batch",
    description="Runs full BFS tracing, typology detection, and VASP attribution for valid complaints in a batch.",
)
async def batch_trace_ncrp(
    case_ids: list[str],
    max_hops: int = Query(default=3, ge=1, le=5),
) -> list[TraceResult]:
    """Execute automated trace pipelines across multiple NCRP complaint wallets."""
    results: list[TraceResult] = []

    for cid in case_ids:
        complaint = _INGESTED_NCRP_STORE.get(cid)
        if not complaint:
            continue

        is_valid, _ = validate_address(complaint.suspect_wallet_address, declared_chain=complaint.blockchain)
        if not is_valid:
            continue

        try:
            req = TraceRequest(
                suspect_address=complaint.suspect_wallet_address,
                chain=complaint.blockchain,
                max_hops=max_hops,
                value_threshold_pct=2.0,
                complaint_id=cid,
            )
            res = await run_bfs_trace(req)
            peeling_chain_detector(res.nodes, res.edges)
            await first_funder_trace(res.nodes, res.edges)
            fan_out_detector(res.nodes, res.edges)
            zero_gas_burner_detector(res.nodes, res.edges)
            dex_swap_detector(res.nodes, res.edges)
            ofac_sanctions_detector(res.nodes, res.edges)
            bridge_hop_detector(res.nodes, res.edges)
            coinjoin_mixer_detector(res.nodes, res.edges)

            attr = await attribute_vasp(
                suspect_address=complaint.suspect_wallet_address,
                nodes=res.nodes,
                edges=res.edges,
            )
            res = res.model_copy(update={"attribution": attr})
            results.append(res)
        except Exception as exc:
            log.error("Batch trace error on case %s: %s", cid, exc)

    return results


@router.get(
    "/correlations",
    response_model=SyndicateCorrelationsResponse,
    summary="Cross-complaint criminal syndicate discovery",
    description=(
        "Analyzes all ingested NCRP complaints and discovered transaction graphs to identify "
        "inter-state syndicates linked by common gas fee sponsors or shared exchange deposit addresses."
    ),
)
async def get_syndicate_correlations() -> SyndicateCorrelationsResponse:
    """
    Mine cross-complaint connections in Neo4j to find common pivots:
      - Shared gas funder nodes (FEE_FUNDED_BY relationships)
      - Shared VASP deposit nodes (OWNED_BY_VASP relationships)
    """
    correlations: list[SyndicateCorrelationItem] = []

    # Query Neo4j for shared gas funders across multiple distinct suspect roots
    cypher_shared_funders = """
        MATCH (funder:Wallet)<-[:FEE_FUNDED_BY]-(mule:Wallet)
        OPTIONAL MATCH (c:Case)-[:INVESTIGATES]->(mule)
        WITH funder, collect(DISTINCT c.case_id) AS case_ids, collect(DISTINCT mule.address) AS mules
        WHERE size(mules) >= 2 OR size(case_ids) >= 2
        RETURN funder.address AS funder_addr, case_ids, mules
        LIMIT 10
    """

    try:
        async with get_session() as session:
            result = await session.run(cypher_shared_funders)
            records = await result.data()

            for rec in records:
                funder_addr = rec.get("funder_addr", "")
                c_ids = [c for c in rec.get("case_ids", []) if c]
                mules = rec.get("mules", [])

                # Match with ingested NCRP complaints
                linked_acks = []
                total_loss = 0.0
                states = set()
                for cid in c_ids:
                    comp = _INGESTED_NCRP_STORE.get(cid)
                    if comp:
                        linked_acks.append(comp.acknowledgement_number)
                        total_loss += comp.reported_loss_inr or 0.0
                        states.add(comp.incident_state)

                if not linked_acks:
                    linked_acks = [f"NCRP-{c}" for c in c_ids]
                if not states:
                    states = {"Multi-State Coordination"}

                correlations.append(
                    SyndicateCorrelationItem(
                        correlation_id=f"corr-funder-{str(uuid4())[:8]}",
                        correlation_type="shared_gas_funder",
                        pivot_address=funder_addr,
                        pivot_entity_label="Syndicate Master Gas Sponsor",
                        linked_ncrp_ack_numbers=linked_acks,
                        linked_suspect_addresses=mules,
                        total_aggregate_loss_inr=round(total_loss, 2),
                        reporting_states=sorted(list(states)),
                        syndicate_threat_level="CRITICAL",
                        action_recommendation=(
                            f"Syndicate gas activator {funder_addr} connects {len(mules)} distinct suspect wallets "
                            f"across multiple victims. Issue Section 94 BNSS orders across all linked accounts."
                        ),
                    )
                )
    except Exception as exc:
        log.warning("Could not execute syndicate correlation Cypher: %s", exc)

    # Fallback heuristic correlation if DB is sparsely populated in dev
    if not correlations and _INGESTED_NCRP_STORE:
        # Check for matching addresses across stored complaints
        addr_map: dict[str, list[NCRPComplaintRecord]] = {}
        for c in _INGESTED_NCRP_STORE.values():
            addr_map.setdefault(c.suspect_wallet_address.lower(), []).append(c)

        for addr, complaints_list in addr_map.items():
            if len(complaints_list) >= 2:
                total_loss = sum(c.reported_loss_inr or 0.0 for c in complaints_list)
                states = sorted(list({c.incident_state for c in complaints_list}))
                correlations.append(
                    SyndicateCorrelationItem(
                        correlation_id=f"corr-suspect-{str(uuid4())[:8]}",
                        correlation_type="cross_jurisdiction_syndicate",
                        pivot_address=addr,
                        pivot_entity_label="Shared Primary Fraud Collection Address",
                        linked_ncrp_ack_numbers=[c.acknowledgement_number for c in complaints_list],
                        linked_suspect_addresses=[addr],
                        total_aggregate_loss_inr=round(total_loss, 2),
                        reporting_states=states,
                        syndicate_threat_level="CRITICAL",
                        action_recommendation=(
                            f"Same wallet reported across {len(complaints_list)} complaints from {', '.join(states)}. "
                            f"Coordinate multi-state taskforce freeze order via I4C/SAHYOG."
                        ),
                    )
                )

    return SyndicateCorrelationsResponse(
        total_correlations=len(correlations),
        correlations=correlations,
    )
