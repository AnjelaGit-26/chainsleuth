"use client";

import React, { useState } from "react";
import Link from "next/link";
import { VASPAttribution } from "@/lib/types";
import { downloadCourtEvidenceBundle } from "@/lib/api";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EvidenceCertModal } from "@/components/case/EvidenceCertModal";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Mail,
  Phone,
  Target,
  Layers,
  ArrowRight,
  Archive,
  Loader2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
} from "lucide-react";

interface VaspAttributionCardProps {
  attribution: VASPAttribution | null;
  caseId: string;
}

export function VaspAttributionCard({ attribution, caseId }: VaspAttributionCardProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  if (!attribution) return null;

  const handleExportBundle = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadCourtEvidenceBundle(caseId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection error: Unable to reach backend server.";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 bg-slate-950 border-2 border-teal-500 rounded font-mono text-xs text-slate-100 flex flex-col space-y-4 shadow-2xl select-none relative overflow-hidden">
      {/* Visual Payoff Banner */}
      <div className="flex items-center justify-between border-b border-teal-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-teal-950 border border-teal-600 text-teal-300">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-teal-400 font-bold tracking-widest uppercase">
              VASP MATCH IDENTIFIED
            </div>
            <div className="text-sm font-bold font-sans text-slate-100">
              {attribution.vasp_name}
            </div>
          </div>
        </div>

        {/* FIU-IND Badge */}
        {attribution.is_fiu_registered ? (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-700 font-bold uppercase">
            <CheckCircle2 className="w-3 h-3 text-teal-400" />
            FIU-IND Registered
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700 font-bold uppercase">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Unregistered VASP
          </span>
        )}
      </div>

      {/* Confidence Score & Plain-English Explanation */}
      <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">
            Attribution Confidence Score
          </span>
          <span className="text-teal-400 font-bold text-xs font-mono">
            {attribution.confidence_score !== undefined && attribution.confidence_score !== null
              ? `${
                  attribution.confidence_score <= 1
                    ? Math.round(attribution.confidence_score * 100)
                    : Math.round(attribution.confidence_score)
                }% CONFIDENCE`
              : "Confidence unavailable"}
          </span>
        </div>
        <p className="text-[11px] text-slate-300 font-sans leading-normal">
          Attribution verified via 1-hop sweep transaction heuristics connecting the suspect money trail directly to {attribution.vasp_name} deposit infrastructure.
        </p>
      </div>

      {/* Address Distinction Section */}
      <div className="space-y-3">
        {/* 1. ACTIONABLE DEPOSIT ADDRESS (Prominent Highlight) */}
        <div className="p-3 bg-teal-950/60 border-2 border-teal-500/90 rounded space-y-1.5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-teal-300 font-bold font-sans text-[11px] uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              ACTIONABLE DEPOSIT ADDRESS
            </span>
            <span className="text-[9px] bg-teal-900/90 text-teal-200 px-1.5 py-0.5 rounded font-bold uppercase border border-teal-700">
              FREEZE TARGET
            </span>
          </div>
          <div className="pt-0.5">
            <AddressBadge address={attribution.deposit_address} truncateLength={8} />
          </div>
          <p className="text-[10px] text-teal-200/90 font-mono leading-normal pt-1 border-t border-teal-800/80">
            Primary KYC-linked exchange account named in Section 94 BNSS Legal Freeze Directive.
          </p>
        </div>

        {/* 2. EXCHANGE HOT WALLET (Subdued Gray Contrast) */}
        <div className="p-2.5 bg-slate-900/40 border border-slate-800 rounded space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
              <Layers className="w-3 h-3 text-slate-500" />
              EXCHANGE HOT WALLET
            </span>
            <span className="text-[9px] text-slate-500 font-mono">SHARED POOL</span>
          </div>
          <div>
            <AddressBadge address={attribution.hot_wallet_address} truncateLength={8} />
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            Shared exchange liquidity pool — Do NOT freeze.
          </p>
        </div>
      </div>

      {/* Nodal Officer Contact Information */}
      <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded space-y-1.5">
        <div className="text-[10px] text-slate-400 uppercase font-semibold">
          Designated Nodal Officer Contacts
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-2 text-slate-200">
            <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="font-sans font-medium">{attribution.nodal_officer_email}</span>
          </div>
          {attribution.nodal_officer_phone && (
            <div className="flex items-center gap-2 text-slate-200">
              <Phone className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="font-mono">{attribution.nodal_officer_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        {/* Evidence Actions Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleExportBundle}
            disabled={isExporting}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-900 disabled:text-slate-500 text-slate-950 font-sans font-bold text-[11px] rounded transition-colors shadow cursor-pointer disabled:cursor-not-allowed border border-emerald-500/50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span className="text-slate-200">Exporting...</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-slate-950" />
                <span>Download Evidence Bundle</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsCertModalOpen(true)}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 hover:bg-slate-800 text-teal-300 font-sans font-bold text-[11px] rounded border border-teal-800/80 transition-colors shadow cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>View Certificate Details</span>
          </button>
        </div>

        {exportError && (
          <div className="p-2.5 bg-red-950/90 border border-red-700/80 rounded text-red-200 text-[11px] font-mono flex items-start justify-between gap-2 shadow">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="text-red-400 hover:text-red-200 font-bold ml-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Generate Legal Freeze Notice (Section 94 BNSS) */}
        <Link
          href={`/case/${caseId}/notice`}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          Generate Legal Freeze Notice (Section 94 BNSS)
          <ArrowRight className="w-4 h-4" />
        </Link>

        {/* Generate Cybercrime FIR */}
        <Link
          href={`/case/${caseId}/fir`}
          className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 text-teal-300 font-sans font-bold text-xs rounded transition-colors shadow cursor-pointer border border-teal-800/80"
        >
          <FileCheck className="w-4 h-4 text-teal-400" />
          File Cybercrime FIR Docket
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <EvidenceCertModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        caseId={caseId}
      />
    </div>
  );
}


