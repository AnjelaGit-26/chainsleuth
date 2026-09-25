"""
ml_typology_classifier.py – XGBoost-based fraud typology detection.

Uses pre-trained XGBoost classifiers to detect:
  - peeling_chain
  - fan_out
  - coinjoin_mixer
  - burner_wallet

Runs as a secondary ML pass after rule heuristics to catch adversarial variations.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, cast

import numpy as np

from app.models.schemas import TransferEdge, TypologyFlag, WalletNode

log = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
_SCALER_PATH = _MODELS_DIR / "typology_scaler.pkl"

_MODELS: dict[str, Any] = {}
_SCALER: Any | None = None
_LOAD_ATTEMPTED: bool = False


def _load_typology_models() -> None:
    """Load the XGBoost typology classifiers and scaler if available."""
    global _MODELS, _SCALER, _LOAD_ATTEMPTED
    if _LOAD_ATTEMPTED:
        return

    _LOAD_ATTEMPTED = True
    if not _SCALER_PATH.exists():
        log.info("Typology models not found in %s. Using heuristic-only typology rules.", _MODELS_DIR)
        return

    try:
        import joblib  # type: ignore

        _SCALER = joblib.load(_SCALER_PATH)

        target_files = {
            "peeling_chain":  _MODELS_DIR / "peeling_chain_xgb.pkl",
            "fan_out":        _MODELS_DIR / "fan_out_xgb.pkl",
            "coinjoin_mixer": _MODELS_DIR / "coinjoin_mixer_xgb.pkl",
            "burner_wallet":  _MODELS_DIR / "burner_wallet_xgb.pkl",
        }

        for flag_name, path in target_files.items():
            if path.exists():
                _MODELS[flag_name] = joblib.load(path)

        log.info("✅ Loaded %d XGBoost typology models successfully: %s", len(_MODELS), list(_MODELS.keys()))
    except Exception as exc:
        log.warning("Could not load XGBoost typology models: %s", exc)
        _MODELS = {}
        _SCALER = None


def _extract_typology_features(node: WalletNode, edges: list[TransferEdge]) -> list[float]:
    """
    10 standardized behavioral features matching the training script:
      [in_degree, out_degree, fan_in_count, fan_out_count,
       in_volume, out_volume, pass_through_ratio,
       avg_interval_mins, active_duration_mins, total_transacted]
    """
    in_edges = [e for e in edges if e.to_address.lower() == node.address.lower()]
    out_edges = [e for e in edges if e.from_address.lower() == node.address.lower()]

    unique_senders = {e.from_address.lower() for e in in_edges}
    unique_recipients = {e.to_address.lower() for e in out_edges}

    in_vol = sum(e.value for e in in_edges)
    out_vol = sum(e.value for e in out_edges)
    pass_through = (out_vol / (in_vol + 1e-9)) if in_vol > 0 else 0.0

    # Calculate timestamps delta
    timestamps = [e.timestamp.timestamp() for e in in_edges + out_edges if e.timestamp]
    if len(timestamps) >= 2:
        timestamps.sort()
        duration_mins = max(1.0, (timestamps[-1] - timestamps[0]) / 60.0)
        avg_interval = duration_mins / max(1, len(timestamps) - 1)
    else:
        duration_mins = 60.0
        avg_interval = 30.0

    return [
        float(len(in_edges)),
        float(len(out_edges)),
        float(len(unique_senders)),
        float(len(unique_recipients)),
        float(in_vol),
        float(out_vol),
        float(min(5.0, pass_through)),
        float(avg_interval),
        float(duration_mins),
        float(in_vol + out_vol),
    ]


def classify_typology_with_ml(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
    probability_threshold: float = 0.55,
) -> list[WalletNode]:
    """
    Run XGBoost typology classification across nodes.
    Appends newly detected flags to `node.typologyFlags` without deleting existing rule flags.
    """
    _load_typology_models()
    if not _MODELS or _SCALER is None or not nodes:
        return nodes

    try:
        X_raw = [_extract_typology_features(n, edges) for n in nodes]
        X = np.array(X_raw, dtype=np.float32)
        X_scaled = _SCALER.transform(X)

        max_probs = np.zeros(len(nodes), dtype=np.float32)

        for flag_name, model in _MODELS.items():
            probs = model.predict_proba(X_scaled)[:, 1]
            max_probs = np.maximum(max_probs, probs)
            canonical_flag: TypologyFlag = cast(
                TypologyFlag,
                "zero_gas_burner" if flag_name == "burner_wallet" else flag_name,
            )
            for i, node in enumerate(nodes):
                if probs[i] >= probability_threshold and canonical_flag not in node.typologyFlags:
                    node.typologyFlags.append(canonical_flag)
                    log.info("ML flagged %s as '%s' (conf=%.2f)", node.address, canonical_flag, probs[i])

        for i, node in enumerate(nodes):
            prob_score = int(round(float(max_probs[i]) * 100))
            if node.typology_score is None or node.typology_score == 0:
                node.typology_score = prob_score
            else:
                node.typology_score = max(node.typology_score, prob_score)

    except Exception as exc:
        log.warning("XGBoost typology classification error: %s", exc)

    return nodes
