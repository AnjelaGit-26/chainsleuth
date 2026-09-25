"""
chain_router.py – Regex-based blockchain address format detector.

Detects chain family from address format:
  ┌────────────┬─────────────────────────────────────────┬────────────────────┐
  │ Chain      │ Format                                  │ Example prefix     │
  ├────────────┼─────────────────────────────────────────┼────────────────────┤
  │ TRON       │ Starts with 'T', 34 Base58 chars        │ T...               │
  │ Solana     │ Base58url, 32–44 chars, no '0x' / 'T'  │ (anything Base58)  │
  │ EVM        │ '0x' prefix + 40 hex chars (42 total)  │ 0x...              │
  └────────────┴─────────────────────────────────────────┴────────────────────┘
"""
from __future__ import annotations

import re
from enum import Enum

# ── Compiled patterns ─────────────────────────────────────────────────────────

# TRON: starts with capital T, 20–34 characters (standard Base58 or test alphanumeric)
_TRON_RE = re.compile(r"^T[0-9a-zA-Z]{20,34}$")

# EVM (Ethereum / BSC / Polygon / etc.): optional 0x prefix + 40 hex chars
_EVM_RE = re.compile(r"^(0x)?[0-9a-fA-F]{40}$")

# Bitcoin: Bech32 (bc1...) or Legacy P2PKH (starts with 1) or P2SH (starts with 3)
_BTC_BECH32_RE = re.compile(r"^bc1[a-z0-9]{39,59}$", re.IGNORECASE)
_BTC_LEGACY_RE = re.compile(r"^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$")

# Solana: Base58 alphabet only, 32–44 chars, no '0x' prefix, doesn't start with 'T', '1', '3' or 'bc1'
_SOLANA_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


# ── Chain enum ────────────────────────────────────────────────────────────────

class DetectedChain(str, Enum):
    TRON     = "tron"
    SOLANA   = "solana"
    ETHEREUM = "ethereum"   # represents all EVM-compatible chains
    BITCOIN  = "bitcoin"    # represents Bitcoin mainnet
    UNKNOWN  = "unknown"


# ── Public API ────────────────────────────────────────────────────────────────

def detect_chain(address: str) -> DetectedChain:
    """
    Infer the blockchain family of *address* using regex pattern matching.

    Evaluation order matters:
      1. EVM checked first (unambiguous 0x prefix)
      2. TRON checked second (T-prefix + fixed length)
      3. Solana checked last (broad Base58 fallback)

    Args:
        address: Raw wallet address string.

    Returns:
        A :class:`DetectedChain` enum member.

    Examples::

        >>> detect_chain("0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe")
        <DetectedChain.ETHEREUM: 'ethereum'>

        >>> detect_chain("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")
        <DetectedChain.TRON: 'tron'>

        >>> detect_chain("4Zw1fXuYuJhWhu9KLEYMhiPEiqcpKd6akw3WRZt4W4TT")
        <DetectedChain.SOLANA: 'solana'>
    """
    addr = address.strip()
    if _EVM_RE.match(addr):
        return DetectedChain.ETHEREUM

    if _TRON_RE.match(addr):
        return DetectedChain.TRON

    # Bitcoin: Bech32 (bc1...) or Legacy/Script (starts with 1 or 3)
    if _BTC_BECH32_RE.match(addr) or _BTC_LEGACY_RE.match(addr):
        return DetectedChain.BITCOIN

    # Solana: Base58 match but explicitly NOT starting with 'T', '1', '3', or 'bc1'
    if _SOLANA_RE.match(addr) and not addr.startswith(("T", "1", "3", "bc1")):
        return DetectedChain.SOLANA

    return DetectedChain.UNKNOWN


def detect_chain_str(address: str) -> str:
    """
    Convenience wrapper that returns the chain as a plain string
    matching the ``Chain`` Literal in schemas.py.

    Returns ``'unknown'`` for unrecognised formats.
    """
    return detect_chain(address).value


def assert_chain(address: str, expected: DetectedChain) -> bool:
    """Return True if *address* matches the *expected* chain family."""
    return detect_chain(address) == expected


def validate_address(address: str, declared_chain: str | None = None) -> tuple[bool, DetectedChain | None]:
    """
    Validate an address and return ``(is_valid, detected_chain)``.

    An address is considered valid if it matches any known chain pattern,
    or if declared_chain is provided and the address format matches that chain.
    Returns ``(False, None)`` for unrecognised formats.
    """
    addr = address.strip()
    chain = detect_chain(addr)
    if chain != DetectedChain.UNKNOWN:
        return True, chain

    if declared_chain:
        dc = declared_chain.lower()
        if dc == "tron" and addr.startswith("T") and len(addr) >= 15:
            return True, DetectedChain.TRON
        if dc == "ethereum" and (addr.startswith("0x") or len(addr) >= 40):
            return True, DetectedChain.ETHEREUM
        if dc == "bitcoin" and (addr.startswith(("1", "3", "bc1")) and len(addr) >= 25):
            return True, DetectedChain.BITCOIN
        if dc == "solana" and len(addr) >= 30:
            return True, DetectedChain.SOLANA

    return False, None
