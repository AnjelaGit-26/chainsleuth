"""
ml_ensemble_scorer.py – Multi-signal risk score calibration.

Blends:
  - 40% GraphSAGE GNN node risk average
  - 30% Detected fraud typology severity
  - 20% Isolation Forest anomaly index
  - 10% Hard rule signals (OFAC, unverified VASP)

Outputs a calibrated 0–100 integer score for TraceResult.overall_risk_score.
"""
from __future__ import annotations

import logging
from typing import Any

from app.models.schemas import TraceResult

log = logging.getLogger(__name__)

# Severity weights for specific typologies (0–100)
_TYPOLOGY_SEVERITY: dict[str, int] = {
    "ofac_sanctioned":    100,
    "coinjoin_mixer":      90,
    "peeling_chain":       85,
    "first_funder_match":  80,
    "fan_out":             70,
    "burner_wallet":       65,
    "dex_swap":            60,
    "bridge_hop":          65,
}


def compute_ensemble_risk_score(
    result: TraceResult,
    anomaly_scores: dict[str, float] | None = None,
) -> int:
    """
    Calculate the calibrated overall risk score (0–100) for a TraceResult.
    """
    nodes = result.nodes
    if not nodes:
        return 0

    # Instant maximum if any node has OFAC sanctions
    if any("ofac_sanctioned" in n.typologyFlags for n in nodes):
        return 100

    # 1. GNN Risk Signal (Average of all node risk scores)
    gnn_avg = float(sum(n.riskScore for n in nodes)) / float(len(nodes))

    # 2. Typology Severity Signal
    all_flags = [flag for n in nodes for flag in n.typologyFlags]
    if all_flags:
        typology_score = float(max(_TYPOLOGY_SEVERITY.get(f, 40) for f in all_flags))
    else:
        typology_score = 0.0

    # 3. Anomaly Score Signal
    if anomaly_scores and len(anomaly_scores) > 0:
        anomaly_avg = (sum(anomaly_scores.values()) / len(anomaly_scores)) * 100.0
    else:
        anomaly_avg = gnn_avg * 0.7

    # 4. Hard Structural Signals
    hard_score = 0.0
    if result.attribution is None:
        # High unhosted / unverified destination risk
        hard_score += 25.0
    else:
        if not getattr(result.attribution, "is_fiu_registered", True):
            hard_score += 20.0  # Offshore / unregistered exchange
        if getattr(result.attribution, "confidence_score", 0.0) < 0.6:
            hard_score += 10.0

    # Weighted Ensemble
    final_score = int(
        0.40 * gnn_avg +
        0.30 * typology_score +
        0.20 * anomaly_avg +
        0.10 * hard_score
    )

    return max(0, min(100, final_score))
