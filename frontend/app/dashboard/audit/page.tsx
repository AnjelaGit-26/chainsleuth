"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getAuditLogs } from "@/lib/api";
import { AuditLogItem } from "@/lib/types";
import { ShieldCheck, AlertCircle, Clock } from "lucide-react";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLogs()
      .then((data) => setLogs(data))
      .catch((err) => {
        console.error("[AuditPage] Error fetching audit logs:", err);
        setError("Unable to retrieve supervisory audit logs.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6 font-mono text-xs select-none">
        <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-sans text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              Supervisory Audit Log
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Immutable log of search queries, graph traversals, and court freeze notice approvals
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-950/80 border border-red-800 rounded text-red-200 text-center space-y-1 font-mono">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
            <div className="font-bold text-xs">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="w-full border border-slate-800 rounded bg-slate-950 p-8 text-center text-slate-500 space-y-2">
            <Clock className="w-5 h-5 animate-spin text-teal-400 mx-auto" />
            <div>Fetching supervisory audit log records...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="w-full border border-slate-800 rounded bg-slate-950 p-12 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-6 h-6 text-slate-600 mx-auto" />
            <div className="text-slate-300 font-semibold font-sans">No audit logs recorded.</div>
            <p className="text-[11px] text-slate-500">
              No supervisory audit activity recorded in backend database.
            </p>
          </div>
        ) : (
          <div className="w-full border border-slate-800 rounded bg-slate-950 font-mono text-xs overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Log ID</th>
                  <th className="p-3">Officer / Role</th>
                  <th className="p-3">Action Type</th>
                  <th className="p-3">Target Query</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-slate-100">{log.id}</td>
                    <td className="p-3">{log.officer}</td>
                    <td className="p-3 font-bold text-teal-400">{log.action}</td>
                    <td className="p-3">{log.query}</td>
                    <td className="p-3 text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

