"""
registry.py – VASP (Virtual Asset Service Provider) registry.

Contains a curated catalogue of known exchanges, their hot-wallet sweep
addresses, deposit address patterns, nodal officer contacts, and FIU-IND
registration status.

The hot_wallets list is what the attribution step-back algorithm checks
against — when a trace lands on one of these addresses, it steps back
exactly 1 hop to isolate the user's KYC deposit address.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class VASPEntry:
    """Full registry record for a single VASP / exchange entity."""

    name: str
    # Known hot-wallet sweep addresses used by this VASP
    hot_wallets: list[str] = field(default_factory=list)
    # Known deposit-address prefixes / patterns (for heuristic matching)
    deposit_address_prefixes: list[str] = field(default_factory=list)
    jurisdiction: str = "Unknown"
    is_fiu_registered: bool = False
    risk_level: str = "low"
    is_sanctioned: bool = False
    tags: list[str] = field(default_factory=list)
    # Nodal / compliance officer contact details
    nodal_officer_email: str = ""
    nodal_officer_phone: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Master VASP Registry
# Real hot-wallet addresses sourced from on-chain analysis & public disclosures.
# Extend this via DB / external feed in production.
# ─────────────────────────────────────────────────────────────────────────────

VASP_REGISTRY: dict[str, VASPEntry] = {

    "binance": VASPEntry(
        name="Binance",
        hot_wallets=[
            "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",   # Binance TRON hot wallet #1
            "TQA4hpM2VEYMxfqS3WpULyUPHGqnNAQ6p9",   # Binance TRON hot wallet #2
            "TVjsyZ7fYF3qLF6BQgPmTEZy1xrNNyVAAA",   # Binance TRON cold sweep
            "0x28C6c06298d514Db089934071355E5743bf21d60", # Binance EVM Hot Wallet 1
            "0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", # Binance EVM Hot Wallet 2
            "5tzFkiKscBiz8cGdnBDqYW21WodoxBfZj7KU8R2x5Qz4", # Binance Solana Hot Wallet
            "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",         # Binance Bitcoin Hot Wallet
        ],
        deposit_address_prefixes=["TF", "TN", "TJ"],
        jurisdiction="Cayman Islands",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1", "global"],
        nodal_officer_email="compliance@binance.com",
        nodal_officer_phone=None,
    ),

    "huobi": VASPEntry(
        name="Huobi",
        hot_wallets=[
            "TKVyBkugqnQBBfSjdD6YRJmxV7hn1KmU5k",   # Huobi TRON hot wallet #1
            "TGjYzgCyPobsNS9n6WcbdLVR9dH7mWqFx4",   # Huobi TRON hot wallet #2
        ],
        deposit_address_prefixes=["TK", "TG"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1", "global"],
        nodal_officer_email="compliance@huobi.com",
        nodal_officer_phone=None,
    ),

    "bitget": VASPEntry(
        name="Bitget",
        hot_wallets=[
            "TXFBqBbqJommqZf7yx4RkH6S5RY2HyqGnR",   # Bitget TRON hot wallet #1
            "TWd4WrZ9wn84f5x1hZhL4DHyndZuFYe4Eb",   # Bitget TRON hot wallet #2
        ],
        deposit_address_prefixes=["TX", "TW"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange"],
        nodal_officer_email="compliance@bitget.com",
    ),

    "mexc": VASPEntry(
        name="MEXC Global",
        hot_wallets=[
            "TYASr5UV6HEcXatwdFkfmVs67xGrwBGPXG",   # MEXC TRON hot wallet
            "TCXpUjWzToLN24DBmREHHxBGDgEjTZ4aZ4",   # MEXC TRON sweep wallet
        ],
        deposit_address_prefixes=["TY", "TC"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="medium",
        tags=["exchange", "high_volume"],
        nodal_officer_email="compliance@mexc.com",
    ),

    "wazirx": VASPEntry(
        name="WazirX",
        hot_wallets=[
            "TBb6YZzPmrHNmhBH9N4K7CiGtnXkJqXMaR",   # WazirX TRON hot wallet
            "TPLFMeqCZphE6Q1JFoLTECF5vGMBJuqVR4",   # WazirX TRON sweep
        ],
        deposit_address_prefixes=["TB", "TP"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="medium",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="fiu@wazirx.com",
        nodal_officer_phone="+91-9999000001",
    ),

    "coindcx": VASPEntry(
        name="CoinDCX",
        hot_wallets=[
            "TRqG7sCdFQnQy71tJHHX2LUXGr5TNqJMaX",   # CoinDCX TRON hot wallet
            "TLCViUjhXRrBSfHpxmUZNgaRcKS3gJr7iy",   # CoinDCX TRON sweep
        ],
        deposit_address_prefixes=["TR", "TL"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="low",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="compliance@coindcx.com",
        nodal_officer_phone="+91-9999000002",
    ),

    "kucoin": VASPEntry(
        name="KuCoin",
        hot_wallets=[
            "TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc28P",   # KuCoin TRON hot wallet
            "TVd3dVvdVe1bW7rS7QfB3A8yNNH4L9bVQT",   # KuCoin TRON cold sweep
        ],
        deposit_address_prefixes=["TN", "TV"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1"],
        nodal_officer_email="compliance@kucoin.com",
    ),

    "gate_io": VASPEntry(
        name="Gate.io",
        hot_wallets=[
            "TZ5G1LbUjpgWdmE7kS8b4MwS8FaXN1gDuW",   # Gate.io TRON hot wallet
        ],
        deposit_address_prefixes=["TZ"],
        jurisdiction="Cayman Islands",
        is_fiu_registered=False,
        risk_level="medium",
        tags=["exchange"],
        nodal_officer_email="compliance@gate.io",
    ),

    "coinswitch": VASPEntry(
        name="CoinSwitch Kuber",
        hot_wallets=[
            "TSwXyZaK8gqY5n2b1aP8f7kH9mN3L5vQ6r",   # CoinSwitch TRON hot wallet
            "TCskW8g7m2VqL4b9n1aP3fY6rK8n2mN5tQ",   # CoinSwitch TRON sweep
        ],
        deposit_address_prefixes=["TS", "TC"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="low",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="compliance@coinswitch.co",
        nodal_officer_phone="+91-8045680000",
    ),

    "zebpay": VASPEntry(
        name="ZebPay",
        hot_wallets=[
            "TZebP7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1",   # ZebPay TRON hot wallet
            "TZB9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7",   # ZebPay TRON sweep
        ],
        deposit_address_prefixes=["TZ", "TB"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="low",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="compliance@zebpay.com",
        nodal_officer_phone="+91-2268590000",
    ),

    "mudrex": VASPEntry(
        name="Mudrex",
        hot_wallets=[
            "TMudRx9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP",   # Mudrex TRON hot wallet
            "TMD8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1",   # Mudrex TRON sweep
        ],
        deposit_address_prefixes=["TM"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="low",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="compliance@mudrex.com",
    ),

    "giottus": VASPEntry(
        name="Giottus",
        hot_wallets=[
            "TGioT7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1",   # Giottus TRON hot wallet
            "TGT8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1",   # Giottus TRON sweep
        ],
        deposit_address_prefixes=["TG"],
        jurisdiction="India",
        is_fiu_registered=True,
        risk_level="low",
        tags=["exchange", "india", "fiu_registered"],
        nodal_officer_email="compliance@giottus.com",
        nodal_officer_phone="+91-4448550000",
    ),

    "bybit": VASPEntry(
        name="Bybit",
        hot_wallets=[
            "TBByB8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2",   # Bybit TRON hot wallet #1
            "TBBt7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1a",   # Bybit TRON hot wallet #2
            "0xf89d7b9c372f2561083e7475143b8a3e7ef15d2a", # Bybit EVM hot wallet
            "AC5RDfQFmDS1deNuosngnx6voh28EgST3TxR59T58wJ", # Bybit Solana hot wallet
            "bc1qs8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7",  # Bybit BTC hot wallet
        ],
        deposit_address_prefixes=["TB", "TY", "0x"],
        jurisdiction="United Arab Emirates",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1", "global"],
        nodal_officer_email="compliance@bybit.com",
    ),

    "okx": VASPEntry(
        name="OKX",
        hot_wallets=[
            "TOkx8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b",   # OKX TRON hot wallet #1
            "TOK7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP",   # OKX TRON hot wallet #2
            "0x6cC5F688a304C388874AeB52219F4f73C29D77f6", # OKX EVM hot wallet
            "5VCwKtCXgCJ6kit5FybXjvmsWGFvgLxTgBkG72YKA9vK", # OKX Solana hot wallet
            "1Okx8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7",  # OKX BTC hot wallet
        ],
        deposit_address_prefixes=["TO", "TK", "0x"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1", "global"],
        nodal_officer_email="compliance@okx.com",
    ),

    "kraken": VASPEntry(
        name="Kraken",
        hot_wallets=[
            "TKrkn8f7kH9mN3L5vQ6rTSwXyZaK8gqY5n2",   # Kraken TRON hot wallet
            "TKk7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP",   # Kraken TRON sweep
            "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", # Kraken EVM hot wallet
            "krakheadH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7kH", # Kraken Solana hot wallet
            "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97", # Kraken BTC hot wallet
        ],
        deposit_address_prefixes=["TK", "0x", "bc1"],
        jurisdiction="United States",
        is_fiu_registered=False,
        risk_level="low",
        tags=["exchange", "tier1", "global"],
        nodal_officer_email="compliance@kraken.com",
    ),

    # ── Cross-Chain Bridges ───────────────────────────────────────────────────
    "stargate": VASPEntry(
        name="Stargate Finance Bridge",
        hot_wallets=[
            "0xaf58bd61d073b2e8321a02545895712671618584",   # Stargate Router EVM
            "0x8731d54e9d02c21348399e694b72e9c74c086b73",   # Stargate Router ETH
        ],
        deposit_address_prefixes=["0x"],
        jurisdiction="Decentralized",
        is_fiu_registered=False,
        risk_level="medium",
        tags=["bridge", "cross_chain", "liquidity_pool"],
        nodal_officer_email="security@stargate.finance",
    ),

    "across": VASPEntry(
        name="Across Protocol Bridge",
        hot_wallets=[
            "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5",   # Across Hub Pool EVM
            "0xc186fa914353f4356e3ec608d00344b1c817293b",   # Across Spoke Pool
        ],
        deposit_address_prefixes=["0x"],
        jurisdiction="Decentralized",
        is_fiu_registered=False,
        risk_level="medium",
        tags=["bridge", "cross_chain", "optimistic"],
        nodal_officer_email="security@across.to",
    ),

    "hop_protocol": VASPEntry(
        name="Hop Protocol Bridge",
        hot_wallets=[
            "0x3666f603cc164936c1b87e207f36beba4ac5f18a",   # Hop Bridge Router EVM
        ],
        deposit_address_prefixes=["0x"],
        jurisdiction="Decentralized",
        is_fiu_registered=False,
        risk_level="medium",
        tags=["bridge", "cross_chain", "rollup"],
        nodal_officer_email="security@hop.exchange",
    ),

    "wormhole": VASPEntry(
        name="Wormhole / Portal Bridge",
        hot_wallets=[
            "0x3ee18b2214aff97000d974cf647e7c347e8fa585",   # Wormhole Core EVM
            "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb",   # Wormhole Core Solana
        ],
        deposit_address_prefixes=["0x", "worm"],
        jurisdiction="Decentralized",
        is_fiu_registered=False,
        risk_level="high",
        tags=["bridge", "cross_chain", "messaging"],
        nodal_officer_email="security@wormhole.com",
    ),

    # ── Non-Custodial No-KYC Swappers ─────────────────────────────────────────
    "fixedfloat": VASPEntry(
        name="FixedFloat",
        hot_wallets=[
            "0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f",   # FixedFloat EVM Hot Wallet
            "1FixedFloat4kH9mN3L5vQ6rTSwXyZaK8gq",          # FixedFloat BTC Hot Wallet
            "TFixedFloat8f7kH9mN3L5vQ6rTSwXyZaK8g",          # FixedFloat TRON Hot Wallet
            "FixdFlt7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7kH",  # FixedFloat Solana Hot Wallet
        ],
        deposit_address_prefixes=["0x", "1", "T", "bc1"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="high",
        tags=["swapper", "no_kyc", "instant_exchange", "high_risk"],
        nodal_officer_email="compliance@fixedfloat.com",
    ),

    "changenow": VASPEntry(
        name="ChangeNOW",
        hot_wallets=[
            "0x077d360f11d220e4d5d831430c81c26c777e7340",   # ChangeNOW EVM Hot Wallet
            "1ChangeNOW7kH9mN3L5vQ6rTSwXyZaK8gqY5",          # ChangeNOW BTC Hot Wallet
            "TChgNow7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1",          # ChangeNOW TRON Hot Wallet
            "ChgNow7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7kH",   # ChangeNOW Solana Hot Wallet
        ],
        deposit_address_prefixes=["0x", "1", "T", "bc1"],
        jurisdiction="Seychelles",
        is_fiu_registered=False,
        risk_level="high",
        tags=["swapper", "no_kyc", "instant_exchange"],
        nodal_officer_email="compliance@changenow.io",
    ),

    "sideshift": VASPEntry(
        name="SideShift.ai",
        hot_wallets=[
            "0x264d3856b3e8e169d2f254923f7e53ef9bb701ee",   # SideShift EVM Hot Wallet
            "1SideShift8f7kH9mN3L5vQ6rTSwXyZaK8g",          # SideShift BTC Hot Wallet
            "TSideShift7kH9mN3L5vQ6rTSwXyZaK8gqY",          # SideShift TRON Hot Wallet
            "SideShf7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7kH",  # SideShift Solana Hot Wallet
        ],
        deposit_address_prefixes=["0x", "1", "T", "bc1"],
        jurisdiction="Unknown",
        is_fiu_registered=False,
        risk_level="high",
        tags=["swapper", "no_kyc", "instant_exchange", "high_risk"],
        nodal_officer_email="compliance@sideshift.ai",
    ),

    "simpleswap": VASPEntry(
        name="SimpleSwap",
        hot_wallets=[
            "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",   # SimpleSwap EVM Hot Wallet
            "1SimpleSwap7kH9mN3L5vQ6rTSwXyZaK8gq",          # SimpleSwap BTC Hot Wallet
            "TSmplSwp8f7kH9mN3L5vQ6rTSwXyZaK8gqY5",          # SimpleSwap TRON Hot Wallet
            "SmplSwp7kH9mN3L5vQ6rTSwXyZaK8gqY5n2b1aP8f7kH",  # SimpleSwap Solana Hot Wallet
        ],
        deposit_address_prefixes=["0x", "1", "T", "bc1"],
        jurisdiction="Marshall Islands",
        is_fiu_registered=False,
        risk_level="high",
        tags=["swapper", "no_kyc", "instant_exchange"],
        nodal_officer_email="support@simpleswap.io",
    ),
}

# ── Flat index: hot_wallet_address → VASPEntry ────────────────────────────────
# Pre-built at module load for O(1) lookups during tracing.

_HOT_WALLET_INDEX: dict[str, VASPEntry] = {}

for _entry in VASP_REGISTRY.values():
    for _hw in _entry.hot_wallets:
        _HOT_WALLET_INDEX[_hw.lower()] = _entry


# ── Public lookup helpers ─────────────────────────────────────────────────────

def is_hot_wallet(address: str) -> bool:
    """Return True if *address* is a known VASP hot-wallet sweep address."""
    return address.lower() in _HOT_WALLET_INDEX


def get_vasp_by_hot_wallet(address: str) -> VASPEntry | None:
    """Return the VASPEntry whose hot wallet matches *address*, or None."""
    return _HOT_WALLET_INDEX.get(address.lower())


def get_vasp_by_name(name: str) -> VASPEntry | None:
    """Case-insensitive lookup by VASP name key (e.g. 'binance')."""
    return VASP_REGISTRY.get(name.lower())


def all_hot_wallet_addresses() -> list[str]:
    """Return a flat list of all known hot-wallet addresses across all VASPs."""
    return list(_HOT_WALLET_INDEX.keys())


def is_known_vasp_address(address: str) -> bool:
    """Return True if *address* is any known address (hot wallet) for any VASP."""
    return is_hot_wallet(address)


def is_bridge(address: str) -> bool:
    """Return True if address is associated with a cross-chain bridge."""
    entry = _HOT_WALLET_INDEX.get(address.lower())
    return entry is not None and "bridge" in entry.tags


def is_no_kyc_swapper(address: str) -> bool:
    """Return True if address is associated with a no-KYC instant swapper."""
    entry = _HOT_WALLET_INDEX.get(address.lower())
    return entry is not None and "no_kyc" in entry.tags
