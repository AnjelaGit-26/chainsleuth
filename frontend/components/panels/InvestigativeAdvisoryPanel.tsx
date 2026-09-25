"use client";

import React, { useState } from "react";
import { Clock, Zap, Check, Copy, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";

interface InvestigativeAdvisoryPanelProps {
  recommendations?: string[];
  slaAlert?: string;
  caseId?: string;
}

export function InvestigativeAdvisoryPanel({
  recommendations = [],
  slaAlert,
  caseId = "",
}: InvestigativeAdvisoryPanelProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  if (!slaAlert && recommendations.length === 0) return null;

  const isCriticalSla = slaAlert?.includes("CRITICAL");
  const isHighUrgency = slaAlert?.includes("HIGH URGENCY");

  const handleCopy = () => {
    const text = [
      `CASE INVESTIGATION ADVISORY — ${caseId}`,
      `SLA STATUS: ${slaAlert || "Standard"}`,
      "",
      "ACTIONABLE RECOMMENDATIONS FOR INVESTIGATING OFFICER (IO):",
      ...recommendations.map((r, i) => `${i + 1}. ${r}`),
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-100 flex flex-col overflow-hidden shadow-lg">
      {/* SLA Alert Banner */}
      {slaAlert && (
        <div
          className={`p-3 flex items-start gap-2.5 border-b ${
            isCriticalSla
              ? "bg-rose-950/80 border-rose-800 text-rose-200"
              : isHighUrgency
              ? "bg-amber-950/80 border-amber-800 text-amber-200"
              : "bg-slate-900 border-slate-800 text-slate-300"
          }`}
        >
          {isCriticalSla ? (
            <Zap className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-sans text-xs font-semibold leading-relaxed">
            {slaAlert}
          </div>
        </div>
      )}

      {/* Advisory Header */}
      <div className="p-3 bg-slate-900/60 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span className="font-sans font-bold text-xs uppercase tracking-wider text-teal-300">
            Automated IO Recommendations ({recommendations.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] transition-colors"
            title="Copy advisory for case diary"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-teal-400" />
                <span className="text-teal-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      {isExpanded && recommendations.length > 0 && (
        <div className="p-3 space-y-2.5 max-h-72 overflow-y-auto">
          {recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="p-2.5 bg-slate-900/40 border border-slate-800/80 rounded flex items-start gap-2 text-[11px] leading-relaxed"
            >
              <span className="w-4 h-4 rounded-full bg-teal-950 text-teal-400 border border-teal-800 flex items-center justify-center shrink-0 font-bold text-[9px] mt-0.5">
                {idx + 1}
              </span>
              <div className="text-slate-300 font-sans">{rec}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
