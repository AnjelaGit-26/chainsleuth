"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CaseSummary } from "@/lib/types";
import { ChevronRight, ShieldCheck, Clock, CheckCircle2, Lock, AlertCircle, Loader2 } from "lucide-react";

interface CaseTableProps {
  cases: CaseSummary[];
  loading?: boolean;
}

const statusMap = {
  active: { label: "Active Trace", icon: Clock, bg: "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]", text: "text-[var(--primary)]", border: "border-[color-mix(in_oklab,var(--primary)_30%,transparent)]" },
  pending_approval: { label: "Pending Approval", icon: Clock, bg: "bg-[color-mix(in_oklab,var(--amber)_10%,transparent)]", text: "text-[var(--amber)]", border: "border-[color-mix(in_oklab,var(--amber)_30%,transparent)]" },
  frozen: { label: "Frozen", icon: Lock, bg: "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]", text: "text-[var(--primary)]", border: "border-[color-mix(in_oklab,var(--primary)_30%,transparent)]" },
  closed: { label: "Closed", icon: CheckCircle2, bg: "bg-[color-mix(in_oklab,var(--muted-foreground)_10%,transparent)]", text: "text-[var(--muted-foreground)]", border: "border-[color-mix(in_oklab,var(--muted-foreground)_20%,transparent)]" },
};

const chainMap: Record<string, string> = {
  tron: "bg-red-50 text-red-600 border-red-200",
  solana: "bg-purple-50 text-purple-600 border-purple-200",
  ethereum: "bg-blue-50 text-blue-600 border-blue-200",
  bitcoin: "bg-amber-50 text-amber-700 border-amber-200",
};

function riskColor(score: number) {
  if (score >= 80) return "text-[var(--destructive)] font-bold";
  if (score >= 60) return "text-[var(--amber)] font-semibold";
  return "text-[var(--primary)] font-semibold";
}

export function CaseTable({ cases, loading = false }: CaseTableProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="glass-panel p-10 text-center">
        <Loader2 className="size-6 animate-spin text-[var(--primary)] mx-auto mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Querying case database…</p>
      </div>
    );
  }

  if (!cases || cases.length === 0) {
    return (
      <div className="glass-panel p-12 text-center space-y-2">
        <AlertCircle className="size-8 text-[var(--muted-foreground)] mx-auto" />
        <p className="font-semibold text-[var(--foreground)]">No Investigation Cases Found</p>
        <p className="text-sm text-[var(--muted-foreground)]">No records match the active filter parameters.</p>
      </div>
    );
  }

  const sorted = [...cases].sort((a, b) => b.overall_risk_score - a.overall_risk_score);

  return (
    <div className="glass-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[color-mix(in_oklab,var(--border)_50%,transparent)]">
              {["Case ID", "Suspect Wallet", "Chain", "Risk", "Status", "Target VASP", "Created", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const stKey = (c.status || "active").toLowerCase() as keyof typeof statusMap;
              const st = statusMap[stKey] ?? {
                label: c.status || "Active",
                icon: Clock,
                bg: "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]",
                text: "text-[var(--primary)]",
                border: "border-[color-mix(in_oklab,var(--primary)_30%,transparent)]",
              };
              const StatusIcon = st.icon;
              const chainStyle = chainMap[c.chain] ?? "bg-gray-50 text-gray-600 border-gray-200";
              const targetVasp = c.attributed_vasp_name || c.attributed_vasp;

              return (
                <tr
                  key={c.case_id}
                  onClick={() => router.push(`/case/${encodeURIComponent(c.case_id)}`)}
                  className="group cursor-pointer border-b border-[color-mix(in_oklab,var(--border)_30%,transparent)] hover:bg-white/40 transition-colors last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-[var(--foreground)]">
                    {c.case_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted-foreground)]">
                    {c.suspect_address.slice(0, 10)}…{c.suspect_address.slice(-6)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${chainStyle}`}>
                      {c.chain}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-base ${riskColor(c.overall_risk_score)}`}>
                      {c.overall_risk_score}
                    </span>
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">/100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.text} ${st.border}`}>
                      <StatusIcon className="size-3 shrink-0" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {targetVasp ? (
                      <span className="flex items-center gap-1.5 text-[var(--primary)] font-medium">
                        <ShieldCheck className="size-3.5 shrink-0" />
                        {targetVasp}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)] text-xs italic">Unattributed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", day: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors font-medium">
                      Workbench
                      <ChevronRight className="size-3.5" />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
