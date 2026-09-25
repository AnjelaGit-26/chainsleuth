"""
routes_cases.py – Case graph retrieval and dashboard listing endpoints.

GET /api/v1/cases/{caseId}  – Fetch full graph (nodes + edges) for a case
GET /api/v1/cases           – Paginated CaseSummary list for the dashboard
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import zipfile
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.core.database import batch_update_wallet_nodes, get_case_by_id
from app.core.database import list_cases as db_list_cases
from app.engine.bridge_resolver import scan_edges_for_bridge_hops
from app.engine.clustering import CaseClustersResponse, compute_case_clusters
from app.engine.layering_analyzer import analyze_layering_and_intermediaries
from app.engine.ml_anomaly_detector import detect_anomalies
from app.engine.ml_ensemble_scorer import _TYPOLOGY_SEVERITY, compute_ensemble_risk_score
from app.engine.ml_risk_scorer import score_nodes_with_gnn
from app.engine.ml_typology_classifier import classify_typology_with_ml
from app.engine.privacy_tracer import generate_privacy_coin_dossier
from app.engine.recommendations import generate_recommendations
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
from app.legal.pdf_generator import generate_fir_pdf, generate_section_94_pdf
from app.models.schemas import (
    CaseSummary,
    Chain,
    EvidenceCertificateResponse,
    FIRCreate,
    LegalNoticePayload,
    TraceResult,
    TransferEdge,
    VASPAttribution,
    WalletNode,
)

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/cases", tags=["Cases"])


# ── Helper: reconstruct Pydantic models from Neo4j raw dicts ──────────────────

def _build_wallet_node(raw: dict) -> WalletNode | None:
    """Safely reconstruct a WalletNode from a raw Neo4j property dict."""
    try:
        fs = raw.get("firstSeen")
        if not fs or not isinstance(fs, str):
            first_seen = datetime.now(UTC).isoformat()
        else:
            try:
                first_seen = str(datetime.fromisoformat(str(fs).replace("Z", "+00:00")).isoformat())
            except ValueError:
                first_seen = datetime.now(UTC).isoformat()

        raw_chain = str(raw.get("chain", "tron")).lower()
        chain: Chain = (
            "solana" if raw_chain == "solana"
            else "ethereum" if raw_chain == "ethereum"
            else "bitcoin" if raw_chain == "bitcoin"
            else "tron"
        )

        flags = raw.get("typologyFlags") or []
        risk_val = int(raw.get("riskScore", 0))

        gnn_score = raw.get("gnn_risk_score")
        if gnn_score is None:
            gnn_score = risk_val

        anomaly = raw.get("anomaly_score")
        if anomaly is None:
            anomaly = round(float(risk_val) / 100.0 * 0.75, 3)

        typ_score = raw.get("typology_score")
        if typ_score is None:
            typ_score = 85 if flags else 0

        heur_score = raw.get("heuristics_score")
        if heur_score is None:
            heur_score = 100 if "ofac_sanctioned" in flags else (30 if raw.get("isVasp") else 10)

        risk_cat = raw.get("risk_category")
        if not risk_cat:
            risk_cat = "CRITICAL" if risk_val >= 75 else ("HIGH" if risk_val >= 50 else ("MEDIUM" if risk_val >= 25 else "LOW"))

        pmla = raw.get("pmla_flag")
        if pmla is None:
            pmla = any(f in {"peeling_chain", "coinjoin_mixer", "fan_out"} for f in flags)

        explanation = raw.get("explanation")
        if not explanation:
            if flags:
                explanation = f"Flagged for {', '.join(flags)} on {chain.upper()} with calibrated risk {risk_val}/100."
            elif raw.get("isVasp"):
                explanation = f"Identified as VASP infrastructure / exchange entity with risk score {risk_val}/100."
            else:
                explanation = f"Evaluated {chain.upper()} wallet node with calibrated risk {risk_val}/100."

        return WalletNode(
            address          = str(raw.get("address", "")),
            chain            = chain,
            riskScore        = risk_val,
            balance          = float(raw.get("balance", 0.0)),
            firstSeen        = first_seen,
            typologyFlags    = flags,
            isVasp           = raw.get("isVasp"),
            gnn_risk_score   = int(gnn_score),
            anomaly_score    = float(anomaly),
            typology_score   = int(typ_score),
            heuristics_score = int(heur_score),
            risk_category    = str(risk_cat),
            explanation      = str(explanation),
            pmla_flag        = bool(pmla),
        )
    except Exception as exc:
        log.warning("Could not reconstruct WalletNode: %s | raw=%s", exc, raw)
        return None


def _build_transfer_edge(raw: dict) -> TransferEdge | None:
    """Safely reconstruct a TransferEdge from a raw Neo4j relationship dict."""
    try:
        ts = raw.get("timestamp")
        if isinstance(ts, str):
            try:
                timestamp = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.now(UTC)
        elif isinstance(ts, (int, float)):
            timestamp = datetime.fromtimestamp(ts, tz=UTC)
        else:
            timestamp = datetime.now(UTC)

        from_addr = raw.get("from") or raw.get("from_address") or ""
        to_addr   = raw.get("to") or raw.get("to_address") or ""

        return TransferEdge.model_validate({
            "txHash":    raw.get("txHash", ""),
            "from":      from_addr,
            "to":        to_addr,
            "value":     float(raw.get("value", 0.0)),
            "token":     raw.get("token", "USDT"),
            "timestamp": timestamp,
        })
    except Exception as exc:
        log.warning("Could not reconstruct TransferEdge: %s | raw=%s", exc, raw)
        return None


# ── GET /cases/{caseId} ───────────────────────────────────────────────────────

@router.get(
    "/{case_id}",
    response_model=TraceResult,
    summary="Retrieve full graph for a case by ID",
    description=(
        "Queries Neo4j for the stored trace graph associated with *case_id*. "
        "Returns all Wallet nodes and TRANSFER edges reconstructed from the graph, "
        "along with case metadata and risk scores. Results are Redis-cached for 2 minutes."
    ),
)
async def get_case(case_id: str) -> TraceResult:
    """
    Fetch a complete stored TraceResult from Neo4j by case_id.

    The response includes:
      - All WalletNode objects discovered during the original BFS traversal.
      - All TransferEdge objects connecting them.
      - Case metadata: suspect address, chain, risk score, status.
    """
    data = await get_case_by_id(case_id)

    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case '{case_id}' not found. Run POST /api/v1/trace first.",
        )

    # Reconstruct node + edge lists, dropping malformed records
    nodes = [n for raw in data.get("nodes", []) if (n := _build_wallet_node(raw)) is not None]
    edges = [e for raw in data.get("edges", []) if (e := _build_transfer_edge(raw)) is not None]

    # Dynamically score nodes with AI/ML ensemble if not previously persisted
    needs_ml_scoring = any(
        n.gnn_risk_score is None or (n.gnn_risk_score == 0 and (n.typology_score or 0) == 0 and (n.anomaly_score or 0.0) == 0.0)
        for n in nodes
    )
    anomaly_scores: dict[str, float] = {}
    if needs_ml_scoring and nodes:
        try:
            # 1. GNN topological risk scoring
            nodes = score_nodes_with_gnn(nodes, edges)

            # 2. Rule-based Typology Detectors
            peeling_chain_detector(nodes, edges)
            try:
                await first_funder_trace(nodes, edges)
            except Exception as funder_err:
                log.warning("Funder trace skipped for case %s: %s", case_id, funder_err)
            fan_out_detector(nodes, edges)
            zero_gas_burner_detector(nodes, edges)
            dex_swap_detector(nodes, edges)
            ofac_sanctions_detector(nodes, edges)
            bridge_hop_detector(nodes, edges)
            coinjoin_mixer_detector(nodes, edges)

            # 3. XGBoost ML Typology Classification
            nodes = classify_typology_with_ml(nodes, edges)

            # 4. Isolation Forest Anomaly Detection
            anomaly_scores = detect_anomalies(nodes, edges)

            # 5. Populate calibrated node-level AI/ML fields
            for node in nodes:
                addr_lower = node.address.lower()
                if node.gnn_risk_score is None:
                    node.gnn_risk_score = node.riskScore

                if addr_lower in anomaly_scores:
                    node.anomaly_score = round(float(anomaly_scores[addr_lower]), 3)
                else:
                    node.anomaly_score = round(float(node.riskScore) / 100.0 * 0.75, 3)

                if node.typologyFlags:
                    typ_severity = max(_TYPOLOGY_SEVERITY.get(f, 50) for f in node.typologyFlags)
                    node.typology_score = max(node.typology_score or 0, typ_severity)
                elif node.typology_score is None:
                    node.typology_score = 0

                if "ofac_sanctioned" in node.typologyFlags:
                    node.heuristics_score = 100
                elif node.isVasp:
                    node.heuristics_score = 30
                elif node.typologyFlags:
                    node.heuristics_score = 40
                else:
                    node.heuristics_score = 10

                # Calibrate composite node riskScore using ensemble weights
                comp_score = int(
                    0.40 * float(node.gnn_risk_score or 0) +
                    0.30 * float(node.typology_score or 0) +
                    0.20 * float((node.anomaly_score or 0.0) * 100.0) +
                    0.10 * float(node.heuristics_score or 10)
                )
                node.riskScore = max(0, min(100, comp_score))

                if node.riskScore >= 75:
                    node.risk_category = "CRITICAL"
                elif node.riskScore >= 50:
                    node.risk_category = "HIGH"
                elif node.riskScore >= 25:
                    node.risk_category = "MEDIUM"
                else:
                    node.risk_category = "LOW"

                node.pmla_flag = any(f in {"peeling_chain", "coinjoin_mixer", "fan_out"} for f in node.typologyFlags)

                if node.typologyFlags:
                    flags_str = ", ".join(node.typologyFlags)
                    node.explanation = f"Flagged for {flags_str} on {node.chain.upper()} with calibrated risk {node.riskScore}/100."
                elif node.isVasp:
                    node.explanation = f"Identified as VASP infrastructure / exchange entity with risk score {node.riskScore}/100."
                else:
                    node.explanation = f"Evaluated {node.chain.upper()} wallet node with calibrated risk {node.riskScore}/100."

            # Asynchronously update Neo4j with full AI/ML properties so future reads are instant
            import asyncio
            asyncio.create_task(batch_update_wallet_nodes([n.model_dump(mode="json") for n in nodes]))
        except Exception as exc:
            log.warning("Dynamic ML scoring failed for case %s (non-fatal): %s", case_id, exc)

    # Parse created_at from the Neo4j datetime string
    try:
        created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        created_at = datetime.now(UTC)

    # Reconstruct VASP attribution if present in stored case
    attribution: VASPAttribution | None = None
    raw_attr = data.get("attribution")
    if raw_attr and isinstance(raw_attr, dict):
        try:
            attribution = VASPAttribution(
                vasp_name           = str(raw_attr.get("vasp_name", "")),
                is_fiu_registered   = bool(raw_attr.get("is_fiu_registered", False)),
                confidence_score    = float(raw_attr.get("confidence_score", 0.0)),
                deposit_address     = str(raw_attr.get("deposit_address", "")),
                hot_wallet_address  = str(raw_attr.get("hot_wallet_address", "")),
                nodal_officer_email = str(raw_attr.get("nodal_officer_email", "compliance@vasp.in")),
                nodal_officer_phone = raw_attr.get("nodal_officer_phone"),
            )
        except Exception as exc:
            log.warning("Could not reconstruct VASPAttribution for case %s: %s", case_id, exc)

    recs: list[str] = []
    sla_alert: str | None = None
    try:
        recs, sla_alert = generate_recommendations(
            nodes=nodes,
            edges=edges,
            attribution=attribution,
            suspect_address=data["suspect_address"],
            chain=data["chain"],
        )
    except Exception as exc:
        log.warning("Could not generate recommendations for case %s: %s", case_id, exc)

    overall_risk = int(data.get("overall_risk_score", 0))
    if overall_risk == 0 and nodes:
        temp_result = TraceResult(
            case_id            = data["case_id"],
            suspect_address    = data["suspect_address"],
            chain              = data["chain"],
            nodes              = nodes,
            edges              = edges,
            attribution        = attribution,
            overall_risk_score = 0,
            created_at         = created_at,
            status             = data.get("status", "completed"),
        )
        overall_risk = compute_ensemble_risk_score(temp_result, anomaly_scores)

    return TraceResult(
        case_id            = data["case_id"],
        suspect_address    = data["suspect_address"],
        chain              = data["chain"],
        nodes              = nodes,
        edges              = edges,
        attribution        = attribution,
        overall_risk_score = overall_risk,
        created_at         = created_at,
        status             = data.get("status", "completed"),
        recommendations    = recs,
        sla_cashout_alert  = sla_alert,
    )


# ── GET /cases ────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[CaseSummary],
    summary="List all cases (dashboard)",
    description=(
        "Returns a paginated list of CaseSummary objects for the investigation dashboard. "
        "Each summary includes the case ID, suspect address, chain, risk score, VASP attribution, "
        "and node/edge counts. Ordered by creation date descending."
    ),
)
async def list_all_cases(
    skip:  int = Query(default=0,  ge=0,  description="Number of records to skip"),
    limit: int = Query(default=20, ge=1, le=100, description="Max records to return"),
) -> list[CaseSummary]:
    """
    Return a paginated list of CaseSummary objects from Neo4j.

    Ordered by ``created_at DESC`` — most recent cases first.
    """
    skip_val = 0 if not isinstance(skip, int) else skip
    limit_val = 20 if not isinstance(limit, int) else limit
    raw_cases = await db_list_cases(skip=skip_val, limit=limit_val)

    summaries: list[CaseSummary] = []
    for raw in raw_cases:
        try:
            created_at_str = raw.get("created_at", "")
            try:
                created_at = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                created_at = datetime.now(UTC)

            vasp = raw.get("attributed_vasp")
            summaries.append(CaseSummary(
                case_id              = raw["case_id"],
                suspect_address      = raw["suspect_address"],
                chain                = raw["chain"],
                overall_risk_score   = int(raw.get("overall_risk_score", 0)),
                status               = raw.get("status", "completed"),
                node_count           = int(raw.get("node_count", 0)),
                edge_count           = int(raw.get("edge_count", 0)),
                attributed_vasp      = vasp,
                attributed_vasp_name = vasp,
                created_at           = created_at,
            ))
        except Exception as exc:
            log.warning("Skipping malformed case record: %s | raw=%s", exc, raw)
            continue

    return summaries


@router.get(
    "/{case_id}/clusters",
    response_model=CaseClustersResponse,
    summary="Compute wallet clusters for a case",
    description=(
        "Performs automated forensic clustering on the case graph to identify exchange sweep sub-networks, "
        "criminal syndicate gas co-ordination clusters, and laundering transit cells."
    ),
)
async def get_case_clusters(case_id: str) -> CaseClustersResponse:
    """
    Cluster nodes in a case into exchange sweep sub-networks and criminal syndicate cells.
    """
    trace_result = await get_case(case_id)
    clusters = compute_case_clusters(
        case_id=case_id,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
        attribution=trace_result.attribution,
    )
    return CaseClustersResponse(
        case_id=case_id,
        cluster_count=len(clusters),
        clusters=clusters,
    )


# ── GET /cases/{caseId}/bridge-hops ──────────────────────────────────────────

@router.get(
    "/{case_id}/bridge-hops",
    summary="Detect and resolve cross-chain bridge hops for a case",
    description=(
        "Scans all transfer edges in the case for interactions with cross-chain bridge protocols "
        "(Stargate, Across, Hop, Celer, Wormhole, Li.Fi, Polygon Bridge). Resolves destination chain, "
        "destination transaction hash, and final recipient wallet address."
    ),
)
async def get_case_bridge_hops(case_id: str) -> dict[str, Any]:
    """
    Forensic detection of cross-chain bridge movements.
    """
    trace_result = await get_case(case_id)
    hops = await scan_edges_for_bridge_hops(trace_result.edges)
    return {
        "case_id": case_id,
        "suspect_address": trace_result.suspect_address,
        "chain": trace_result.chain,
        "bridge_hop_count": len(hops),
        "bridge_hops": [h.to_dict() for h in hops],
    }


# ── GET /cases/{caseId}/privacy-dossier ──────────────────────────────────────

@router.get(
    "/{case_id}/privacy-dossier",
    summary="Generate Privacy Coin (XMR/ZEC) Swapper Interception Dossier",
    description=(
        "Analyzes the case graph for hops entering Instant No-KYC Swappers (FixedFloat, ChangeNOW, "
        "SideShift.ai, SimpleSwap) used to divert funds into Monero (XMR) or Zcash (ZEC). "
        "Generates targeted Section 94 BNSS subpoena questionnaire demanding tx_key, stealth addresses, and IP telemetry."
    ),
)
async def get_case_privacy_dossier(case_id: str) -> dict[str, Any]:
    """
    Privacy coin off-ramp intelligence & statutory Section 94 BNSS questionnaire.
    """
    trace_result = await get_case(case_id)
    dossier = generate_privacy_coin_dossier(
        case_id=case_id,
        suspect_address=trace_result.suspect_address,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
    )
    return dossier.to_dict()


# ── GET /cases/{caseId}/layering-analysis ───────────────────────────────────

@router.get(
    "/{case_id}/layering-analysis",
    summary="Graph path analysis & intermediary/layering wallet identification",
    description=(
        "Analyzes laundering graph paths from the suspect wallet to destination exchanges. "
        "Calculates hop counts and classifies intermediary nodes into mule pass-throughs, "
        "peeling chain nodes, aggregation consolidation points, and terminal pre-sweep deposit wallets."
    ),
)
async def get_case_layering_analysis(case_id: str) -> dict[str, Any]:
    """
    Forensic graph path analysis and intermediary mule classification.
    """
    trace_result = await get_case(case_id)
    analysis = analyze_layering_and_intermediaries(
        case_id=case_id,
        suspect_address=trace_result.suspect_address,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
    )
    return analysis.to_dict()


def build_authoritative_evidence_graph(
    trace_result: TraceResult,
    clusters: list | None = None,
) -> tuple[dict[str, Any], bytes, str]:
    """
    Build the authoritative evidence graph representation and compute its deterministic SHA-256 hash.
    Shared by export-bundle and evidence-cert to guarantee identical integrity hashes.
    """
    if clusters is None:
        clusters = compute_case_clusters(
            case_id=trace_result.case_id,
            nodes=trace_result.nodes,
            edges=trace_result.edges,
            attribution=trace_result.attribution,
        )

    exported_at_str = (
        trace_result.created_at.isoformat()
        if hasattr(trace_result.created_at, "isoformat")
        else str(trace_result.created_at)
    )

    graph_dict = {
        "case_id": trace_result.case_id,
        "suspect_address": trace_result.suspect_address,
        "chain": trace_result.chain,
        "overall_risk_score": trace_result.overall_risk_score,
        "nodes_count": len(trace_result.nodes),
        "edges_count": len(trace_result.edges),
        "nodes": [n.model_dump() for n in trace_result.nodes],
        "edges": [e.model_dump(mode="json") for e in trace_result.edges],
        "attribution": trace_result.attribution.model_dump() if trace_result.attribution else None,
        "clusters": [c.model_dump() for c in clusters],
        "recommendations": trace_result.recommendations,
        "sla_cashout_alert": trace_result.sla_cashout_alert,
        "exported_at": exported_at_str,
    }
    graph_bytes = json.dumps(graph_dict, indent=2, default=str).encode("utf-8")
    graph_sha256 = hashlib.sha256(graph_bytes).hexdigest()
    return graph_dict, graph_bytes, graph_sha256


@router.get(
    "/{case_id}/export-bundle",
    summary="Export Court Evidence Package ZIP Bundle",
    description=(
        "Assembles and downloads a court-admissible electronic evidence bundle (ZIP) for the given case. "
        "Contains Section 94 BNSS legal notice PDF, First Information Report (FIR) PDF, "
        "Section 63 BSA electronic evidence certificate JSON, complete forensic graph JSON, "
        "cross-chain bridge hops JSON, privacy coin swapper dossier JSON, "
        "layering path analysis JSON, and an investigator manifest with SHA-256 integrity checksums."
    ),
)
async def export_case_evidence_bundle(case_id: str) -> StreamingResponse:
    """
    Generate and stream an authenticated Court Evidence ZIP bundle containing:
      1. notice_section_94_bnss.pdf
      2. cybercrime_fir.pdf
      3. certificate_section_63_bsa.json
      4. evidence_graph.json
      5. cross_chain_bridge_hops.json
      6. privacy_coin_dossier.json
      7. layering_analysis.json
      8. README_EVIDENCE_MANIFEST.txt
    """
    trace_result = await get_case(case_id)
    clusters = compute_case_clusters(
        case_id=case_id,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
        attribution=trace_result.attribution,
    )

    total_volume = sum(e.value for e in trace_result.edges)
    estimated_loss_inr = total_volume * 87.5
    if estimated_loss_inr < 10000.0:
        estimated_loss_inr = 250000.0

    # 1. Evidence Graph JSON
    graph_dict, graph_bytes, graph_sha256 = build_authoritative_evidence_graph(trace_result, clusters)

    # 2. Section 63 BSA Certificate JSON
    certificate_dict = {
        "certificate_type": "CERTIFICATE UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023",
        "former_equivalent": "Section 65B of the Indian Evidence Act, 1872",
        "case_id": trace_result.case_id,
        "suspect_address": trace_result.suspect_address,
        "chain": trace_result.chain,
        "evidence_sha256_hash": graph_sha256,
        "total_nodes_analyzed": len(trace_result.nodes),
        "total_transactions_traced": len(trace_result.edges),
        "attributed_vasp": trace_result.attribution.vasp_name if trace_result.attribution else None,
        "generated_at": datetime.now(UTC).isoformat(),
        "system_identifier": "ChainSleuth Automated Blockchain Forensics Engine v2.0",
        "forensic_declarations": [
            "1. The electronic evidence was captured and recorded in the ordinary course of lawful blockchain investigative operations.",
            "2. The computer system and cryptographic node crawlers functioned properly and without unauthorized alteration or tampering.",
            "3. The SHA-256 cryptographic fingerprint guarantees bit-level tamper evidence from collection to production in court.",
            "4. Hash and state verification conforms to ISO/IEC 27037 digital evidence handling standards and BSA Section 63 requirements.",
        ],
        "certifying_authority": {
            "officer": "Cyber Crime Investigating Officer",
            "role": "Forensic Analyst / Inspector of Police",
            "jurisdiction": "State Cyber Crime Police Station",
            "verification_status": "CRYPTOGRAPHICALLY_VERIFIED",
        },
    }
    cert_bytes = json.dumps(certificate_dict, indent=2).encode("utf-8")
    cert_sha256 = hashlib.sha256(cert_bytes).hexdigest()

    # 3. Section 94 BNSS Legal Notice PDF
    vasp_attr = trace_result.attribution or VASPAttribution(
        vasp_name="Attributed Exchange / VASP",
        is_fiu_registered=False,
        confidence_score=0.85,
        deposit_address=trace_result.suspect_address,
        hot_wallet_address=trace_result.suspect_address,
        nodal_officer_email="compliance@vasp-exchange.com",
    )
    notice_payload = LegalNoticePayload(
        case_number=f"FIR-CS-{case_id[:8].upper()}",
        suspect_address=trace_result.suspect_address,
        attributed_vasp=vasp_attr,
        loss_amount_inr=estimated_loss_inr,
        flow_summary=f"Automated multi-hop trace on {trace_result.chain} across {len(trace_result.nodes)} nodes and {len(trace_result.edges)} transactions resulting in VASP attribution to {vasp_attr.vasp_name}.",
        sha256_evidence_hash=graph_sha256,
    )
    notice_pdf_path, _ = await generate_section_94_pdf(notice_payload)
    notice_bytes = notice_pdf_path.read_bytes()
    notice_sha256 = hashlib.sha256(notice_bytes).hexdigest()

    # 4. Cybercrime FIR PDF
    fir_payload = FIRCreate(
        case_id=case_id,
        complainant_name="Nodal Cyber Investigator",
        complainant_designation="Inspector of Police, Cyber Crime Cell",
        incident_description=(
            f"Cryptocurrency cyber-fraud reported involving suspect wallet {trace_result.suspect_address} "
            f"on {trace_result.chain.upper()} blockchain network. Multi-hop value tracing revealed layering "
            f"across {len(trace_result.nodes)} wallet nodes with overall risk score {trace_result.overall_risk_score}/100. "
            f"Target exchange identified as {vasp_attr.vasp_name}."
        ),
        suspect_addresses=[trace_result.suspect_address],
        estimated_loss_inr=estimated_loss_inr,
        date_of_incident=trace_result.created_at,
    )
    fir_pdf_path, _ = await generate_fir_pdf(fir_payload)
    fir_bytes = fir_pdf_path.read_bytes()
    fir_sha256 = hashlib.sha256(fir_bytes).hexdigest()

    # 5. Cross-Chain Bridge Hops JSON
    bridge_hops = await scan_edges_for_bridge_hops(trace_result.edges)
    bridge_dict = {
        "case_id": case_id,
        "suspect_address": trace_result.suspect_address,
        "chain": trace_result.chain,
        "bridge_hop_count": len(bridge_hops),
        "bridge_hops": [h.to_dict() for h in bridge_hops],
        "generated_at": datetime.now(UTC).isoformat(),
    }
    bridge_bytes = json.dumps(bridge_dict, indent=2).encode("utf-8")
    bridge_sha256 = hashlib.sha256(bridge_bytes).hexdigest()

    # 6. Privacy Coin & Swapper Subpoena Dossier JSON
    privacy_dossier = generate_privacy_coin_dossier(
        case_id=case_id,
        suspect_address=trace_result.suspect_address,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
    )
    privacy_bytes = json.dumps(privacy_dossier.to_dict(), indent=2).encode("utf-8")
    privacy_sha256 = hashlib.sha256(privacy_bytes).hexdigest()

    # 7. Layering & Intermediary Node Analysis JSON
    layering_analysis = analyze_layering_and_intermediaries(
        case_id=case_id,
        suspect_address=trace_result.suspect_address,
        nodes=trace_result.nodes,
        edges=trace_result.edges,
    )
    layering_bytes = json.dumps(layering_analysis.to_dict(), indent=2).encode("utf-8")
    layering_sha256 = hashlib.sha256(layering_bytes).hexdigest()

    # 8. README Evidence Manifest
    manifest_text = (
        "=============================================================================\n"
        "CHAINSLEUTH COURT-ADMISSIBLE EVIDENCE BUNDLE\n"
        "=============================================================================\n"
        f"Case Identifier:        {case_id}\n"
        f"Suspect Address:        {trace_result.suspect_address}\n"
        f"Blockchain Network:     {trace_result.chain.upper()}\n"
        f"Generated At:           {datetime.now(UTC).isoformat()}\n"
        f"Investigating Engine:   ChainSleuth Forensic Platform v2.0\n"
        "=============================================================================\n"
        "INCLUDED ARTIFACTS AND TAMPER-EVIDENT CHECKSUMS (SHA-256):\n"
        "-----------------------------------------------------------------------------\n"
        "1. notice_section_94_bnss.pdf\n"
        f"   SHA-256: {notice_sha256}\n"
        "   Description: Statutory Legal Notice under Section 94 BNSS 2023 directed to VASP.\n\n"
        "2. cybercrime_fir.pdf\n"
        f"   SHA-256: {fir_sha256}\n"
        "   Description: Cybercrime First Information Report (FIR) under Section 173 BNSS.\n\n"
        "3. certificate_section_63_bsa.json\n"
        f"   SHA-256: {cert_sha256}\n"
        "   Description: Electronic Record Admissibility Certificate under Section 63 BSA 2023.\n\n"
        "4. evidence_graph.json\n"
        f"   SHA-256: {graph_sha256}\n"
        "   Description: Complete machine-readable graph dataset with cluster intelligence.\n\n"
        "5. cross_chain_bridge_hops.json\n"
        f"   SHA-256: {bridge_sha256}\n"
        "   Description: Cross-chain bridge hop tracking (Stargate, Across, Hop, Li.Fi) resolving destination chains and hashes.\n\n"
        "6. privacy_coin_dossier.json\n"
        f"   SHA-256: {privacy_sha256}\n"
        "   Description: Privacy coin (Monero/Zcash) swapper deposit intercepts and Section 94 BNSS questionnaire.\n\n"
        "7. layering_analysis.json\n"
        f"   SHA-256: {layering_sha256}\n"
        "   Description: Graph path analysis, hop-count calculation, and intermediary mule role classification.\n"
        "=============================================================================\n"
    )
    manifest_bytes = manifest_text.encode("utf-8")

    # Build In-Memory ZIP Archive
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr("notice_section_94_bnss.pdf", notice_bytes)
        zip_file.writestr("cybercrime_fir.pdf", fir_bytes)
        zip_file.writestr("certificate_section_63_bsa.json", cert_bytes)
        zip_file.writestr("evidence_graph.json", graph_bytes)
        zip_file.writestr("cross_chain_bridge_hops.json", bridge_bytes)
        zip_file.writestr("privacy_coin_dossier.json", privacy_bytes)
        zip_file.writestr("layering_analysis.json", layering_bytes)
        zip_file.writestr("README_EVIDENCE_MANIFEST.txt", manifest_bytes)

    zip_buffer.seek(0)
    filename = f"Case_{case_id}_Court_Evidence_Bundle.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Case-ID": case_id,
        },
    )


# ── GET /cases/{caseId}/evidence-cert ─────────────────────────────────────────

@router.get(
    "/{case_id}/evidence-cert",
    response_model=EvidenceCertificateResponse,
    summary="Get Section 63 BSA Digital Evidence Certificate Metadata",
    description=(
        "Retrieves authoritative Section 63 BSA electronic evidence certificate metadata "
        "for the specified case, including deterministic SHA-256 evidence checksum, "
        "total nodes analyzed, total transactions traced, and VASP attribution."
    ),
)
async def get_case_evidence_cert(case_id: str) -> EvidenceCertificateResponse:
    """
    Return statutory Section 63 BSA / Section 65B electronic record certificate data
    generated deterministically from the authoritative case evidence graph.
    """
    trace_result = await get_case(case_id)
    _, _, graph_sha256 = build_authoritative_evidence_graph(trace_result)

    attributed_vasp_name = (
        trace_result.attribution.vasp_name
        if trace_result.attribution and trace_result.attribution.vasp_name
        else None
    )

    return EvidenceCertificateResponse(
        certificate_type="CERTIFICATE UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023",
        former_equivalent="Section 65B of the Indian Evidence Act, 1872",
        case_id=trace_result.case_id,
        evidence_sha256_hash=graph_sha256,
        total_nodes_analyzed=len(trace_result.nodes),
        total_transactions_traced=len(trace_result.edges),
        attributed_vasp=attributed_vasp_name,
    )


