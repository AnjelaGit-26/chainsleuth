"""
routes_notice.py – Legal notice generation endpoint.

POST /api/v1/notices/generate
  Accepts a LegalNoticePayload, invokes the WeasyPrint PDF renderer,
  and returns the PDF URL and SHA-256 evidence hash.

GET  /api/v1/notices/{notice_id}/download
  Streams the generated PDF file.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.legal.pdf_generator import OUTPUT_DIR, generate_legal_notice_pdf
from app.models.schemas import LegalNoticePayload

log    = logging.getLogger(__name__)
router = APIRouter(prefix="/notices", tags=["Legal Notices"])


# ── Response model ────────────────────────────────────────────────────────────

class NoticeGenerateResponse(BaseModel):
    """Response returned after successful legal notice PDF generation."""

    notice_ref:          str   = Field(..., description="Unique notice reference number")
    pdf_url:             str   = Field(..., description="Relative URL to download the PDF")
    sha256_evidence_hash: str  = Field(..., description="SHA-256 hash embedded in the notice")
    vasp_name:           str   = Field(..., description="Name of the addressed VASP")
    case_number:         str   = Field(..., description="FIR / case number")
    is_fiu_registered:   bool  = Field(..., description="Whether the VASP is FIU-IND registered")


# ── POST /notices/generate ────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=NoticeGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a Section 94 BNSS legal notice PDF",
    description=(
        "Accepts a LegalNoticePayload containing case details, VASP attribution, "
        "loss amount, and the SHA-256 evidence hash. Renders a court-ready PDF via "
        "WeasyPrint and returns the download URL along with the embedded evidence hash."
    ),
)
async def generate_notice(payload: LegalNoticePayload) -> NoticeGenerateResponse:
    """
    Generate a Section 94 BNSS legal notice addressed to a VASP / exchange.

    Steps:
      1. Pass the LegalNoticePayload to the WeasyPrint PDF renderer.
      2. The renderer embeds the SHA-256 evidence hash as a tamper-evident stamp.
      3. Save the PDF to the static output directory.
      4. Return the download URL and notice metadata.
    """
    try:
        pdf_path, notice_ref = await generate_legal_notice_pdf(payload)
    except RuntimeError as exc:
        # WeasyPrint not installed
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(exc),
        )
    except Exception as exc:
        log.exception("PDF generation failed for case %s: %s", payload.case_number, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation error: {exc}",
        )

    pdf_url = f"/static/notices/{pdf_path.name}"

    log.info(
        "Notice generated: ref=%s case=%s vasp=%s path=%s",
        notice_ref, payload.case_number,
        payload.attributed_vasp.vasp_name, pdf_path,
    )

    return NoticeGenerateResponse(
        notice_ref           = notice_ref,
        pdf_url              = pdf_url,
        sha256_evidence_hash = payload.sha256_evidence_hash,
        vasp_name            = payload.attributed_vasp.vasp_name,
        case_number          = payload.case_number,
        is_fiu_registered    = payload.attributed_vasp.is_fiu_registered,
    )


# ── GET /notices/{notice_id}/download ────────────────────────────────────────

@router.get(
    "/{notice_id}/download",
    summary="Download a generated legal notice PDF",
    response_class=FileResponse,
)
async def download_notice(notice_id: str) -> FileResponse:
    """
    Stream the PDF file for a previously generated legal notice.

    *notice_id* is the notice reference (e.g. ``NOTICE-AB12CD34``),
    not the full filename — the ``.pdf`` extension is appended automatically.
    """
    pdf_path = OUTPUT_DIR / f"{notice_id}.pdf"

    if not pdf_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notice PDF '{notice_id}' not found. Generate it first via POST /notices/generate.",
        )

    return FileResponse(
        path         = str(pdf_path),
        media_type   = "application/pdf",
        filename     = f"{notice_id}.pdf",
        headers      = {"Content-Disposition": f'attachment; filename="{notice_id}.pdf"'},
    )
