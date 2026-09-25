"use client";

import React, { useState } from "react";
import { Download, ShieldCheck, FileCheck, Loader2 } from "lucide-react";
import { generateNotice } from "@/lib/api";
import { LegalNoticePayload, NoticeGenerateResponse } from "@/lib/types";

interface NoticePreviewProps {
  caseId?: string;
  vaspName?: string;
  depositAddress?: string;
  evidenceHash?: string;
  pdfUrl?: string;
  noticeRef?: string;
  isFiuRegistered?: boolean;
  payload?: LegalNoticePayload;
}

export function NoticePreview({
  caseId = "CS-2026-8891",
  vaspName = "CoinDCX",
  depositAddress = "TCOINDCXDEPOSIT9988776655443311",
  evidenceHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  pdfUrl: initialPdfUrl,
  noticeRef: initialNoticeRef,
  isFiuRegistered = true,
  payload,
}: NoticePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [noticeData, setNoticeData] = useState<NoticeGenerateResponse | null>(null);

  const activePdfUrl = noticeData?.pdfUrl || noticeData?.pdf_url || initialPdfUrl;
  const activeHash = noticeData?.sha256_evidence_hash || evidenceHash;
  const activeVasp = noticeData?.vasp_name || vaspName;
  const activeRef = noticeData?.notice_ref || initialNoticeRef || `NOTICE-${caseId}`;

  const handleGeneratePDF = async () => {
    if (activePdfUrl && activePdfUrl !== "#mock-pdf-url") {
      window.open(activePdfUrl, "_blank");
      return;
    }

    setLoading(true);
    try {
      const noticePayload: LegalNoticePayload = payload || {
        case_number: caseId,
        suspect_address: depositAddress,
        attributed_vasp: {
          vasp_name: activeVasp,
          is_fiu_registered: isFiuRegistered,
          confidence_score: 0.95,
          deposit_address: depositAddress,
          hot_wallet_address: "THOTWALLETHOLDER00000000000000",
          nodal_officer_email: "nodal@coindcx.com",
        },
        loss_amount_inr: 500000,
        flow_summary: `Section 94 BNSS Legal Notice for Case ${caseId}`,
        sha256_evidence_hash: activeHash.padStart(64, "0").slice(0, 64),
      };

      const res = await generateNotice(noticePayload);
      setNoticeData(res);
      if (res.pdf_url || res.pdfUrl) {
        const targetUrl = res.pdf_url || res.pdfUrl;
        if (targetUrl && targetUrl !== "#mock-pdf-url") {
          window.open(targetUrl, "_blank");
        }
      }
    } catch (err: unknown) {
      console.error("Failed to generate notice PDF:", err);
      alert(`Notice Generation Failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-4">
      {/* Notice header */}
      <div className="glass-panel flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="font-display text-base font-bold text-[var(--primary)] uppercase tracking-wide">
            Formal Freeze Order — Section 94 BNSS, 2023
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
            Reference Case ID: {caseId} · Ref: {activeRef}
          </p>
        </div>
        <button
          type="button"
          onClick={handleGeneratePDF}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--primary-hover)] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {loading ? "Generating PDF…" : "Download PDF"}
        </button>
      </div>

      {/* Notice body */}
      <div className="glass-panel p-6 space-y-4 text-sm leading-relaxed text-[var(--foreground)]">
        <p className="font-semibold">TO: Nodal Compliance Officer, {activeVasp}</p>
        <p className="text-[var(--muted-foreground)]">
          WHEREAS information has been laid before the undersigned Cyber Crime Police Station regarding stolen victim
          funds routed through crypto networks and attributed to accounts maintained on your Virtual Asset Service
          Provider (VASP) platform…
        </p>
        <p className="font-semibold text-[var(--primary)]">
          YOU ARE HEREBY DIRECTED TO IMMEDIATELY FREEZE AND RESTRAIN MOVEMENT ON THE SPECIFIED DEPOSIT ACCOUNT:
        </p>
        <div className="rounded-xl border-2 border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            KYC Deposit Address
          </p>
          <p className="font-mono text-sm text-[var(--foreground)] break-all">{depositAddress}</p>
        </div>
      </div>

      {/* Evidence certificate */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-sm border-b border-[color-mix(in_oklab,var(--border)_40%,transparent)] pb-3">
          <ShieldCheck className="size-4" />
          Section 63 BSA Evidence Certificate (Digital Hash Stamp)
        </div>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          This document carries a cryptographically verifiable SHA-256 hash stamp corresponding to the graph traversal
          chain recorded at the time of legal notice issuance.
        </p>
        <div className="flex items-center gap-2">
          <FileCheck className="size-4 text-[var(--primary)] shrink-0" />
          <code className="flex-1 truncate rounded-lg bg-white/60 border border-[color-mix(in_oklab,var(--border)_50%,transparent)] px-3 py-1.5 font-mono text-xs text-[var(--foreground)]">
            {activeHash}
          </code>
        </div>
      </div>
    </div>
  );
}
