"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CaseTable } from "@/components/case/CaseTable";
import { getCases } from "@/lib/api";
import { CaseSummary } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import {
  PlusCircle,
  Search,
  Filter,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Building2,
  Clock,
} from "lucide-react";

export default function DashboardPage() {
  const { currentRole } = useAppStore();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [supervisorOnlyPending, setSupervisorOnlyPending] = useState(false);

  const isSupervisor = currentRole === "supervisory_officer";

  useEffect(() => {
    getCases()
      .then((data) => setCases(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = cases.filter((c) => c.status !== "closed" && c.status !== "failed").length;
  const highRiskCount = cases.filter((c) => c.overall_risk_score >= 75).length;
  const pendingApprovalCount = cases.filter((c) => c.status?.toLowerCase().includes("pending")).length;
  const vaspAttributedCount = cases.filter((c) => Boolean(c.attributed_vasp_name || c.attributed_vasp)).length;

  const filteredCases = cases.filter((c) => {
    if (chainFilter !== "all" && c.chain !== chainFilter) return false;
    if (supervisorOnlyPending && !c.status?.toLowerCase().includes("pending")) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !c.case_id.toLowerCase().includes(q) &&
        !c.suspect_address.toLowerCase().includes(q) &&
        !c.attributed_vasp_name?.toLowerCase().includes(q) &&
        !c.attributed_vasp?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const statCards = [
    {
      label: "Active Investigations",
      value: activeCount,
      unit: "cases",
      icon: Clock,
      color: "text-[var(--primary)]",
    },
    {
      label: "High Risk Cases (≥75)",
      value: highRiskCount,
      unit: "flagged",
      icon: AlertTriangle,
      color: "text-[var(--destructive)]",
    },
    {
      label: "Pending Approval",
      value: pendingApprovalCount,
      unit: "awaiting",
      icon: Lock,
      color: "text-[var(--amber)]",
      clickable: isSupervisor,
      active: supervisorOnlyPending,
      onClick: () => isSupervisor && setSupervisorOnlyPending(!supervisorOnlyPending),
    },
    {
      label: "VASP Attributions",
      value: vaspAttributedCount,
      unit: "matched",
      icon: Building2,
      color: "text-[var(--primary)]",
    },
  ];

  return (
    <AppShell>
      <div className="workspace-in space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
              <ShieldAlert className="size-6 text-[var(--primary)]" />
              Investigations
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Active crypto fraud cases, risk scores &amp; VASP freeze status
            </p>
          </div>
          <Link
            href="/trace/new"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] transition-colors shrink-0"
          >
            <PlusCircle className="size-4" />
            New Trace
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(({ label, value, unit, icon: Icon, color, clickable, active, onClick }) => (
            <div
              key={label}
              onClick={onClick}
              className={[
                "glass-panel p-4 flex items-center justify-between gap-3 transition-all",
                clickable ? "cursor-pointer hover:scale-[1.02]" : "",
                active ? "ring-2 ring-[var(--amber)] ring-offset-0" : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] truncate">
                  {label}
                  {clickable && <span className="ml-1 text-[10px] opacity-60">(FILTER)</span>}
                </p>
                <p className={`font-mono text-2xl font-bold mt-0.5 ${color}`}>
                  {value}
                  <span className="ml-1 text-xs text-[var(--muted-foreground)] font-normal">{unit}</span>
                </p>
              </div>
              <div className={`grid size-10 shrink-0 place-items-center rounded-xl bg-white/60 ${color}`}>
                <Icon className="size-5" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="glass-panel flex flex-wrap items-center gap-3 p-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Search case ID, wallet address…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field pl-9"
            />
          </div>

          {/* Chain filter */}
          <div className="flex items-center gap-1">
            <Filter className="size-4 text-[var(--muted-foreground)] mr-1" />
            {(["all", "tron", "solana", "ethereum", "bitcoin", "base"] as const).map((chain) => (
              <button
                key={chain}
                type="button"
                onClick={() => setChainFilter(chain)}
                className={[
                  "px-3 py-1 rounded-full text-xs font-semibold uppercase transition-colors",
                  chainFilter === chain
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/60",
                ].join(" ")}
              >
                {chain}
              </button>
            ))}
          </div>

          {isSupervisor && (
            <button
              type="button"
              onClick={() => setSupervisorOnlyPending(!supervisorOnlyPending)}
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors",
                supervisorOnlyPending
                  ? "bg-[color-mix(in_oklab,var(--amber)_15%,transparent)] text-[var(--amber)] border-[color-mix(in_oklab,var(--amber)_40%,transparent)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <Lock className="size-3" />
              Pending Approval Filter
            </button>
          )}
        </div>

        {/* Case Table */}
        <CaseTable cases={filteredCases} loading={loading} />
      </div>
    </AppShell>
  );
}
