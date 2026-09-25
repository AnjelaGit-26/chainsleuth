"use client";

import React, { useState } from "react";
import { Download, ShieldCheck, FileCheck, Copy, Check, FileText, Archive, Loader2, AlertCircle } from "lucide-react";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { downloadCourtEvidenceBundle } from "@/lib/api";
import { EvidenceCertModal } from "@/components/case/EvidenceCertModal";

interface NoticePreviewProps {
  caseId?: string;
  pdfUrl?: string;
  vaspName?: string;
  depositAddress?: string;
  hotWalletAddress?: string;
  evidenceHash?: string;
  lossAmountInr?: number;
}

export function NoticePreview({
  caseId = "",
  pdfUrl,
  vaspName = "",
  depositAddress = "",
  hotWalletAddress = "",
  evidenceHash = "",
  lossAmountInr,
}: NoticePreviewProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [isExportingBundle, setIsExportingBundle] = useState(false);
  const [bundleExportError, setBundleExportError] = useState<string | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  const handleExportBundle = async () => {
    if (isExportingBundle) return;
    setIsExportingBundle(true);
    setBundleExportError(null);
    try {
      await downloadCourtEvidenceBundle(caseId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection error: Unable to reach backend server.";
      setBundleExportError(message);
    } finally {
      setIsExportingBundle(false);
    }
  };

  const handleCopyHash = () => {
    if (!evidenceHash) return;
    navigator.clipboard.writeText(evidenceHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownload = () => {
    if (pdfUrl && pdfUrl !== "#mock-pdf-url") {
      window.open(pdfUrl, "_blank");
    } else {
      const element = document.createElement("a");
      const file = new Blob(
        [
          `CHAINSLEUTH FORMAL LEGAL NOTICE - SECTION 94 BNSS\nCase ID: ${caseId}\nTarget VASP: ${vaspName}\nDeposit Address: ${depositAddress}\nEvidence SHA-256: ${evidenceHash}`,
        ],
        { type: "text/plain" }
      );
      element.href = URL.createObjectURL(file);
      element.download = `SECTION_94_BNSS_NOTICE_${caseId || "RECORD"}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded p-6 font-mono text-xs text-slate-300 space-y-5 select-none relative overflow-hidden">
      {/* DEMO / DRAFT Watermark Banner */}
      <div className="w-full bg-amber-950/70 border border-amber-800/80 p-2 rounded text-center text-amber-400 font-sans font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2">
        <span>[ DEMO / DRAFT LEGAL DIRECTIVE — FOR INVESTIGATION TESTING ONLY ]</span>
      </div>

      {/* Header & Download Bar */}
      <div className="flex flex-col space-y-3 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-teal-400 font-bold text-sm tracking-wider uppercase font-sans flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-400" />
              FORMAL FREEZE DIRECTIVE — SECTION 94 BNSS, 2023
            </div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              Cyber Crime Police Station • Reference Case ID: {caseId}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBundle}
              disabled={isExportingBundle}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer disabled:cursor-not-allowed border border-emerald-500/50"
            >
              {isExportingBundle ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span className="text-slate-200">Exporting...</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 text-slate-950" />
                  <span>Download Evidence Bundle</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-teal-300 font-sans font-bold text-xs rounded border border-teal-800/80 transition-colors shadow cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>View Certificate Details</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Official PDF Notice
            </button>
          </div>
        </div>

        {bundleExportError && (
          <div className="p-2.5 bg-red-950/90 border border-red-700/80 rounded text-red-200 text-[11px] font-mono flex items-start justify-between gap-2 shadow">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{bundleExportError}</span>
            </div>
            <button
              type="button"
              onClick={() => setBundleExportError(null)}
              className="text-red-400 hover:text-red-200 font-bold ml-1"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Inline Document Container / iFrame Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded p-6 text-slate-200 space-y-4 shadow-2xl relative">
        {pdfUrl && pdfUrl !== "#mock-pdf-url" ? (
          <iframe
            src={pdfUrl}
            className="w-full h-96 border border-slate-800 rounded"
            title="PDF Notice Preview"
          />
        ) : (
          <div className="space-y-4 font-mono leading-relaxed text-xs">
            {/* Legal Document Header */}
            <div className="text-center border-b border-slate-800 pb-4 space-y-1">
              <div className="font-bold text-slate-100 font-sans text-sm tracking-wider">
                OFFICE OF THE SUPERINTENDENT OF POLICE
              </div>
              <div className="text-slate-400 text-[11px]">
                CYBER CRIME INVESTIGATION CELL • POLICE HEADQUARTERS
              </div>
              <div className="text-teal-400 font-bold text-xs pt-1">
                NOTICE UNDER SECTION 94 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023
              </div>
            </div>

            {/* Target Address Details */}
            <div className="space-y-2 pt-2">
              <div>
                <span className="text-slate-400 block font-semibold text-[11px]">TO:</span>
                <span className="text-slate-100 font-bold font-sans text-xs">{vaspName}</span>
                <span className="text-slate-500 block text-[10px]">
                  Designated Compliance & Nodal Office (FIU-IND Registered)
                </span>
              </div>

              <p className="text-slate-300 text-justify">
                WHEREAS information has been received regarding cryptocurrency scam proceeds amounting to{" "}
                <span className="text-teal-300 font-bold">₹{(lossAmountInr ?? 0).toLocaleString()}</span> originating from victim accounts under FIR Reference <span className="text-slate-100 font-bold">{caseId || "N/A"}</span>.
              </p>

              <div className="p-3 bg-slate-950 border border-teal-500/80 rounded space-y-2">
                <div className="text-teal-400 font-bold font-sans text-[11px] uppercase tracking-wider">
                  ACTIONABLE ACCOUNT FREEZE DIRECTIVE:
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target KYC Deposit Address:</span>
                    <AddressBadge address={depositAddress} truncateLength={10} />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Exchange Sweep Hot Wallet:</span>
                    <AddressBadge address={hotWalletAddress} truncateLength={10} />
                  </div>
                </div>
              </div>

              <p className="text-slate-400 text-[11px]">
                YOU ARE HEREBY DIRECTED TO IMMEDIATELY RESTRAIN, FREEZE, AND PREVENT ALL WITHDRAWALS OR OUTBOUND TRANSFERS FROM THE SPECIFIED KYCD DEPOSIT ACCOUNT.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 63 BSA Digital Evidence Certificate Stamp */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs font-sans">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Section 63 BSA Digital Evidence Certificate</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">COURT-ADMISSIBLE HASH STAMP</span>
        </div>

        <p className="text-slate-400 text-[11px] leading-normal font-sans">
          This notice carries a cryptographically immutable SHA-256 evidence hash generated directly from the on-chain Cypher graph traversal snapshot at the time of legal issuance.
        </p>

        <div className="flex items-center justify-between gap-3 bg-slate-950 p-2 border border-slate-800 rounded font-mono text-[11px]">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="truncate text-teal-300 font-bold">{evidenceHash}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyHash}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors text-[10px] shrink-0 border border-slate-800 px-2 py-0.5 rounded cursor-pointer"
          >
            {copiedHash ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedHash ? "Copied" : "Copy Hash"}</span>
          </button>
        </div>
      </div>

      <EvidenceCertModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        caseId={caseId}
      />
    </div>
  );
}
