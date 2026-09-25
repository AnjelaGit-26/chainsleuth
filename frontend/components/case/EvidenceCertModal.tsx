"use client";

import React, { useState, useEffect, useCallback } from "react";
import { EvidenceCertResponse } from "@/lib/types";
import { getCaseEvidenceCert } from "@/lib/api";
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Loader2,
  FileText,
  Hash,
  Boxes,
  ArrowRightLeft,
  Building2,
} from "lucide-react";

interface EvidenceCertModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
}

export function EvidenceCertModal({
  isOpen,
  onClose,
  caseId,
}: EvidenceCertModalProps) {
  const [certData, setCertData] = useState<EvidenceCertResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const fetchCertificate = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getCaseEvidenceCert(caseId);
      setCertData(data);
    } catch (err: unknown) {
      console.error("[EvidenceCertModal] Error fetching certificate:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to load evidence certificate.";
      setErrorMsg(msg);
      setCertData(null);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    let isCancelled = false;
    if (isOpen) {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          setCertData(null);
          setErrorMsg(null);
          setCopiedHash(false);
          fetchCertificate();
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, fetchCertificate]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rawHash = certData?.evidence_sha256_hash ?? "";
  const isValidHexHash = rawHash ? /^[a-fA-F0-9]{64}$/.test(rawHash.trim()) : true;

  const handleCopyHash = () => {
    if (!rawHash) return;
    navigator.clipboard.writeText(rawHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const caseIdMismatch =
    certData?.case_id &&
    caseId &&
    certData.case_id.trim().toLowerCase() !== caseId.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
    >
      <style>{`
        @media print {
          @page {
            margin: 15mm;
            size: portrait;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #evidence-cert-print-container, #evidence-cert-print-container * {
            visibility: visible !important;
          }
          #evidence-cert-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
          }
          .print-hide {
            display: none !important;
          }
          .print-card {
            background: #ffffff !important;
            border: 1px solid #111827 !important;
            color: #000000 !important;
            box-shadow: none !important;
            border-radius: 2px !important;
          }
          .print-text-dark {
            color: #000000 !important;
          }
          .print-text-muted {
            color: #374151 !important;
          }
          .print-text-accent {
            color: #000000 !important;
            font-weight: 700 !important;
          }
          .print-hash-box {
            background: #f8fafc !important;
            border: 1px dashed #4b5563 !important;
            color: #000000 !important;
            font-family: monospace !important;
            word-break: break-all !important;
          }
          .print-border-b {
            border-bottom: 1px solid #d1d5db !important;
          }
        }
      `}</style>
      <div
        id="evidence-cert-print-container"
        className="w-full max-w-xl bg-slate-950 border border-slate-800 rounded shadow-2xl space-y-4 p-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 print-border-b">
          <div>
            <div className="flex items-center gap-2 text-slate-100 font-sans font-bold text-sm tracking-wider uppercase print-text-dark">
              <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 print-text-accent" />
              <h2 id="cert-modal-title">Evidence Certificate</h2>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5 print-text-muted">
              Digital evidence integrity certificate
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence certificate modal"
            className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-900 transition-colors cursor-pointer print-hide"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-slate-900/40 border border-slate-800/60 rounded print-card">
            <Loader2 className="w-7 h-7 text-teal-400 animate-spin print-hide" />
            <span className="text-slate-300 font-mono text-xs print-text-dark">
              Loading evidence certificate...
            </span>
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && errorMsg && (
          <div className="p-4 bg-red-950/80 border border-red-800 rounded space-y-3 print-card">
            <div className="flex items-center gap-2 text-red-400 font-sans font-bold text-xs uppercase tracking-wider print-text-dark">
              <AlertCircle className="w-4 h-4 shrink-0 print-hide" />
              <span>Unable to load evidence certificate.</span>
            </div>
            <p className="text-[11px] text-red-300 font-mono leading-relaxed print-text-dark">
              {errorMsg}
            </p>
            <div className="pt-1 print-hide">
              <button
                type="button"
                onClick={fetchCertificate}
                aria-label="Retry loading evidence certificate"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/90 hover:bg-red-800 text-red-100 font-sans font-bold text-[11px] rounded border border-red-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* SUCCESSFUL CERTIFICATE DISPLAY */}
        {!isLoading && !errorMsg && certData && (
          <div className="space-y-4">
            {/* Case ID Mismatch Warning */}
            {caseIdMismatch && (
              <div className="p-3 bg-amber-950/80 border border-amber-800 rounded text-amber-300 space-y-1 print-card">
                <div className="flex items-center gap-1.5 font-bold font-sans text-xs print-text-dark">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 print-hide" />
                  <span>Case ID Mismatch Detected</span>
                </div>
                <p className="text-[11px] text-amber-200/90 font-mono leading-relaxed print-text-dark">
                  Certificate Case ID (<span className="font-bold text-white print-text-dark">{certData.case_id}</span>) differs from current Workbench Case ID (<span className="font-bold text-white print-text-dark">{caseId}</span>).
                </p>
              </div>
            )}

            {/* Certificate Meta Details */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded space-y-3 print-card">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-400 font-semibold font-sans uppercase text-[11px] print-border-b print-text-muted">
                <FileText className="w-3.5 h-3.5 text-teal-400 print-text-accent" />
                <span>Certificate Metadata</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block print-text-muted">
                    Certificate Type
                  </span>
                  <span className="font-bold text-slate-100 text-[11px] block mt-0.5 print-text-dark">
                    {certData.certificate_type || "Unavailable"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase block print-text-muted">
                    Former Equivalent
                  </span>
                  <span className="font-bold text-slate-100 text-[11px] block mt-0.5 print-text-dark">
                    {certData.former_equivalent || "Unavailable"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[10px] uppercase block print-text-muted">
                    Case ID
                  </span>
                  <span className="font-bold text-teal-300 text-[11px] block mt-0.5 print-text-accent">
                    {certData.case_id || "Unavailable"}
                  </span>
                </div>
              </div>
            </div>

            {/* SHA-256 Display */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded space-y-2.5 print-card">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 print-border-b">
                <span className="flex items-center gap-1.5 text-slate-400 font-semibold font-sans uppercase text-[11px] print-text-muted">
                  <Hash className="w-3.5 h-3.5 text-teal-400 print-text-accent" />
                  <span>Evidence SHA-256</span>
                </span>
                {rawHash && (
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    aria-label="Copy evidence SHA-256 hash"
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-teal-300 hover:text-teal-200 border border-slate-700 rounded text-[11px] transition-colors cursor-pointer print-hide"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Hash copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-teal-400" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Monospace container for Hash */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-teal-300 break-all leading-relaxed tracking-wider select-all print-hash-box">
                {rawHash || "Unavailable"}
              </div>

              {/* Hash Format Warning */}
              {!isValidHexHash && rawHash && (
                <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-sans pt-1 print-text-muted">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 print-hide" />
                  <span>Hash format could not be validated by the frontend.</span>
                </div>
              )}
            </div>

            {/* Evidence Summary */}
            <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded space-y-3 print-card">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-400 font-semibold font-sans uppercase text-[11px] print-border-b print-text-muted">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400 print-text-accent" />
                <span>Evidence Summary</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded print-card">
                  <span className="text-slate-500 text-[10px] uppercase flex items-center gap-1 mb-1 print-text-muted">
                    <Boxes className="w-3 h-3 text-slate-400 print-hide" />
                    Nodes Analysed
                  </span>
                  <span className="font-bold text-slate-100 text-sm font-mono print-text-dark">
                    {certData.total_nodes_analyzed !== undefined && certData.total_nodes_analyzed !== null
                      ? certData.total_nodes_analyzed
                      : "Unavailable"}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded print-card">
                  <span className="text-slate-500 text-[10px] uppercase flex items-center gap-1 mb-1 print-text-muted">
                    <ArrowRightLeft className="w-3 h-3 text-slate-400 print-hide" />
                    Transactions Traced
                  </span>
                  <span className="font-bold text-slate-100 text-sm font-mono print-text-dark">
                    {certData.total_transactions_traced !== undefined && certData.total_transactions_traced !== null
                      ? certData.total_transactions_traced
                      : "Unavailable"}
                  </span>
                </div>

                <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded print-card">
                  <span className="text-slate-500 text-[10px] uppercase flex items-center gap-1 mb-1 print-text-muted">
                    <Building2 className="w-3 h-3 text-slate-400 print-hide" />
                    Attributed VASP
                  </span>
                  <span className="font-bold text-teal-300 text-[11px] font-mono block truncate print-text-accent">
                    {certData.attributed_vasp ? certData.attributed_vasp : "VASP attribution unavailable"}
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Declarations (Supplied by backend) */}
            {Boolean(certData.statutory_declarations || certData.statutory_declaration) && (
              <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded space-y-2 print-card">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-400 font-semibold font-sans uppercase text-[11px] print-border-b print-text-muted">
                  <FileText className="w-3.5 h-3.5 text-teal-400 print-text-accent" />
                  <span>Statutory Declarations</span>
                </div>
                <div className="text-[11px] text-slate-200 font-mono space-y-1.5 print-text-dark leading-relaxed">
                  {Array.isArray(certData.statutory_declarations) ? (
                    certData.statutory_declarations.map((decl, idx) => (
                      <p key={idx} className="print-text-dark">
                        • {decl}
                      </p>
                    ))
                  ) : typeof certData.statutory_declarations === "string" ? (
                    <p className="print-text-dark">{certData.statutory_declarations}</p>
                  ) : typeof certData.statutory_declaration === "string" ? (
                    <p className="print-text-dark">{certData.statutory_declaration}</p>
                  ) : null}
                </div>
              </div>
            )}

            {/* Footer Notice */}
            <div className="text-[10px] text-slate-500 text-center font-sans pt-1 print-text-muted">
              Authoritative evidence certificate retrieved from ChainSleuth verification system.
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800 print-hide">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-sans font-bold rounded border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
