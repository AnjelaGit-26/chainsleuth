"""
ml_anomaly_detector.py – Unsupervised Anomaly Detection using Isolation Forest.

Identifies outlier wallets in layering networks that deviate from standard commercial
or retail patterns, flagging adversarial laundering behavior.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

from app.models.schemas import TransferEdge, WalletNode

log = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
_ISO_PATH = _MODELS_DIR / "isolation_forest.pkl"
_SCALER_PATH = _MODELS_DIR / "anomaly_scaler.pkl"

_MODEL: Any | None = None
_SCALER: Any | None = None
_LOAD_ATTEMPTED: bool = False


def _load_isolation_forest() -> None:
    global _MODEL, _SCALER, _LOAD_ATTEMPTED
    if _LOAD_ATTEMPTED:
        return

    _LOAD_ATTEMPTED = True
    if not _ISO_PATH.exists() or not _SCALER_PATH.exists():
        log.info("Isolation Forest models not found in %s.", _MODELS_DIR)
        return

    try:
        import joblib  # type: ignore

        _MODEL = joblib.load(_ISO_PATH)
        _SCALER = joblib.load(_SCALER_PATH)
        log.info("✅ Isolation Forest anomaly detector loaded successfully")
    except Exception as exc:
        log.warning("Could not load Isolation Forest: %s", exc)
        _MODEL = None
        _SCALER = None


def detect_anomalies(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> dict[str, float]:
    """
    Compute anomaly score for each wallet node (0.0 to 1.0).
    Higher score indicates higher anomaly / deviation from normal activity.
    """
    _load_isolation_forest()
    scores: dict[str, float] = {}

    if not nodes:
        return scores

    if _MODEL is None or _SCALER is None:
        # Heuristic fallback based on pass-through and velocity
        for node in nodes:
            in_edges = [e for e in edges if e.to_address.lower() == node.address.lower()]
            out_edges = [e for e in edges if e.from_address.lower() == node.address.lower()]
            in_vol = sum(e.value for e in in_edges)
            out_vol = sum(e.value for e in out_edges)
            ratio = (out_vol / (in_vol + 1e-9)) if in_vol > 0 else 0.0

            # Rapid passthrough with high volume gets higher heuristic score
            score = 0.1
            if 0.85 <= ratio <= 1.15 and len(out_edges) > 0:
                score += 0.4
            if len(node.typologyFlags) > 0:
                score += min(0.4, len(node.typologyFlags) * 0.15)
            scores[node.address] = round(min(1.0, score), 3)
        return scores

    try:
        from app.engine.ml_typology_classifier import _extract_typology_features

        X_raw = [_extract_typology_features(n, edges) for n in nodes]
        X = np.array(X_raw, dtype=np.float32)
        X_scaled = _SCALER.transform(X)

        # score_samples: more negative = more anomalous
        raw_scores = _MODEL.score_samples(X_scaled)
        min_s, max_s = raw_scores.min(), raw_scores.max()

        if max_s > min_s:
            # Invert and normalize to [0, 1]
            norm_scores = 1.0 - ((raw_scores - min_s) / (max_s - min_s))
        else:
            norm_scores = np.full(len(nodes), 0.5)

        for i, node in enumerate(nodes):
            val = round(float(norm_scores[i]), 3)
            scores[node.address] = val
            scores[node.address.lower()] = val
            node.anomaly_score = val

    except Exception as exc:
        log.warning("Isolation Forest scoring failed: %s", exc)
        for node in nodes:
            scores[node.address] = 0.2
            scores[node.address.lower()] = 0.2
            if node.anomaly_score is None:
                node.anomaly_score = 0.2

    return scores
