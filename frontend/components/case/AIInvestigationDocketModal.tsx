"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AIReportResponse, TraceResult } from "@/lib/types";
import { generateForensicReport } from "@/lib/api";
import { AddressBadge } from "@/components/ui/AddressBadge";
import {
  Sparkles,
  X,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileText,
  ShieldAlert,
} from "lucide-react";

interface AIInvestigationDocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  traceData?: TraceResult | null;
}

export function AIInvestigationDocketModal({
  isOpen,
  onClose,
  caseId,
  traceData = null,
}: AIInvestigationDocketModalProps) {
  const [reportData, setReportData] = useState<AIReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateForensicReport(traceData || caseId);
      setReportData(data);
    } catch (err) {
      console.error("[AIInvestigationDocketModal] Error generating report:", err);
      const message =
        err instanceof Error ? err.message : "Unable to generate investigation docket.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, traceData]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const timer = setTimeout(() => {
      if (isCancelled) return;
      setIsLoading(true);
      setError(null);
      setReportData(null);
      generateForensicReport(traceData || caseId)
        .then((data) => {
          if (!isCancelled) setReportData(data);
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error("[AIInvestigationDocketModal] Error generating report:", err);
            const message = err instanceof Error ? err.message : "Unable to generate investigation docket.";
            setError(message);
          }
        })
        .finally(() => {
          if (!isCancelled) setIsLoading(false);
        });
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, caseId, traceData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!reportData?.report) return;
    navigator.clipboard.writeText(reportData.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const caseIdDisplay = reportData?.case_id || caseId || "Unavailable";
  const suspectAddressDisplay = reportData?.suspect_address || traceData?.suspect_address || null;
  const chainDisplay = reportData?.chain || traceData?.chain || "Unavailable";
  const riskScoreDisplay =
    reportData?.overall_risk_score !== undefined && reportData?.overall_risk_score !== null
      ? `${reportData.overall_risk_score}/100`
      : traceData?.overall_risk_score !== undefined && traceData?.overall_risk_score !== null
      ? `${traceData.overall_risk_score}/100`
      : "Unavailable";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-purple-500/80 rounded-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-purple-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-purple-950 border border-purple-700 text-purple-300">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold font-sans tracking-wide text-slate-100 flex items-center gap-2">
                <span>AI Forensic Investigation Docket</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 font-extrabold uppercase">
                  GEMINI 2.0 FLASH
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Automated legal case narrative & law enforcement docket
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close AI Investigation Docket modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 font-mono text-xs">
          {/* Loading State */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              <div className="text-sm font-sans font-bold text-slate-200">
                Generating Investigation Docket...
              </div>
              <p className="text-[11px] text-slate-500 max-w-md">
                Invoking backend Gemini 2.0 Flash pipeline to assemble court-admissible legal case narrative. Please wait.
              </p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-4 bg-red-950/90 border border-red-700 rounded text-red-200 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold font-sans text-red-300">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <span>Unable to generate investigation docket.</span>
              </div>
              <p className="text-xs font-mono text-red-200/90 leading-relaxed bg-slate-950 p-2.5 rounded border border-red-900">
                {error}
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={fetchReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-100 font-sans font-bold text-xs rounded border border-red-600 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}

          {/* Report Display */}
          {!isLoading && !error && reportData && (
            <div className="space-y-4">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Case ID</span>
                  <span className="font-bold text-slate-100">{caseIdDisplay}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Chain</span>
                  <span className="font-bold text-slate-100 uppercase">{chainDisplay}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Overall Risk Score</span>
                  <span className="font-bold text-purple-400">{riskScoreDisplay}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Suspect Address</span>
                  {suspectAddressDisplay ? (
                    <AddressBadge address={suspectAddressDisplay} truncateLength={4} />
                  ) : (
                    <span className="text-slate-400 font-mono">Unavailable</span>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[11px] text-slate-400 font-sans font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>Forensic Report Text</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    aria-label="Copy AI Investigation Report"
                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 rounded font-sans text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Report copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Report Text</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Report Document Box */}
              {reportData.report ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text max-h-[55vh] overflow-y-auto">
                  {reportData.report}
                </div>
              ) : (
                <div className="p-6 bg-slate-950 border border-slate-800 rounded text-center text-slate-500 font-mono">
                  <ShieldAlert className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <div>Unavailable</div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    No report text returned by backend.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-sans font-bold text-xs rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
