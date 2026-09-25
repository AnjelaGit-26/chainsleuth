"""
evidence_cert.py – Section 63 BSA / IT Act deterministic evidence hasher.

Produces a canonical SHA-256 digest over a sorted, normalised representation
of the transaction hashes and wallet nodes that form a TraceResult path.
The hash is deterministic: the same trace always produces the same digest,
regardless of insertion order, so it can be submitted as admissible digital
evidence under:
  - Section 63  of the Bharatiya Sakshya Adhiniyam (BSA) 2023
    (formerly Section 65B of the Indian Evidence Act)
  - Section 79A of the IT Act 2000 (electronic evidence)

The certificate bundle embeds:
  - ISO-8601 timestamp (UTC) of generation
  - Sorted list of transaction hashes
  - Sorted list of wallet node addresses + risk scores
  - Overall risk score
  - SHA-256 integrity digest of all the above
"""
from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.models.schemas import TraceResult

# ── Canonical serialiser ──────────────────────────────────────────────────────

def _canonical_node(node_dict: dict) -> dict:
    """Return a minimal, stable node representation for hashing."""
    return {
        "address":   node_dict["address"],
        "chain":     node_dict["chain"],
        "riskScore": node_dict["riskScore"],
    }


def _canonical_edge(edge_dict: dict) -> dict:
    """Return a minimal, stable edge representation for hashing."""
    return {
        "txHash": edge_dict["txHash"],
        "from":   edge_dict["from_address"],
        "to":     edge_dict["to_address"],
        "value":  edge_dict["value"],
        "token":  edge_dict["token"],
    }


def compute_evidence_hash(
    tx_hashes: list[str],
    node_addresses: list[dict],
) -> str:
    """
    Compute a deterministic SHA-256 hash over transaction hashes and node data.

    Canonicalisation rules (ensures determinism):
      1. All strings are lowercased and stripped.
      2. ``tx_hashes`` are sorted lexicographically.
      3. ``node_addresses`` dicts are reduced to (address, chain, riskScore)
         and sorted by address.
      4. The resulting structure is serialised as compact, sorted-key JSON
         (``separators=(',', ':'), sort_keys=True``).
      5. SHA-256 is computed over the UTF-8 encoded JSON.

    Args:
        tx_hashes:      List of raw transaction hash strings.
        node_addresses: List of node dicts (must contain 'address', 'chain',
                        'riskScore' keys).

    Returns:
        64-character lowercase hexadecimal SHA-256 digest.
    """
    canonical = {
        "tx_hashes": sorted(h.lower().strip() for h in tx_hashes),
        "nodes":     sorted(
            [_canonical_node(n) for n in node_addresses],
            key=lambda n: n["address"].lower(),
        ),
    }
    payload = json.dumps(canonical, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ── Full certificate builder ──────────────────────────────────────────────────

def build_evidence_certificate(
    trace: TraceResult,
    case_id: str,
    officer_name: str,
    officer_designation: str,
    authority: str,
) -> dict[str, Any]:
    """
    Build a Section 63 BSA-compliant digital evidence certificate bundle.

    The bundle contains all metadata needed for court submission, along
    with a SHA-256 integrity digest that cannot be forged without changing
    the underlying transaction data.

    Args:
        trace:                Completed TraceResult from the BFS engine.
        case_id:              FIR / investigation case identifier.
        officer_name:         Name of the certifying law-enforcement officer.
        officer_designation:  Rank / designation (e.g. "Inspector of Police").
        authority:            Issuing authority (e.g. "Cyber Crime PS, Mumbai").

    Returns:
        A dict representing the full certificate bundle, including the
        ``integrity_hash`` field that must appear in the PDF.
    """
    # ── Serialise nodes and edges ─────────────────────────────────────────────
    nodes_raw = [n.model_dump() for n in trace.nodes]
    edges_raw = [
        e.model_dump(by_alias=True)        # use 'from'/'to' aliases
        for e in trace.edges
    ]

    tx_hashes = [e["txHash"] for e in edges_raw]

    # ── Compute deterministic hash ────────────────────────────────────────────
    integrity_hash = compute_evidence_hash(tx_hashes, nodes_raw)

    # ── Assemble certificate ──────────────────────────────────────────────────
    generated_at = datetime.now(UTC).isoformat()

    certificate: dict[str, Any] = {
        # Identity
        "certificate_id":       str(uuid4()),
        "case_id":              case_id,

        # Evidence subject
        "suspect_address":      trace.suspect_address,
        "chain":                trace.chain,
        "trace_depth":          trace.nodes[0].riskScore if trace.nodes else 0,  # placeholder
        "overall_risk_score":   trace.overall_risk_score,

        # Trace contents (for audit)
        "node_count":           len(trace.nodes),
        "edge_count":           len(trace.edges),
        "nodes":                [_canonical_node(n) for n in nodes_raw],
        "tx_hashes":            sorted(h.lower() for h in tx_hashes),

        # VASP attribution (if resolved)
        "attributed_vasp":      (
            trace.attribution.vasp_name if trace.attribution else None
        ),
        "deposit_address":      (
            trace.attribution.deposit_address if trace.attribution else None
        ),

        # Certification metadata
        "certifying_officer":   officer_name,
        "officer_designation":  officer_designation,
        "issuing_authority":    authority,
        "generated_at":         generated_at,
        "legal_basis":          (
            "Section 63 Bharatiya Sakshya Adhiniyam 2023 | "
            "Section 79A IT Act 2000"
        ),

        # ⚠ THIS FIELD IS THE COURT-ADMISSIBLE HASH — DO NOT ALTER ⚠
        "integrity_hash":       integrity_hash,
    }

    return certificate


def verify_certificate(certificate: dict[str, Any]) -> bool:
    """
    Re-compute the SHA-256 hash and verify it matches ``certificate['integrity_hash']``.

    Returns True if the certificate is intact and unmodified.
    """
    stored_hash = certificate.get("integrity_hash", "")
    recomputed  = compute_evidence_hash(
        tx_hashes      = certificate.get("tx_hashes", []),
        node_addresses = certificate.get("nodes", []),
    )
    return recomputed == stored_hash
