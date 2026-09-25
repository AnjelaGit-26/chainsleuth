"""
routes_report.py – Forensic Legal Report Generation Endpoints.

Provides:
  POST /api/v1/report/generate – Generate a court-admissible forensic docket from TraceResult
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import User, get_current_user
from app.engine.ml_report_generator import generate_forensic_report
from app.models.schemas import TraceResult

log = logging.getLogger(__name__)

router = APIRouter(prefix="/report", tags=["Forensic Reports"])


class ReportResponse(BaseModel):
    case_id: str
    suspect_address: str
    chain: str
    overall_risk_score: int
    report: str


@router.post(
    "/generate",
    response_model=ReportResponse,
    summary="Generate court-admissible forensic report",
    description="Uses Gemini AI and legal formatting templates to produce an Indian law enforcement investigation docket.",
)
async def create_forensic_report(
    trace_result: TraceResult,
    current_user: User = Depends(get_current_user),
) -> ReportResponse:
    try:
        report_text = await generate_forensic_report(trace_result)
        return ReportResponse(
            case_id=trace_result.case_id,
            suspect_address=trace_result.suspect_address,
            chain=trace_result.chain,
            overall_risk_score=trace_result.overall_risk_score,
            report=report_text,
        )
    except Exception as exc:
        log.exception("Report generation endpoint error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation error: {exc}",
        )
