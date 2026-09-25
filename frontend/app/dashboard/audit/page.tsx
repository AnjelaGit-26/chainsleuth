"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Lock,
  Search,
  Filter,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  officer: string;
  action: string;
  query: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  const mockAuditLogs: AuditLogItem[] = [
    {
      id: "LOG-1092",
      officer: "Inspector A. Sharma (IO-402)",
      action: "Traversal",
      query: "TABC1234567890XYZ99887766554433 · 4 hops",
      timestamp: "2026-09-20T14:32:00Z",
    },
    {
      id: "LOG-1093",
      officer: "ACP R. Verma (Supervisor)",
      action: "Notice",
      query: "CS-2026-8891 · Approved Section 94 Notice for CoinDCX",
      timestamp: "2026-09-20T14:45:00Z",
    },
    {
      id: "LOG-1094",
      officer: "Inspector K. Patil (IO-118)",
      action: "Ingestion",
      query: "FIR-2026-DEL-0412 · NCRP Ingestion",
      timestamp: "2026-09-21T09:12:00Z",
    },
    {
      id: "LOG-1095",
      officer: "ACP R. Verma (Supervisor)",
      action: "Certificate",
      query: "Section 63 BSA Hash: 3a9f02c1...8b4e72",
      timestamp: "2026-09-21T10:04:00Z",
    },
    {
      id: "LOG-1096",
      officer: "VASP Compliance (WazirX Nodal)",
      action: "Freeze Execution",
      query: "Deposit Account #WZ-9921 Freeze Confirmation",
      timestamp: "2026-09-21T11:30:00Z",
    },
  ];

  const filteredLogs = mockAuditLogs.filter((log) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.id.toLowerCase().includes(q) ||
      log.officer.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.query.toLowerCase().includes(q);

    const matchesAction =
      filterAction === "all" ||
      log.action.toLowerCase().includes(filterAction.toLowerCase());

    return matchesSearch && matchesAction;
  });

  return (
    <AppShell>
      <div className="workspace-in space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">
              <Lock className="size-4" />
              <span>Supervisory Oversight &amp; Chain of Custody</span>
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl text-[var(--foreground)]">
              Supervisory Audit Trail
            </h1>
            <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
              Cryptographically sealed immutable register of search queries, multi-hop traversals &amp; Section 94 BNSS freeze notice issuances.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Log ID, Officer, Action, or Query…"
                className="field pl-9 pr-4 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-[var(--muted-foreground)] ml-1" />
              <span className="text-[11px] font-bold uppercase text-[var(--muted-foreground)]">Action:</span>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="field w-auto px-3 py-1.5 text-xs font-semibold"
              >
                <option value="all">All Actions</option>
                <option value="Traversal">Graph Traversal</option>
                <option value="Notice">Section 94 Notice</option>
                <option value="Certificate">Evidence Certificate</option>
                <option value="Ingestion">NCRP Ingestion</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/40 bg-white/20 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  <th className="px-4 py-3">Log ID</th>
                  <th className="px-4 py-3">Officer / Unit</th>
                  <th className="px-4 py-3">Action Type</th>
                  <th className="px-4 py-3">Target Query / Case Reference</th>
                  <th className="px-4 py-3">Timestamp (UTC)</th>
                  <th className="px-4 py-3 text-right">Integrity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 font-mono">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-[var(--foreground)]">
                      {log.id}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-[var(--foreground)]">
                      {log.officer}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-2.5 py-0.5 font-sans font-bold text-[10px] text-[var(--primary)]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] max-w-sm truncate" title={log.query}>
                      {log.query}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)] text-[11px]">
                      {new Date(log.timestamp).toLocaleString("en-IN", {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                        <CheckCircle2 className="size-3" />
                        SEALED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
