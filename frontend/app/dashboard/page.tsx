"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CaseTable } from "@/components/case/CaseTable";
import { getCases } from "@/lib/api";
import { CaseSummary, Chain } from "@/lib/types";
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
  Layers,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  const { currentRole } = useAppStore();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supervisorOnlyPending, setSupervisorOnlyPending] = useState(false);

  const isSupervisor = currentRole === "supervisory_officer";

  useEffect(() => {
    getCases()
      .then((data) => {
        setCases(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("[Dashboard] Failed to fetch cases:", err);
        setError("Unable to retrieve investigation cases.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Summary Metrics — Dynamically calculated strictly from real backend case data
  const totalCount = cases.length;
  const activeCount = cases.filter(
    (c) => c.status === "active" || c.status === "pending_approval"
  ).length;
  const highRiskCount = cases.filter((c) => c.overall_risk_score >= 75).length;
  const pendingApprovalCount = cases.filter(
    (c) => c.status === "pending_approval"
  ).length;
  const vaspAttributedCount = cases.filter((c) =>
    Boolean(c.attributed_vasp_name)
  ).length;

  // Chain Distribution Breakdown (Calculated from backend cases)
  const chainCounts: Record<Chain, number> = {
    tron: cases.filter((c) => c.chain === "tron").length,
    ethereum: cases.filter((c) => c.chain === "ethereum").length,
    solana: cases.filter((c) => c.chain === "solana").length,
    bitcoin: cases.filter((c) => c.chain === "bitcoin").length,
  };

  // Risk Distribution Breakdown (Calculated from backend cases)
  const riskBreakdown = {
    high: cases.filter((c) => c.overall_risk_score >= 75).length,
    medium: cases.filter(
      (c) => c.overall_risk_score >= 40 && c.overall_risk_score < 75
    ).length,
    low: cases.filter((c) => c.overall_risk_score < 40).length,
  };

  // Cases Requiring Attention (High Risk Active / Pending Cases)
  const attentionCases = cases
    .filter(
      (c) =>
        (c.overall_risk_score >= 75 || c.status === "pending_approval") &&
        c.status !== "closed"
    )
    .slice(0, 3);

  // Filtered List Computation
  const filteredCases = cases.filter((c) => {
    // Chain filter
    if (chainFilter !== "all" && c.chain !== chainFilter) {
      return false;
    }
    // Status filter
    if (statusFilter === "active" && c.status !== "active") return false;
    if (statusFilter === "pending" && c.status !== "pending_approval") return false;
    if (statusFilter === "high_risk" && c.overall_risk_score < 75) return false;

    // Supervisor Pending filter toggle
    if (supervisorOnlyPending && c.status !== "pending_approval") {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = c.case_id.toLowerCase().includes(q);
      const matchAddress = c.suspect_address.toLowerCase().includes(q);
      const matchVasp = c.attributed_vasp_name?.toLowerCase().includes(q);
      if (!matchId && !matchAddress && !matchVasp) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4 font-mono text-xs select-none pb-12">
        {/* Command Center Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-base font-bold font-sans text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-teal-400" />
              ChainSleuth Command Center
            </h1>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Real-Time Crypto-Fraud Intelligence, Investigation Metrics & Target VASP Status
            </p>
          </div>

          <Link
            href="/trace/new"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            Start New Investigation
          </Link>
        </div>

        {/* API Error State */}
        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 rounded text-red-200 text-center space-y-2 font-mono shadow-xl">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
            <div className="font-bold font-sans text-xs">Unable to retrieve investigation cases.</div>
            <p className="text-[10px] text-red-300">{error}</p>
          </div>
        )}

        {/* Overview Stat Metrics Cards (Calculated from backend cases) */}
        {!error && (
          <div className="grid grid-cols-5 gap-3 font-sans">
            {/* Total Investigations */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Total Cases
                </div>
                <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  {totalCount} <span className="text-[11px] text-slate-500 font-normal font-mono">recorded</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            {/* Active Investigations */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Active Traces
                </div>
                <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  {activeCount} <span className="text-[11px] text-slate-500 font-normal font-mono">active</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-teal-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            {/* High Risk Cases */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  High Risk (&gt;=75)
                </div>
                <div className="text-lg font-bold text-red-400 font-mono mt-0.5">
                  {highRiskCount} <span className="text-[11px] text-slate-500 font-normal font-mono">flagged</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-red-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            {/* Pending Approval */}
            <div
              onClick={() => isSupervisor && setSupervisorOnlyPending(!supervisorOnlyPending)}
              className={`p-3 bg-slate-900/80 border rounded flex items-center justify-between transition-colors ${
                supervisorOnlyPending ? "border-amber-500 bg-amber-950/20" : "border-slate-800"
              } ${isSupervisor ? "cursor-pointer hover:border-amber-700" : ""}`}
            >
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                  Pending Approval
                </div>
                <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                  {pendingApprovalCount} <span className="text-[11px] text-slate-500 font-normal font-mono">awaiting</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            {/* VASP Attributions */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  VASP Matched
                </div>
                <div className="text-lg font-bold text-teal-300 font-mono mt-0.5">
                  {vaspAttributedCount} <span className="text-[11px] text-slate-500 font-normal font-mono">targets</span>
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-teal-300">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* Command Center Distributions & Attention Panel */}
        {!error && !loading && cases.length > 0 && (
          <div className="grid grid-cols-12 gap-3">
            {/* Chain Distribution Breakdown */}
            <div className="col-span-4 p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Blockchain Distribution</span>
                <span className="text-slate-500 font-mono">{totalCount} total</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-slate-900 rounded border border-red-900/50 flex justify-between items-center">
                  <span className="text-red-400 font-bold">TRON</span>
                  <span className="font-mono text-slate-200 font-bold">{chainCounts.tron}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-blue-900/50 flex justify-between items-center">
                  <span className="text-blue-400 font-bold">ETHEREUM</span>
                  <span className="font-mono text-slate-200 font-bold">{chainCounts.ethereum}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-purple-900/50 flex justify-between items-center">
                  <span className="text-purple-400 font-bold">SOLANA</span>
                  <span className="font-mono text-slate-200 font-bold">{chainCounts.solana}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded border border-amber-900/50 flex justify-between items-center">
                  <span className="text-amber-400 font-bold">BITCOIN</span>
                  <span className="font-mono text-slate-200 font-bold">{chainCounts.bitcoin}</span>
                </div>
              </div>
            </div>

            {/* Risk Assessment Distribution */}
            <div className="col-span-4 p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Risk Severity Breakdown</span>
                <span className="text-slate-500 font-mono">Algorithm Scores</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400 font-bold">Critical Risk (&gt;=75)</span>
                  <span className="font-mono text-red-400 font-bold">{riskBreakdown.high}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${totalCount ? (riskBreakdown.high / totalCount) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-amber-400 font-bold">Medium Risk (40-74)</span>
                  <span className="font-mono text-amber-400 font-bold">{riskBreakdown.medium}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${totalCount ? (riskBreakdown.medium / totalCount) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-teal-400 font-bold">Low Risk (&lt;40)</span>
                  <span className="font-mono text-teal-400 font-bold">{riskBreakdown.low}</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full"
                    style={{ width: `${totalCount ? (riskBreakdown.low / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Cases Requiring Immediate Attention */}
            <div className="col-span-4 p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
              <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider font-sans border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Cases Requiring Priority Attention</span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              </div>
              {attentionCases.length > 0 ? (
                <div className="space-y-1.5">
                  {attentionCases.map((ac) => (
                    <Link
                      key={ac.case_id}
                      href={`/case/${ac.case_id}`}
                      className="p-2 bg-slate-900 hover:bg-slate-800/80 rounded border border-slate-800 flex items-center justify-between transition-colors block"
                    >
                      <div>
                        <div className="font-bold text-slate-100 font-sans">{ac.case_id}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-mono">{ac.chain}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-400 font-mono">{ac.overall_risk_score}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-[11px] py-4 text-center">
                  No critical cases currently requiring attention.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search, Chain Filter & Status Filter Bar */}
        <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-2.5 border border-slate-800 rounded">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Case ID, Suspect Wallet, or Target VASP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono text-[11px]"
            />
          </div>

          {/* Chain & Status Filters */}
          <div className="flex items-center gap-2">
            {/* Blockchain Filter Tabs (Includes BITCOIN) */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
              {(["all", "tron", "ethereum", "solana", "bitcoin"] as const).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setChainFilter(chain)}
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors cursor-pointer ${
                    chainFilter === chain
                      ? "bg-slate-800 text-teal-400 border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {chain}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 text-slate-300 border border-slate-800 rounded px-2.5 py-1.5 text-[11px] font-mono focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Traces</option>
              <option value="pending">Pending Approval</option>
              <option value="high_risk">High Risk (&gt;=75)</option>
            </select>

            {/* Extra Supervisor Filter Toggle */}
            {isSupervisor && (
              <button
                type="button"
                onClick={() => setSupervisorOnlyPending(!supervisorOnlyPending)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-sans font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  supervisorOnlyPending
                    ? "bg-amber-950 text-amber-300 border-amber-700 font-bold"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200"
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                Pending Approval Only
              </button>
            )}
          </div>
        </div>

        {/* Main Case Quick Access Table */}
        <CaseTable cases={filteredCases} loading={loading} />
      </div>
    </AppShell>
  );
}

