"""
ml_risk_scorer.py – GraphSAGE GNN-based wallet risk scoring engine.

Loads models/graphsage_risk.onnx (or PyTorch weights as fallback) to compute
learned 0–100 risk scores for each WalletNode in a graph trace.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

from app.models.schemas import TransferEdge, WalletNode

log = logging.getLogger(__name__)

_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "models"
_ONNX_PATH = _MODELS_DIR / "graphsage_risk.onnx"

_SESSION: Any | None = None
_SESSION_INITIALIZED: bool = False


def _get_onnx_session() -> Any | None:
    """Lazily load and cache the ONNX Runtime inference session."""
    global _SESSION, _SESSION_INITIALIZED
    if _SESSION_INITIALIZED:
        return _SESSION

    _SESSION_INITIALIZED = True
    if not _ONNX_PATH.exists():
        log.info("GNN model file not found at %s. Using heuristic risk scoring.", _ONNX_PATH)
        return None

    try:
        import onnxruntime as ort  # type: ignore

        # Optimize for low CPU/RAM inference
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        opts.inter_op_num_threads = 1
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        _SESSION = ort.InferenceSession(str(_ONNX_PATH), sess_options=opts)
        log.info("✅ GraphSAGE ONNX model loaded successfully from %s", _ONNX_PATH)
    except Exception as exc:
        log.warning("Could not initialize ONNX Runtime session: %s. Using heuristic scoring.", exc)
        _SESSION = None

    return _SESSION


def _extract_node_features(node: WalletNode, edges: list[TransferEdge]) -> list[float]:
    """
    Extract a 50-dimensional feature vector matching the GraphSAGE training schema:
      - balance
      - in_degree, out_degree
      - in_volume, out_volume
      - pass_through_ratio
      - is_vasp
      - flags_count
      - padded to 50 dims
    """
    in_edges = [e for e in edges if e.to_address.lower() == node.address.lower()]
    out_edges = [e for e in edges if e.from_address.lower() == node.address.lower()]

    in_vol = sum(e.value for e in in_edges)
    out_vol = sum(e.value for e in out_edges)
    pass_through = (out_vol / (in_vol + 1e-9)) if in_vol > 0 else 0.0

    # Scale volume and balance using log1p to match Elliptic normalized feature distribution
    bal_scaled = float(np.log1p(max(0.0, node.balance))) / 5.0
    in_vol_scaled = float(np.log1p(max(0.0, in_vol))) / 5.0
    out_vol_scaled = float(np.log1p(max(0.0, out_vol))) / 5.0

    features = [
        bal_scaled,
        float(len(in_edges)),
        float(len(out_edges)),
        in_vol_scaled,
        out_vol_scaled,
        float(min(5.0, pass_through)),
        1.0 if node.isVasp else 0.0,
        float(len(node.typologyFlags)),
        float(node.riskScore) / 100.0,
        1.0 if "ofac_sanctioned" in node.typologyFlags else 0.0,
    ]

    # Pad with zeros to 50 dimensions
    if len(features) < 50:
        features.extend([0.0] * (50 - len(features)))

    return features[:50]


def score_nodes_with_gnn(
    nodes: list[WalletNode],
    edges: list[TransferEdge],
) -> list[WalletNode]:
    """
    Run GraphSAGE inference across the trace graph.
    Updates `riskScore` (0-100) on each WalletNode in-place.
    Gracefully retains existing heuristic scores if model/runtime is unavailable.
    """
    if not nodes:
        return nodes

    sess = _get_onnx_session()
    if sess is None:
        return nodes

    try:
        addr2idx = {n.address.lower(): i for i, n in enumerate(nodes)}

        # Build feature matrix (N, 50)
        x_raw = [_extract_node_features(n, edges) for n in nodes]
        x = np.array(x_raw, dtype=np.float32)

        # Build edge index (2, E)
        src, dst = [], []
        for e in edges:
            u = e.from_address.lower()
            v = e.to_address.lower()
            if u in addr2idx and v in addr2idx:
                src.append(addr2idx[u])
                dst.append(addr2idx[v])

        if not src:
            # Self-loops if no valid internal edges
            src = list(range(len(nodes)))
            dst = list(range(len(nodes)))

        edge_index = np.array([src, dst], dtype=np.int64)

        # Run ONNX inference
        outputs = sess.run(None, {"x": x, "edge_index": edge_index})
        logits = outputs[0]  # Shape: (N, 2)

        # Softmax probabilities
        exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
        probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)

        for i, node in enumerate(nodes):
            # Probability of illicit class (class 1) * 100
            ml_risk = int(probs[i, 1] * 100)
            node.gnn_risk_score = ml_risk
            # Hard floor for OFAC sanctioned
            if "ofac_sanctioned" in node.typologyFlags:
                node.riskScore = 100
            else:
                # Blend with prior heuristic (70% ML, 30% baseline)
                node.riskScore = max(0, min(100, int(0.70 * ml_risk + 0.30 * node.riskScore)))

        log.info("GraphSAGE scored %d nodes successfully (top risk: %d)", len(nodes), max(n.riskScore for n in nodes))
    except Exception as exc:
        log.warning("GNN inference failed, keeping baseline risk scores: %s", exc)

    return nodes
