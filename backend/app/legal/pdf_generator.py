"""
pdf_generator.py – Section 94 BNSS legal notice PDF renderer.

Uses Jinja2 to render a legally-formatted HTML notice template, then
converts it to a press-quality PDF via WeasyPrint.

The generated PDF embeds:
  - Full case metadata and VASP attribution details
  - Complete transaction flow summary
  - Section 63 BSA SHA-256 evidence hash stamp (tamper-evident seal)
  - Section 94 BNSS legal compulsion clause for data production

Legal framework:
  - Section 94  BNSS 2023 – Production of documents / electronic records
  - Section 63  BSA  2023 – Admissibility of electronic evidence
  - PMLA 2002   – Anti-money-laundering compliance obligation
  - IT Act 2000 – Cybercrime jurisdiction
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from jinja2 import BaseLoader, Environment, TemplateNotFound, select_autoescape

from app.models.schemas import FIRCreate, LegalNoticePayload

log = logging.getLogger(__name__)

# Output directory for generated PDFs (accessible via FastAPI /static mount)
OUTPUT_DIR = Path("static/notices")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

FIR_OUTPUT_DIR = Path("static/fir")
FIR_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Jinja2 inline template (no filesystem dependency) ────────────────────────

_NOTICE_TEMPLATE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Legal Notice – Section 94 BNSS | Case {{ case_number }}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&family=Noto+Sans:wght@400;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'EB Garamond', Georgia, serif;
      font-size: 12pt;
      color: #1a1a1a;
      background: #fff;
      padding: 60px 72px;
      line-height: 1.65;
    }

    /* ── Header ─────────────────────────────────────────────────── */
    .header {
      text-align: center;
      border-bottom: 3px double #1a1a1a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header .emblem { font-size: 36pt; line-height: 1; }
    .header h1 {
      font-size: 15pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 6px;
    }
    .header h2 {
      font-size: 12pt;
      font-weight: 600;
      color: #444;
      margin-top: 2px;
    }
    .header .notice-type {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 18px;
      border: 1.5px solid #1a1a1a;
      font-size: 10pt;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-family: 'Noto Sans', sans-serif;
    }

    /* ── Meta block ─────────────────────────────────────────────── */
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .meta-table td { padding: 4px 8px; vertical-align: top; font-size: 11pt; }
    .meta-table td.label { font-weight: 600; width: 32%; color: #333; }
    .meta-table td.value { color: #111; }

    /* ── Section headings ───────────────────────────────────────── */
    h3 {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #999;
      padding-bottom: 4px;
      margin: 24px 0 10px;
    }

    /* ── Body paragraphs ────────────────────────────────────────── */
    p { margin-bottom: 12px; text-align: justify; }

    /* ── Address / code blocks ──────────────────────────────────── */
    .mono {
      font-family: 'Noto Sans', 'Courier New', monospace;
      font-size: 9.5pt;
      background: #f4f4f4;
      border: 1px solid #ddd;
      border-radius: 3px;
      padding: 2px 6px;
      word-break: break-all;
    }

    /* ── Evidence hash stamp ─────────────────────────────────────── */
    .hash-stamp {
      border: 2px solid #1a1a1a;
      border-radius: 4px;
      padding: 14px 18px;
      background: #fafafa;
      margin: 20px 0;
    }
    .hash-stamp .stamp-label {
      font-family: 'Noto Sans', sans-serif;
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 6px;
    }
    .hash-stamp .hash-value {
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      color: #1a1a1a;
      word-break: break-all;
    }
    .hash-stamp .hash-meta {
      font-size: 9pt;
      color: #666;
      margin-top: 6px;
      font-family: 'Noto Sans', sans-serif;
    }

    /* ── VASP detail table ───────────────────────────────────────── */
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 11pt;
    }
    .detail-table th {
      background: #1a1a1a;
      color: #fff;
      padding: 6px 10px;
      text-align: left;
      font-family: 'Noto Sans', sans-serif;
      font-size: 9pt;
      letter-spacing: 0.5px;
    }
    .detail-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    .detail-table tr:nth-child(even) td { background: #f9f9f9; }

    /* ── Legal compulsion clause ─────────────────────────────────── */
    .legal-clause {
      border-left: 4px solid #1a1a1a;
      padding: 10px 16px;
      background: #f8f8f8;
      font-style: italic;
      font-size: 11pt;
      margin: 20px 0;
    }

    /* ── Signature block ─────────────────────────────────────────── */
    .signature-block {
      margin-top: 48px;
      display: flex;
      justify-content: space-between;
    }
    .sig-col { width: 45%; }
    .sig-line {
      border-top: 1px solid #1a1a1a;
      margin-top: 48px;
      padding-top: 6px;
      font-size: 10pt;
      color: #333;
    }

    /* ── Footer ──────────────────────────────────────────────────── */
    .footer {
      margin-top: 40px;
      border-top: 1px solid #ccc;
      padding-top: 10px;
      font-size: 8.5pt;
      color: #888;
      text-align: center;
      font-family: 'Noto Sans', sans-serif;
    }
  </style>
</head>
<body>

<!-- ══ HEADER ══════════════════════════════════════════════════════════════ -->
<div class="header">
  <div class="emblem">⚖</div>
  <h1>Government of India</h1>
  <h2>{{ issuing_authority }}</h2>
  <div class="notice-type">Legal Notice — Section 94 BNSS 2023</div>
</div>

<!-- ══ CASE METADATA ══════════════════════════════════════════════════════ -->
<table class="meta-table">
  <tr>
    <td class="label">Notice Reference No.</td>
    <td class="value">{{ notice_ref }}</td>
    <td class="label">Date of Issue</td>
    <td class="value">{{ issue_date }}</td>
  </tr>
  <tr>
    <td class="label">FIR / Case Number</td>
    <td class="value"><strong>{{ case_number }}</strong></td>
    <td class="label">Case Status</td>
    <td class="value">Active Investigation</td>
  </tr>
  <tr>
    <td class="label">Requesting Authority</td>
    <td class="value">{{ requesting_authority }}</td>
    <td class="label">Designated Officer</td>
    <td class="value">{{ officer_name }}</td>
  </tr>
</table>

<!-- ══ ADDRESSEE ══════════════════════════════════════════════════════════ -->
<h3>To</h3>
<p>
  <strong>The Nodal / Compliance Officer</strong><br/>
  {{ vasp_name }}<br/>
  Email: <span class="mono">{{ nodal_email }}</span>
  {% if nodal_phone %}<br/>Phone: {{ nodal_phone }}{% endif %}
</p>

<!-- ══ SUBJECT ═════════════════════════════════════════════════════════════ -->
<h3>Subject</h3>
<p>
  Production of Know-Your-Customer (KYC) Records, Transaction Logs, and
  User Account Details under <strong>Section 94 of the Bharatiya Nagarik
  Suraksha Sanhita (BNSS) 2023</strong> in connection with FIR
  <strong>{{ case_number }}</strong> — Cryptocurrency Fraud Investigation
  (Estimated Loss: ₹{{ "{:,.2f}".format(loss_amount_inr) }}).
</p>

<!-- ══ LEGAL COMPULSION CLAUSE ════════════════════════════════════════════ -->
<div class="legal-clause">
  Pursuant to Section 94 of the Bharatiya Nagarik Suraksha Sanhita 2023,
  you are hereby directed to produce, within <strong>7 (seven) working days</strong>
  of receipt of this notice, all documents, electronic records, and KYC data
  pertaining to the account(s) specified herein. Failure to comply constitutes
  an offence under Section 179 IPC / Section 63 BSA 2023 and may result in
  punitive action including prosecution.
</div>

<!-- ══ SUSPECT DETAILS ════════════════════════════════════════════════════ -->
<h3>Suspect Blockchain Address</h3>
<table class="detail-table">
  <tr>
    <th>Field</th>
    <th>Value</th>
  </tr>
  <tr>
    <td>Suspect Address</td>
    <td><span class="mono">{{ suspect_address }}</span></td>
  </tr>
  <tr>
    <td>Blockchain Network</td>
    <td>{{ chain | upper }}</td>
  </tr>
  <tr>
    <td>Attribution Confidence</td>
    <td>{{ "%.1f" | format(confidence_score * 100) }}%</td>
  </tr>
  <tr>
    <td>VASP Deposit Address (KYC-linked)</td>
    <td><span class="mono">{{ deposit_address }}</span></td>
  </tr>
  <tr>
    <td>VASP Hot Wallet (Sweep Address)</td>
    <td><span class="mono">{{ hot_wallet_address }}</span></td>
  </tr>
  <tr>
    <td>FIU-IND Registered</td>
    <td>{{ "YES" if is_fiu_registered else "NO — Note: Compliance obligations still apply under PMLA 2002" }}</td>
  </tr>
  <tr>
    <td>Estimated Loss (INR)</td>
    <td><strong>₹{{ "{:,.2f}".format(loss_amount_inr) }}</strong></td>
  </tr>
</table>

<!-- ══ TRANSACTION FLOW SUMMARY ═══════════════════════════════════════════ -->
<h3>Transaction Flow Summary</h3>
<p>{{ flow_summary }}</p>

<!-- ══ SHA-256 EVIDENCE HASH STAMP ════════════════════════════════════════ -->
<h3>Section 63 BSA Evidence Integrity Stamp</h3>
<div class="hash-stamp">
  <div class="stamp-label">🔒 SHA-256 Evidence Hash (Tamper-Evident Seal)</div>
  <div class="hash-value">{{ sha256_evidence_hash }}</div>
  <div class="hash-meta">
    Generated: {{ generated_at }} UTC &nbsp;|&nbsp;
    Algorithm: SHA-256 (FIPS 180-4) &nbsp;|&nbsp;
    Legal basis: Section 63 BSA 2023 / Section 79A IT Act 2000
  </div>
</div>

<p style="font-size:10pt; color:#555;">
  The SHA-256 hash above was computed over a canonically sorted, UTF-8 encoded
  JSON representation of all transaction hashes and wallet node addresses
  constituting this evidence chain. Any modification to the underlying
  transaction data will produce a different hash, rendering tampering detectable.
</p>

<!-- ══ LEGAL BASIS ════════════════════════════════════════════════════════ -->
<h3>Legal Basis</h3>
<p>
  This notice is issued under the authority of the following statutes:
</p>
<table class="detail-table">
  <tr><th>Statute</th><th>Provision</th><th>Application</th></tr>
  <tr>
    <td>BNSS 2023</td>
    <td>Section 94</td>
    <td>Compulsory production of electronic records / documents</td>
  </tr>
  <tr>
    <td>BSA 2023</td>
    <td>Section 63</td>
    <td>Admissibility of electronic evidence; hash certification</td>
  </tr>
  <tr>
    <td>PMLA 2002</td>
    <td>Sections 12 &amp; 13</td>
    <td>Obligation to maintain and furnish KYC / AML records</td>
  </tr>
  <tr>
    <td>IT Act 2000</td>
    <td>Sections 69B &amp; 79A</td>
    <td>Cyber investigation powers; electronic evidence certification</td>
  </tr>
</table>

<!-- ══ INFORMATION REQUIRED ══════════════════════════════════════════════ -->
<h3>Information Required</h3>
<p>Please provide the following within <strong>7 working days</strong>:</p>
<ol style="margin-left:24px; margin-bottom:12px;">
  <li>Full KYC records (name, address, ID proofs) for the deposit address
      <span class="mono">{{ deposit_address }}</span></li>
  <li>Complete transaction history for the above address from inception</li>
  <li>IP address logs, device fingerprints, and login timestamps</li>
  <li>Any linked accounts and associated KYC documents</li>
  <li>Correspondence (email / chat) related to the account</li>
  <li>Current account balance and any freeze/flag status</li>
</ol>

<!-- ══ SIGNATURE ══════════════════════════════════════════════════════════ -->
<div class="signature-block">
  <div class="sig-col">
    <div class="sig-line">
      <strong>{{ officer_name }}</strong><br/>
      {{ officer_designation }}<br/>
      {{ issuing_authority }}
    </div>
  </div>
  <div class="sig-col" style="text-align:right;">
    <div class="sig-line">
      Official Seal / Digital Signature<br/>
      Date: {{ issue_date }}
    </div>
  </div>
</div>

<!-- ══ FOOTER ════════════════════════════════════════════════════════════ -->
<div class="footer">
  CONFIDENTIAL — FOR LAW ENFORCEMENT USE ONLY &nbsp;|&nbsp;
  Generated by ChainSleuth Forensic Platform &nbsp;|&nbsp;
  Notice Ref: {{ notice_ref }} &nbsp;|&nbsp;
  {{ generated_at }} UTC
</div>

</body>
</html>
"""


# ── Jinja2 environment with inline loader ─────────────────────────────────────

class _InlineLoader(BaseLoader):
    """Jinja2 loader that serves templates from in-memory strings."""

    def __init__(self, templates: dict[str, str]):
        self._templates = templates

    def get_source(self, environment: Environment, template: str):
        src = self._templates.get(template)
        if src is None:
            raise TemplateNotFound(template)
        return src, None, lambda: True


_FIR_TEMPLATE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>First Information Report – Case {{ fir_number }}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&family=Noto+Sans:wght@400;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'EB Garamond', Georgia, serif;
      font-size: 11.5pt;
      color: #1a1a1a;
      background: #fff;
      padding: 50px 65px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px double #1a1a1a;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }
    .header h1 {
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .header h2 {
      font-size: 11pt;
      font-weight: 600;
      color: #333;
      margin-top: 2px;
    }
    .header .tag {
      display: inline-block;
      margin-top: 6px;
      padding: 2px 14px;
      border: 1.5px solid #1a1a1a;
      font-size: 9pt;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-family: 'Noto Sans', sans-serif;
      font-weight: bold;
    }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    .meta-table td { padding: 5px 8px; vertical-align: top; font-size: 10pt; border: 1px solid #ccc; }
    .meta-table td.label { font-weight: 600; width: 32%; color: #333; background: #f7f7f7; }
    .meta-table td.value { color: #111; }
    h3 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #888;
      padding-bottom: 2px;
      margin: 16px 0 6px;
    }
    p { margin-bottom: 8px; text-align: justify; }
    .mono {
      font-family: 'Courier New', monospace;
      font-size: 8.5pt;
      background: #f4f4f4;
      border: 1px solid #ddd;
      border-radius: 2px;
      padding: 1px 4px;
      word-break: break-all;
    }
    .sig-row { display: flex; justify-content: space-between; margin-top: 32px; }
    .sig-col { width: 45%; }
    .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 9.5pt; }
    .footer {
      border-top: 1px solid #ccc;
      margin-top: 24px;
      padding-top: 6px;
      font-size: 8pt;
      color: #777;
      text-align: center;
    }
  </style>
</head>
<body>
<div class="header">
  <h2>STATE POLICE CYBER CRIME INVESTIGATION DIVISION</h2>
  <h1>FIRST INFORMATION REPORT</h1>
  <div class="tag">Under Section 173 BNSS 2023 / Section 154 CrPC</div>
</div>

<table class="meta-table">
  <tr>
    <td class="label">FIR Number</td>
    <td class="value"><strong>{{ fir_number }}</strong></td>
  </tr>
  <tr>
    <td class="label">Case Reference ID</td>
    <td class="value">{{ case_id }}</td>
  </tr>
  <tr>
    <td class="label">Police Station / Cyber Cell</td>
    <td class="value">{{ police_station }}</td>
  </tr>
  <tr>
    <td class="label">Date & Time of Occurrence</td>
    <td class="value">{{ date_of_incident }}</td>
  </tr>
  <tr>
    <td class="label">Complainant / Informant</td>
    <td class="value">{{ complainant_name }} ({{ complainant_designation }})</td>
  </tr>
  <tr>
    <td class="label">Suspect Wallet Address(es)</td>
    <td class="value">
      {% for addr in suspect_addresses %}
        <span class="mono">{{ addr }}</span><br/>
      {% else %}
        <span class="mono">Under active forensic examination</span>
      {% endfor %}
    </td>
  </tr>
  <tr>
    <td class="label">Estimated Financial Loss</td>
    <td class="value">
      {% if estimated_loss_inr %}
        ₹ {{ "{:,.2f}".format(estimated_loss_inr) }} INR
      {% else %}
        Under assessment
      {% endif %}
    </td>
  </tr>
  <tr>
    <td class="label">Statutory Provisions & Acts</td>
    <td class="value">
      Sections 316 / 318 Bharatiya Nyaya Sanhita (BNS) 2023 (Cheating & Criminal Breach of Trust);
      Section 66D Information Technology Act 2000;
      Prevention of Money Laundering Act (PMLA) 2002.
    </td>
  </tr>
</table>

<h3>1. Brief Narrative of Incident / Modus Operandi</h3>
<p>{{ incident_description }}</p>

<h3>2. Blockchain Intelligence & Forensic Summary</h3>
<p>
  Preliminary cyber forensics conducted via ChainSleuth Automated Forensic Analytics
  indicates transfer of stolen victim assets into non-custodial intermediary transit wallets
  exhibiting rapid smurfing, peeling-chain dispersion, and off-ramping into cryptocurrency
  exchanges / Virtual Asset Service Providers (VASPs).
</p>
<p>
  This First Information Report formally initiates criminal investigation under the Bharatiya Nagarik
  Suraksha Sanhita (BNSS) 2023. Concurrently, Section 94 BNSS Legal Freeze Directives are being served
  to the identified exchanges to freeze the actionable KYC deposit accounts prior to fiat dissipation.
</p>

<div class="sig-row">
  <div class="sig-col">
    <div class="sig-line">
      Signature of Informant / Complainant<br/>
      Name: {{ complainant_name }}
    </div>
  </div>
  <div class="sig-col" style="text-align:right;">
    <div class="sig-line">
      Signature of Station House Officer (SHO)<br/>
      Rank: Inspector of Police (Cyber Crime)<br/>
      Date: {{ generated_at }}
    </div>
  </div>
</div>

<div class="footer">
  CONFIDENTIAL — LAW ENFORCEMENT RECORD | CHAIN SLEUTH FORENSIC INTEGRATION | {{ fir_number }}
</div>
</body>
</html>
"""

_jinja_env = Environment(
    loader=_InlineLoader({
        "notice.html": _NOTICE_TEMPLATE_HTML,
        "fir.html": _FIR_TEMPLATE_HTML,
    }),
    autoescape=select_autoescape(["html"]),
)


# ── ReportLab Pure-Python Fallback Renderers ─────────────────────────────────

def _render_notice_reportlab(context: dict, output_path: Path) -> None:
    """Render Section 94 Notice PDF using ReportLab as a pure-Python fallback."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'NoticeTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        alignment=1,
        spaceAfter=10,
        textColor=colors.HexColor('#0f172a'),
    )
    sub_style = ParagraphStyle(
        'NoticeSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        alignment=1,
        textColor=colors.HexColor('#334155'),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        'NoticeBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
    )
    bold_body = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold',
    )
    mono_style = ParagraphStyle(
        'NoticeMono',
        parent=body_style,
        fontName='Courier',
        fontSize=8.5,
    )

    story = []
    story.append(Paragraph("LEGAL NOTICE UNDER SECTION 94 BNSS 2023", title_style))
    story.append(Paragraph(f"<b>Notice Ref:</b> {context['notice_ref']} | <b>Date:</b> {context['issue_date']}", sub_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceAfter=12))

    story.append(Paragraph(f"<b>TO:</b> The Nodal / Compliance Officer, {context['vasp_name']}<br/>Email: {context['nodal_email']}", body_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph(f"<b>SUBJECT:</b> Production of KYC Records &amp; Transaction Logs under Section 94 BNSS in Case {context['case_number']}", bold_body))
    story.append(Spacer(1, 6))

    clause_text = (
        "Pursuant to Section 94 of the Bharatiya Nagarik Suraksha Sanhita 2023, you are hereby directed to produce, "
        "within 7 (seven) working days of receipt of this notice, all KYC records, electronic logs, and user data "
        "associated with the suspect cryptocurrency wallet address identified below."
    )
    story.append(Paragraph(clause_text, body_style))
    story.append(Spacer(1, 10))

    data = [
        [Paragraph("<b>Suspect Address</b>", body_style), Paragraph(str(context['suspect_address']), mono_style)],
        [Paragraph("<b>Network</b>", body_style), Paragraph(str(context['chain']).upper(), body_style)],
        [Paragraph("<b>Target Deposit Address</b>", body_style), Paragraph(str(context['deposit_address']), mono_style)],
        [Paragraph("<b>Target Hot Wallet</b>", body_style), Paragraph(str(context['hot_wallet_address']), mono_style)],
        [Paragraph("<b>Confidence Score</b>", body_style), Paragraph(f"{float(context.get('confidence_score', 0))*100:.1f}%", body_style)],
        [Paragraph("<b>FIU-IND Registered</b>", body_style), Paragraph("YES" if context.get('is_fiu_registered') else "NO (Obligated under PMLA 2002)", body_style)],
        [Paragraph("<b>Estimated Loss (INR)</b>", body_style), Paragraph(f"Rs. {float(context.get('loss_amount_inr', 0)):,.2f}", bold_body)],
    ]
    t = Table(data, colWidths=[150, 354])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>Section 63 BSA Evidence Hash:</b>", bold_body))
    story.append(Paragraph(str(context.get('sha256_evidence_hash', '')), mono_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph(f"<b>Designated Officer:</b> {context['officer_name']}, {context['officer_designation']}<br/>{context['issuing_authority']}", body_style))
    doc.build(story)


def _render_fir_reportlab(context: dict, output_path: Path) -> None:
    """Render Cybercrime FIR PDF using ReportLab as a pure-Python fallback."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=54, rightMargin=54,
        topMargin=54, bottomMargin=54,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'FirTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        alignment=1,
        spaceAfter=10,
        textColor=colors.HexColor('#0f172a'),
    )
    sub_style = ParagraphStyle(
        'FirSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        alignment=1,
        textColor=colors.HexColor('#334155'),
        spaceAfter=12,
    )
    body_style = ParagraphStyle(
        'FirBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
    )
    bold_body = ParagraphStyle(
        'BoldBody',
        parent=body_style,
        fontName='Helvetica-Bold',
    )
    mono_style = ParagraphStyle(
        'FirMono',
        parent=body_style,
        fontName='Courier',
        fontSize=8.5,
    )

    story = []
    story.append(Paragraph("FIRST INFORMATION REPORT (FIR)", title_style))
    story.append(Paragraph(f"<b>FIR No:</b> {context['fir_number']} | <b>Police Station:</b> {context['police_station']}", sub_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0f172a'), spaceAfter=12))

    data = [
        [Paragraph("<b>Case Reference ID</b>", body_style), Paragraph(str(context['case_id']), mono_style)],
        [Paragraph("<b>Complainant Name</b>", body_style), Paragraph(str(context['complainant_name']), body_style)],
        [Paragraph("<b>Designation</b>", body_style), Paragraph(str(context['complainant_designation']), body_style)],
        [Paragraph("<b>Date of Incident</b>", body_style), Paragraph(str(context['date_of_incident']), body_style)],
        [Paragraph("<b>Suspect Addresses</b>", body_style), Paragraph(", ".join(context['suspect_addresses']), mono_style)],
        [Paragraph("<b>Estimated Loss (INR)</b>", body_style), Paragraph(f"Rs. {float(context['estimated_loss_inr']):,.2f}", bold_body)],
    ]
    t = Table(data, colWidths=[150, 354])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>Brief Facts &amp; Investigation Narrative:</b>", bold_body))
    story.append(Paragraph(str(context['incident_description']), body_style))
    doc.build(story)


async def generate_section_94_pdf(
    payload: LegalNoticePayload,
    requesting_authority: str = "State Cyber Crime Cell",
    issuing_authority: str    = "Office of the Superintendent of Police",
    officer_name: str         = "Cyber Crime Investigating Officer",
    officer_designation: str  = "Inspector of Police, Cyber PS",
) -> tuple[Path, str]:
    """
    Render a Section 94 BNSS legal notice PDF from a ``LegalNoticePayload``.
    Uses WeasyPrint when available, with automatic fallback to ReportLab.
    """
    notice_ref   = f"NOTICE-{str(uuid4()).upper()[:8]}"
    generated_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")
    issue_date   = datetime.now(UTC).strftime("%d %B %Y")

    vasp = payload.attributed_vasp

    context = {
        "notice_ref":           notice_ref,
        "issue_date":           issue_date,
        "generated_at":         generated_at,
        "case_number":          payload.case_number,
        "requesting_authority": requesting_authority,
        "issuing_authority":    issuing_authority,
        "officer_name":         officer_name,
        "officer_designation":  officer_designation,
        "vasp_name":            vasp.vasp_name,
        "nodal_email":          vasp.nodal_officer_email,
        "nodal_phone":          vasp.nodal_officer_phone,
        "is_fiu_registered":    vasp.is_fiu_registered,
        "deposit_address":      vasp.deposit_address,
        "hot_wallet_address":   vasp.hot_wallet_address,
        "confidence_score":     vasp.confidence_score,
        "suspect_address":      payload.suspect_address,
        "chain":                "tron",
        "loss_amount_inr":      payload.loss_amount_inr,
        "flow_summary":         payload.flow_summary,
        "sha256_evidence_hash": payload.sha256_evidence_hash,
    }

    output_path = OUTPUT_DIR / f"{notice_ref}.pdf"

    # Attempt WeasyPrint first, fall back to ReportLab
    rendered = False
    try:
        from weasyprint import HTML as WeasyprintHTML
        template     = _jinja_env.get_template("notice.html")
        html_content = template.render(**context)
        WeasyprintHTML(string=html_content).write_pdf(str(output_path))
        rendered = True
    except Exception as exc:
        log.warning("WeasyPrint unavailable (%s), rendering notice via ReportLab fallback", exc)

    if not rendered:
        _render_notice_reportlab(context, output_path)

    log.info(
        "Legal notice PDF generated: %s (case=%s, vasp=%s)",
        output_path, payload.case_number, vasp.vasp_name,
    )
    return output_path, notice_ref


# Alias for backward-compatibility with routes_notice.py
generate_legal_notice_pdf = generate_section_94_pdf


async def generate_fir_pdf(
    payload: FIRCreate,
    police_station: str = "State Cyber Crime Police Station",
) -> tuple[Path, str]:
    """
    Render an official Cybercrime First Information Report (FIR) PDF.
    Uses WeasyPrint when available, with automatic fallback to ReportLab.
    """
    fir_ref = f"FIR-{str(uuid4()).upper()[:8]}"
    generated_at = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    incident_date_str = payload.date_of_incident.strftime("%d %B %Y, %H:%M UTC")

    context = {
        "fir_number": fir_ref,
        "case_id": payload.case_id,
        "police_station": police_station,
        "date_of_incident": incident_date_str,
        "complainant_name": payload.complainant_name,
        "complainant_designation": payload.complainant_designation,
        "suspect_addresses": payload.suspect_addresses,
        "estimated_loss_inr": payload.estimated_loss_inr,
        "incident_description": payload.incident_description,
        "generated_at": generated_at,
    }

    output_path = FIR_OUTPUT_DIR / f"{fir_ref}.pdf"

    # Attempt WeasyPrint first, fall back to ReportLab
    rendered = False
    try:
        from weasyprint import HTML as WeasyprintHTML
        template = _jinja_env.get_template("fir.html")
        html_content = template.render(**context)
        WeasyprintHTML(string=html_content).write_pdf(str(output_path))
        rendered = True
    except Exception as exc:
        log.warning("WeasyPrint unavailable (%s), rendering FIR via ReportLab fallback", exc)

    if not rendered:
        _render_fir_reportlab(context, output_path)

    log.info(
        "FIR PDF generated: %s (case=%s, fir=%s)",
        output_path, payload.case_id, fir_ref,
    )
    return output_path, fir_ref


