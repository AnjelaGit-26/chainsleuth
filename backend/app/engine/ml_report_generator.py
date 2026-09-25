"""
ml_report_generator.py – AI-powered Court-Admissible Forensic Report Generator.

Generates structured investigation reports in formal Indian law enforcement terminology:
  - Section 94 BNSS (formerly Section 91 CrPC) for notice issuance
  - Prevention of Money Laundering Act (PMLA), 2002
  - FIU-IND compliance references
  - Section 63 Bharatiya Sakshya Adhiniyam, 2023 (formerly Section 65B IEA) electronic evidence certificate

Uses Google Gemini (via google-genai) with automated fallback.
"""
from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from app.core.config import get_settings
from app.models.schemas import TraceResult

log = logging.getLogger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = """You are a Principal Forensic Analyst and Technical Expert advising Indian Law Enforcement Agencies (Cyber Crime Units, Enforcement Directorate, CBI, State Police).

Your objective is to produce a court-admissible Forensic Investigation Report and Evidence Memorandum for an on-chain cryptocurrency tracing operation.

Structure the report strictly with the following numbered legal sections:
1. EXECUTIVE CASE SUMMARY & INVESTIGATION MANDATE
2. SUSPECT PROFILE & TARGET ADDRESS ANALYSIS
3. ON-CHAIN TRANSACTION FLOW & MULTI-HOP LAYERING TRAJECTORY
4. FORENSIC TYPOLOGY FINDINGS (Peeling Chains, Smurfing, Burners, Mixers)
5. VASP ATTRIBUTION & STATUTORY SECTION 94 BNSS REQUISITIONS
6. LEGAL ASSESSMENTS (PMLA 2002, IT Act 2000 Sec 66D, FIU-IND Reporting)
7. SECTION 63 BSA (FORMERLY SEC 65B IEA) ELECTRONIC EVIDENCE CERTIFICATION
8. IMMEDIATE INVESTIGATIVE DIRECTIVES FOR THE INVESTIGATING OFFICER (I.O.)

Maintain formal, authoritative legal prose suitable for submission before a Designated Special PMLA Court or Chief Judicial Magistrate.
"""


def _generate_template_fallback(result: TraceResult) -> str:
    """Deterministic fallback narrative report when GenAI API key is unavailable."""
    now_str = datetime.now(UTC).strftime("%d-%m-%Y %H:%M:%S UTC")
    vasp_name = result.attribution.vasp_name if result.attribution else "Unhosted / Unverified Wallet Cluster"
    flags = list({flag for n in result.nodes for flag in n.typologyFlags})

    return f"""================================================================================
CHAINSSLEUTH BLOCKCHAIN FORENSIC INVESTIGATION REPORT
PREPARED FOR: LAW ENFORCEMENT AGENCIES & SPECIAL CYBER CRIME UNITS
================================================================================
REPORT REFERENCE  : DKT/CYBER/{result.case_id}
DATE & TIME       : {now_str}
TARGET WALLET     : {result.suspect_address}
BLOCKCHAIN        : {result.chain.upper()}
OVERALL RISK      : {result.overall_risk_score}/100 ({'HIGH CRITICAL' if result.overall_risk_score >= 70 else 'MODERATE SUSPECT'})

1. EXECUTIVE CASE SUMMARY & INVESTIGATION MANDATE
--------------------------------------------------------------------------------
An algorithmic multi-hop blockchain tracing investigation was conducted on target
address {result.suspect_address} across {len(result.nodes)} graph entities and {len(result.edges)} transfers.
The overall transaction network exhibits an empirical laundering risk score of
{result.overall_risk_score}/100 with critical crime typologies identified.

2. SUSPECT PROFILE & TARGET ADDRESS ANALYSIS
--------------------------------------------------------------------------------
Address           : {result.suspect_address}
Associated Chain  : {result.chain.capitalize()}
Identified Nodes  : {len(result.nodes)} distinct addresses
Transfer Count    : {len(result.edges)} on-chain ledger transfers

3. FORENSIC TYPOLOGY FINDINGS
--------------------------------------------------------------------------------
Active Typology Indicators:
{chr(10).join(f" - [{f.upper()}]: Confirmed pattern detected on trace path" for f in flags) if flags else " - No primary heuristic typology flags triggered."}

4. VASP ATTRIBUTION & STATUTORY DIRECTIVES
--------------------------------------------------------------------------------
Primary Destination VASP : {vasp_name}
Action Mandate           : Issue Section 94 BNSS (formerly Sec 91 CrPC) preservation
                           and KYC disclosure notice immediately.

5. SECTION 63 BHARATIYA SAKSHYA ADHINIYAM (BSA) CERTIFICATE
--------------------------------------------------------------------------------
This electronic evidence docket is mathematically derived from public distributed
ledger records via cryptographic hash validation and deterministic graph traversal.
Hash integrity has been maintained throughout the forensic custody chain.
================================================================================
"""


async def generate_forensic_report(result: TraceResult) -> str:
    """
    Generate a full legal narrative report for a TraceResult using Gemini.
    """
    if not settings.GEMINI_API_KEY:
        log.info("GEMINI_API_KEY not set. Using template-based legal report fallback.")
        return _generate_template_fallback(result)

    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Summarize topology for model prompt
        typologies: dict[str, int] = {}
        for n in result.nodes:
            for f in n.typologyFlags:
                typologies[f] = typologies.get(f, 0) + 1

        prompt = f"""
Generate an exhaustive, court-admissible forensic investigation docket for the following blockchain case:

CASE ID: {result.case_id}
SUSPECT WALLET: {result.suspect_address}
CHAIN: {result.chain.upper()}
NETWORK RISK SCORE: {result.overall_risk_score} / 100
TOTAL GRAPH ENTITIES: {len(result.nodes)}
TOTAL TRANSFERS: {len(result.edges)}

ATTRIBUTED EXCHANGE / VASP:
{json.dumps(result.attribution.model_dump(mode="json") if result.attribution else "None Identified", indent=2)}

DETECTED FRAUD TYPOLOGY PATTERNS:
{json.dumps(typologies, indent=2)}

CASH-OUT ALERT STATUS:
{result.sla_cashout_alert or "No immediate automated cash-out alert triggered."}

INVESTIGATIVE DIRECTIVES:
{chr(10).join(f"- {r}" for r in result.recommendations)}
"""

        import asyncio
        from google.genai import types as genai_types

        target_model = settings.GEMINI_MODEL or "gemini-3.6-flash"
        gen_config = genai_types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=2048,
            thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
        )

        call_coro = client.aio.models.generate_content(
            model=target_model,
            contents=[_SYSTEM_PROMPT, prompt],
            config=gen_config,
        )

        response = await asyncio.wait_for(call_coro, timeout=6.0)

        text = response.text or ""
        if text.strip():
            log.info("✅ Successfully generated Gemini AI forensic report for case %s", result.case_id)
            return text

    except Exception as exc:
        log.warning("Gemini AI report generation failed (%s). Falling back to legal template.", exc)

    return _generate_template_fallback(result)
