"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { SyndicateCorrelationItem } from "@/lib/types";
import { getNcrpCorrelations } from "@/lib/api";
import { AddressBadge } from "@/components/ui/AddressBadge";
import {
  Network,
  Loader2,
  AlertCircle,
  Users,
  FileText,
  TrendingDown,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

export function NcrpCorrelationDashboard() {
  const [correlations, setCorrelations] = useState<SyndicateCorrelationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const [backendAggregates, setBackendAggregates] = useState<{
    totalCorrelations?: number;
  }>({});

  useEffect(() => {
    let isMounted = true;

    getNcrpCorrelations()
      .then((data) => {
        if (!isMounted) return;
        setCorrelations(data.correlations || []);
        setBackendAggregates({
          totalCorrelations: data.total_correlations,
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[NcrpCorrelationDashboard] API Error:", err);
        setError(err.message || "Unable to retrieve NCRP correlation intelligence.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const totalCorrelations = backendAggregates.totalCorrelations ?? correlations.length;

  const totalComplaints = new Set(correlations.flatMap((c) => c.linked_ncrp_ack_numbers || [])).size;

  const totalSuspectWallets = new Set(correlations.flatMap((c) => c.linked_suspect_addresses || [])).size;

  const totalLoss = correlations.reduce((acc, item) => acc + (item.total_aggregate_loss_inr || 0), 0);

  const toggleExpand = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  const getThreatBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
        return "bg-rose-950/80 text-rose-300 border-rose-700";
      case "HIGH":
        return "bg-amber-950/80 text-amber-300 border-amber-700";
      case "MEDIUM":
        return "bg-yellow-950/80 text-yellow-300 border-yellow-700";
      default:
        return "bg-purple-950/80 text-purple-300 border-purple-700";
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs text-slate-300 select-none">
      {/* Header Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-purple-950 border border-purple-600 text-purple-300">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-sans text-slate-100 uppercase tracking-wider">
              NCRP Cross-Complaint Syndicate Correlation Matrix
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Live Algorithmic Graph Correlation Engine (`GET /api/v1/ncrp/correlations`)
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-slate-950 border border-slate-800 rounded">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <div className="text-slate-400 font-mono text-xs">
            Analyzing cross-complaint syndicate correlations...
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-6 bg-red-950/80 border border-red-800 rounded space-y-2 text-center text-red-200 shadow-xl">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <div className="font-bold font-sans text-sm">
            Unable to retrieve NCRP correlation intelligence.
          </div>
          <p className="text-[11px] text-red-300 max-w-md mx-auto font-mono">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && correlations.length === 0 && (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-slate-950 border border-slate-800 rounded text-slate-500 text-center">
          <Network className="w-10 h-10 text-slate-700" />
          <div className="font-bold font-sans text-slate-300 text-sm">
            No cross-complaint correlations identified.
          </div>
          <p className="text-[11px] text-slate-500 max-w-md font-mono">
            No algorithmic syndicate linkages or common attributes were returned by the backend service.
          </p>
        </div>
      )}

      {/* SUCCESSFUL DATA PRESENTATION */}
      {!loading && !error && correlations.length > 0 && (
        <div className="space-y-4">
          {/* Summary Section */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Total Correlations
              </span>
              <div className="text-xl font-bold font-mono text-purple-300">
                {totalCorrelations}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <Users className="w-3.5 h-3.5 text-teal-400" /> Linked Wallets
              </span>
              <div className="text-xl font-bold font-mono text-teal-300">{totalSuspectWallets}</div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> Linked Ack Nos
              </span>
              <div className="text-xl font-bold font-mono text-cyan-300 font-mono">
                {totalComplaints}
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-center space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Aggregate Loss (INR)
              </span>
              <div className="text-xl font-bold font-mono text-rose-300">
                ₹{totalLoss.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Correlation Cards */}
          <div className="space-y-3">
            {correlations.map((item, idx) => {
              const correlationId = item.correlation_id || `correlation-${idx}`;
              const pivotLabel = item.pivot_entity_label || `Syndicate Pivot #${idx + 1}`;
              const correlationType = item.correlation_type || "shared_link";
              const pivotAddress = item.pivot_address;
              const ackNumbers = item.linked_ncrp_ack_numbers || [];
              const suspectAddresses = item.linked_suspect_addresses || [];
              const lossInr = item.total_aggregate_loss_inr || 0;
              const states = item.reporting_states || [];
              const threatLevel = item.syndicate_threat_level;
              const recommendation = item.action_recommendation;
              const isExpanded = expandedIndex === idx;

              return (
                <div
                  key={correlationId}
                  className={`bg-slate-950 border rounded-lg transition-all overflow-hidden ${
                    isExpanded ? "border-purple-600 shadow-xl" : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Card Header Row */}
                  <div
                    onClick={() => toggleExpand(idx)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none space-x-3 bg-slate-900/60 hover:bg-slate-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-purple-950 border border-purple-700 text-purple-300">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-sans text-slate-100 uppercase">
                            {pivotLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getThreatBadge(threatLevel)}`}>
                            {threatLevel || "SYNDICATE LINK"}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-purple-300 border border-slate-700">
                            {correlationType.toUpperCase().replace(/_/g, " ")}
                          </span>
                        </div>
                        {pivotAddress && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                            Pivot Address: <AddressBadge address={pivotAddress} truncateLength={8} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Metrics */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">
                          Acks Linked
                        </span>
                        <span className="font-bold text-teal-300 text-xs font-mono">
                          {ackNumbers.length}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">
                          Total Loss (INR)
                        </span>
                        <span className="font-bold text-rose-300 text-xs font-mono">
                          ₹{lossInr.toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="text-slate-400 hover:text-slate-100 p-1"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details Row */}
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950 space-y-3.5">
                      {/* Action Recommendation */}
                      {recommendation && (
                        <div className="p-3 bg-purple-950/40 border border-purple-800/80 rounded space-y-1">
                          <span className="text-[10px] text-purple-300 uppercase font-bold tracking-wider font-sans block">
                            Investigative Action Recommendation
                          </span>
                          <p className="text-[11px] text-purple-100 font-sans leading-relaxed">
                            {recommendation}
                          </p>
                        </div>
                      )}

                      {/* Reporting States */}
                      {states.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-sans">
                            Reporting Victim Jurisdictions / States ({states.length})
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {states.map((st) => (
                              <span
                                key={st}
                                className="px-2 py-0.5 bg-slate-900 text-teal-300 border border-slate-700 rounded text-[10px]"
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linked Suspect Addresses */}
                      {suspectAddresses.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-sans">
                            Linked Suspect Wallets ({suspectAddresses.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {suspectAddresses.map((addr) => (
                              <AddressBadge key={addr} address={addr} truncateLength={6} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Linked NCRP Ack Numbers */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider font-sans">
                          Linked NCRP Acknowledgement Numbers ({ackNumbers.length})
                        </div>
                        {ackNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {ackNumbers.map((ack) => (
                              <span
                                key={ack}
                                className="px-2.5 py-1 bg-slate-900 text-slate-200 border border-slate-800 rounded font-mono text-[11px]"
                              >
                                {ack}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-500 font-mono text-[11px]">
                            No explicit NCRP acknowledgement numbers linked.
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      {pivotAddress && (
                        <div className="pt-2 flex justify-end">
                          <Link
                            href={`/trace/new?address=${encodeURIComponent(pivotAddress)}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors"
                          >
                            <span>Initiate Forensic Trace on Pivot Address</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
