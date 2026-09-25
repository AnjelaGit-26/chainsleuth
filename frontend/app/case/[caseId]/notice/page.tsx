"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { NoticePreview } from "@/components/legal/NoticePreview";
import { NoticeGeneratorButton } from "@/components/legal/NoticeGeneratorButton";
import { getCase, generateNotice } from "@/lib/api";
import { TraceResult, LegalNoticePayload } from "@/lib/types";
import { ArrowLeft, CheckCircle2, Loader2, AlertCircle, ShieldAlert } from "lucide-react";

const LOADING_SEQUENCE = [
  "Preparing case evidence & traversal graph snapshot",
  "Building Section 94 BNSS legal freeze notice template",
  "Generating Section 63 BSA digital evidence certificate",
  "Calculating cryptographic SHA-256 evidence hash",
  "Ready for legal service",
];

export default function LegalNoticePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const [traceData, setTraceData] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noticeResult, setNoticeResult] = useState<{
    pdfUrl: string;
    hash: string;
  } | null>(null);

  useEffect(() => {
    getCase(caseId)
      .then((data) => {
        setTraceData(data);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load investigation case data.");
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  const handleGenerateNotice = async () => {
    if (!traceData || !traceData.attribution) return;

    setGenerating(true);
    setCurrentStepIndex(0);
    setError(null);

    // Simulate progressive loading steps
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < LOADING_SEQUENCE.length - 1) {
          return prev + 1;
        }
        clearInterval(stepInterval);
        return prev;
      });
    }, 350);

    try {
      const payload: LegalNoticePayload = {
        case_number: caseId,
        suspect_address: traceData.suspect_address,
        attributed_vasp: traceData.attribution,
        loss_amount_inr: 0,
        flow_summary: traceData.attribution?.deposit_address
          ? `${(traceData.chain || "crypto").toUpperCase()} transfer traced into ${traceData.attribution.vasp_name} deposit address ${traceData.attribution.deposit_address}`
          : `Crypto asset transfer traced for suspect address ${traceData.suspect_address}`,
        sha256_evidence_hash: "",
      };

      const res = await generateNotice(payload);
      setNoticeResult({
        pdfUrl: res.pdfUrl,
        hash: res.sha256_evidence_hash,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF legal notice. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4 font-mono text-xs select-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 bg-slate-950">
          <div className="flex items-center gap-3">
            <Link
              href={`/case/${caseId}`}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              title="Back to Graph Workbench"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold font-sans text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-teal-400" />
                Section 94 BNSS Legal Freeze Notice Generator
              </h1>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Target VASP Freeze Directive & Section 63 BSA Evidence Hash Stamp
              </p>
            </div>
          </div>

          <NoticeGeneratorButton
            onGenerate={handleGenerateNotice}
            loading={generating}
          />
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 rounded text-red-400 flex items-center justify-between font-sans text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handleGenerateNotice}
              className="px-3 py-1 bg-red-900 hover:bg-red-800 text-slate-100 rounded text-xs font-mono transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content View */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs bg-slate-950 border border-slate-800 rounded">
            Loading investigation case parameters...
          </div>
        ) : (
          <div className="flex justify-center pt-2">
            <NoticePreview
              caseId={caseId}
              pdfUrl={noticeResult?.pdfUrl}
              vaspName={traceData?.attribution?.vasp_name}
              depositAddress={traceData?.attribution?.deposit_address}
              hotWalletAddress={traceData?.attribution?.hot_wallet_address}
              evidenceHash={noticeResult?.hash}
            />
          </div>
        )}

        {/* Progressive Loading Sequence Overlay */}
        {generating && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6 space-y-6 font-mono select-none">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />

            <div className="space-y-1">
              <div className="text-sm font-bold font-sans uppercase tracking-wider text-slate-100">
                Generating Section 94 BNSS Legal Freeze Directive
              </div>
              <p className="text-xs text-slate-400">
                Stamping Section 63 BSA evidence certificate...
              </p>
            </div>

            {/* Progressive Step Tracker */}
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded p-4 text-left space-y-2.5">
              {LOADING_SEQUENCE.map((stepText, idx) => {
                const isDone = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                return (
                  <div key={stepText} className="flex items-center gap-2.5 text-[11px]">
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                    )}
                    <span
                      className={
                        isDone
                          ? "text-teal-300 font-medium"
                          : isCurrent
                          ? "text-slate-100 font-bold"
                          : "text-slate-600"
                      }
                    >
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
