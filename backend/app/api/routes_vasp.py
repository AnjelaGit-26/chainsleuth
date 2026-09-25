"""
routes_vasp.py – VASP / Exchange Identification & Custom Attribution Endpoints.

Provides:
1. GET  /api/v1/vasp/tags/{address} – Unified threat intel + custom label lookup
2. POST /api/v1/vasp/labels        – Create or update an internal custom wallet label
3. GET  /api/v1/vasp/labels        – Search and list internal custom labels
4. POST /api/v1/vasp/enrich        – Bulk import CSV/JSON threat intelligence records
5. POST /api/v1/vasp/cluster       – On-demand CIOH & multi-chain address clustering
"""
from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from app.engine.cioh_clusterer import cluster_bitcoin_cioh, perform_unified_clustering
from app.models.schemas import TransferEdge, WalletNode
from app.vasp.custom_db import CustomWalletLabel, get_custom_vasp_db
from app.vasp.threat_intel import WalletTagResult, tag_wallet

log = logging.getLogger(__name__)
router = APIRouter(prefix="/vasp", tags=["VASP Identification & Threat Intel"])


# ── Pydantic Request Models ───────────────────────────────────────────────────

class CustomLabelCreate(BaseModel):
    """Payload to create or update an internal custom wallet attribution."""
    address: str = Field(..., description="Target cryptocurrency wallet address")
    entity_name: str = Field(..., description="Name of the exchange, syndicate, or entity")
    entity_type: Literal["exchange", "mule", "scam", "mixer", "darknet", "gambling", "seized", "other"] = Field(
        default="exchange",
        description="Category classification",
    )
    chain: str = Field(default="ethereum", description="Blockchain network")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    source: str = Field(default="LE_Investigation", description="Provenance of intelligence")
    case_reference: str | None = Field(default=None, description="Associated FIR / case identifier")
    notes: str | None = Field(default=None, description="Investigator notes or KYC remarks")
    tags: list[str] = Field(default_factory=list, description="Categorization tags")


class BatchJsonEnrichRequest(BaseModel):
    """Batch list of JSON records for continuous attribution enrichment."""
    records: list[CustomLabelCreate]


class ClusterRequest(BaseModel):
    """Payload for on-demand address clustering."""
    nodes: list[WalletNode] = Field(default_factory=list)
    edges: list[TransferEdge] = Field(default_factory=list)
    bitcoin_multi_inputs: list[dict[str, Any]] = Field(default_factory=list)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/tags/{address}",
    response_model=dict[str, Any],
    summary="Look up VASP & Threat Intel tags for an address",
    description=(
        "Queries across internal custom labeled database, commercial threat intel APIs "
        "(TRM Labs, Chainalysis, Elliptic), and curated OSINT VASP registry."
    ),
)
async def get_wallet_tags(
    address: str,
    chain: str = Query(default="ethereum", description="Blockchain network hint"),
) -> dict[str, Any]:
    """
    Returns threat intelligence and exchange attribution for the given address.
    """
    db = get_custom_vasp_db()
    custom_label = db.get_label(address)

    # If present in investigator custom database, return with maximum confidence
    if custom_label:
        return {
            "address": custom_label.address,
            "chain": custom_label.chain,
            "entity_name": custom_label.entity_name,
            "category": custom_label.entity_type,
            "confidence": custom_label.confidence,
            "source": f"custom_agency_db ({custom_label.source})",
            "is_fiu_registered": True if "fiu" in custom_label.tags else False,
            "risk_level": "HIGH" if custom_label.entity_type in {"scam", "mixer", "darknet"} else "LOW",
            "tags": custom_label.tags,
            "case_reference": custom_label.case_reference,
            "notes": custom_label.notes,
            "metadata": {"updated_at": custom_label.updated_at},
        }

    # Query unified threat intelligence engine (Commercial + OSINT)
    tag_result: WalletTagResult = await tag_wallet(address, chain)
    return tag_result.to_dict()


@router.post(
    "/labels",
    summary="Create or update custom wallet label",
    description="Adds an investigator-verified wallet attribution to the internal database.",
)
async def create_custom_label(payload: CustomLabelCreate) -> dict[str, Any]:
    """
    Upsert an internal custom label.
    """
    db = get_custom_vasp_db()
    label = CustomWalletLabel(
        address=payload.address,
        entity_name=payload.entity_name,
        entity_type=payload.entity_type,
        chain=payload.chain,
        confidence=payload.confidence,
        source=payload.source,
        case_reference=payload.case_reference,
        notes=payload.notes,
        tags=payload.tags,
    )
    saved = db.upsert_label(label)
    return {"status": "success", "message": "Custom label stored successfully", "label": saved.to_dict()}


@router.get(
    "/labels",
    summary="Search and list custom wallet labels",
    description="Returns filtered list of internal custom labeled addresses.",
)
async def list_custom_labels(
    query: str = Query(default="", description="Search keyword for address, entity name, or notes"),
    chain: str | None = Query(default=None, description="Filter by blockchain"),
    entity_type: str | None = Query(default=None, description="Filter by category"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """
    Search internal attribution database.
    """
    db = get_custom_vasp_db()
    items = db.search_labels(query=query, chain=chain, entity_type=entity_type, skip=skip, limit=limit)
    total = db.count_labels()
    return {
        "total_records": total,
        "returned_records": len(items),
        "skip": skip,
        "limit": limit,
        "labels": [i.to_dict() for i in items],
    }


@router.post(
    "/enrich",
    summary="Bulk enrich custom attribution database",
    description="Bulk import labeled addresses via JSON payload or CSV file upload.",
)
async def bulk_enrich_database(
    json_payload: BatchJsonEnrichRequest | None = None,
    file: UploadFile | None = File(default=None),
) -> dict[str, Any]:
    """
    Ingest bulk attribution intelligence into the internal database.
    """
    db = get_custom_vasp_db()
    count = 0

    if file:
        content_bytes = await file.read()
        try:
            csv_text = content_bytes.decode("utf-8")
            count = db.bulk_import_csv(csv_text)
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file must be a UTF-8 encoded CSV file.",
            )
    elif json_payload and json_payload.records:
        records = [r.model_dump() for r in json_payload.records]
        count = db.bulk_import_json(records)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either a CSV file upload or a JSON batch records payload.",
        )

    return {
        "status": "success",
        "imported_count": count,
        "message": f"Successfully ingested {count} wallet attribution records into internal database.",
    }


@router.post(
    "/cluster",
    summary="Execute Common Input Ownership Heuristic & Address Clustering",
    description="Clusters provided wallets using Bitcoin CIOH and VASP sweep consolidation heuristics.",
)
async def run_wallet_clustering(payload: ClusterRequest) -> dict[str, Any]:
    """
    Runs multi-chain address clustering (CIOH + Sweep Consolidation).
    """
    clusters = perform_unified_clustering(
        nodes=payload.nodes,
        edges=payload.edges,
        multi_input_txs=payload.bitcoin_multi_inputs,
    )
    return {
        "cluster_count": len(clusters),
        "clusters": [c.to_dict() for c in clusters],
    }
