"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CaseSummary } from "@/lib/types";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { RiskBadge } from "@/components/case/RiskBadge";
import { ChevronRight, ShieldCheck, Clock, CheckCircle2, Lock, AlertCircle } from "lucide-react";

interface CaseTableProps {
  cases: CaseSummary[];
  loading?: boolean;
}

export function CaseTable({ cases, loading = false }: CaseTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="w-full border border-slate-800 rounded bg-slate-950 p-8 text-center font-mono text-xs text-slate-500 space-y-3">
        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div>Querying case database & traversal logs...</div>
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="w-full border border-slate-800 rounded bg-slate-950 p-12 text-center font-mono text-xs text-slate-500 space-y-2">
        <AlertCircle className="w-6 h-6 text-slate-600 mx-auto mb-1" />
        <div className="text-slate-300 font-semibold font-sans">No investigations found.</div>
      </div>
    );
  }

  // Sort by risk score descending by default
  const sortedCases = [...cases].sort((a, b) => b.overall_risk_score - a.overall_risk_score);

  const statusBadgeMap = {
    active: {
      label: "Active Trace",
      icon: Clock,
      style: "bg-slate-900 text-slate-300 border-slate-700",
    },
    pending_approval: {
      label: "Pending Approval",
      icon: Clock,
      style: "bg-amber-950/70 text-amber-400 border-amber-800",
    },
    frozen: {
      label: "Notice Served / Frozen",
      icon: Lock,
      style: "bg-teal-950/70 text-teal-300 border-teal-800",
    },
    closed: {
      label: "Case Closed",
      icon: CheckCircle2,
      style: "bg-slate-950 text-slate-500 border-slate-800",
    },
  };

  const chainBadgeMap: Record<string, string> = {
    tron: "bg-red-950/60 text-red-400 border-red-800/60",
    solana: "bg-purple-950/60 text-purple-400 border-purple-800/60",
    ethereum: "bg-blue-950/60 text-blue-400 border-blue-800/60",
    bitcoin: "bg-amber-950/60 text-amber-400 border-amber-800/60",
  };

  return (
    <div className="w-full overflow-x-auto border border-slate-800 rounded bg-slate-950 select-none">
      <table className="w-full text-left text-xs font-mono">
        <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
          <tr>
            <th className="py-2.5 px-3">Case ID</th>
            <th className="py-2.5 px-3">Suspect Wallet</th>
            <th className="py-2.5 px-3">Chain</th>
            <th className="py-2.5 px-3">Risk Assessment</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Target VASP</th>
            <th className="py-2.5 px-3">Created</th>
            <th className="py-2.5 px-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-300">
          {sortedCases.map((c) => {
            const statusInfo = statusBadgeMap[c.status] || statusBadgeMap.active;
            const StatusIcon = statusInfo.icon;
            const chainStyle = chainBadgeMap[c.chain] || "bg-slate-900 text-slate-400 border-slate-800";

            return (
              <tr
                key={c.case_id}
                onClick={() => router.push(`/case/${c.case_id}`)}
                className="hover:bg-slate-900/70 transition-colors cursor-pointer group"
              >
                <td className="py-2.5 px-3 font-semibold text-slate-100 font-sans">
                  {c.case_id}
                </td>
                <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                  <AddressBadge address={c.suspect_address} truncateLength={6} />
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${chainStyle}`}
                  >
                    {c.chain}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <RiskBadge score={c.overall_risk_score} size="sm" />
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded border font-medium ${statusInfo.style}`}
                  >
                    <StatusIcon className="w-3 h-3 shrink-0" />
                    <span>{statusInfo.label}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 font-sans font-medium text-xs">
                  {c.attributed_vasp_name ? (
                    <span className="text-teal-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      {c.attributed_vasp_name}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-[11px]">Unattributed</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                  {new Date(c.created_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="inline-flex items-center gap-1 text-[11px] font-sans text-slate-400 group-hover:text-teal-400 transition-colors">
                    Workbench
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
