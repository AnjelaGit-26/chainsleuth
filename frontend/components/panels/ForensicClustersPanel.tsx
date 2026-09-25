"use client";

import React, { useEffect, useState } from "react";
import { WalletCluster } from "@/lib/types";
import { getCaseClusters } from "@/lib/api";
import { AddressBadge } from "@/components/ui/AddressBadge";
import {
  Boxes,
  Loader2,
  AlertCircle,
  XCircle,
  Network,
  Building,
  Layers,
  Sparkles,
} from "lucide-react";

interface ForensicClustersPanelProps {
  caseId: string;
  selectedCluster: WalletCluster | null;
  onSelectCluster: (cluster: WalletCluster | null) => void;
  visibleGraphNodeAddresses?: string[];
}

export function ForensicClustersPanel({
  caseId,
  selectedCluster,
  onSelectCluster,
  visibleGraphNodeAddresses = [],
}: ForensicClustersPanelProps) {
  const [clusters, setClusters] = useState<WalletCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCaseClusters(caseId)
      .then((data) => {
        if (!isMounted) return;
        setClusters(data.clusters || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[ForensicClustersPanel] Error fetching clusters:", err);
        setError(err.message || "Unable to retrieve forensic clusters.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [caseId]);

  const getClusterTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case "vasp_sweep":
      case "exchange_sweep":
        return {
          label: "VASP SWEEP",
          colorClass: "bg-teal-950/80 text-teal-300 border-teal-700",
        };
      case "syndicate_gas":
      case "syndicate_gas_funder":
        return {
          label: "SYNDICATE GAS",
          colorClass: "bg-purple-950/80 text-purple-300 border-purple-700",
        };
      case "layering_cell":
      case "laundering_typology":
        return {
          label: "LAYERING CELL",
          colorClass: "bg-rose-950/80 text-rose-300 border-rose-700",
        };
      case "smurfing_cell":
        return {
          label: "SMURFING CELL",
          colorClass: "bg-amber-950/80 text-amber-300 border-amber-700",
        };
      case "dex_liquidity":
        return {
          label: "DEX LIQUIDITY",
          colorClass: "bg-cyan-950/80 text-cyan-300 border-cyan-700",
        };
      default:
        return {
          label: (type || "CLUSTER").toUpperCase().replace(/_/g, " "),
          colorClass: "bg-slate-900 text-slate-300 border-slate-700",
        };
    }
  };

  const visibleSet = new Set(visibleGraphNodeAddresses.map((a) => a.toLowerCase()));

  return (
    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-300 flex flex-col space-y-3.5 select-none h-full overflow-y-auto min-h-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-purple-400" />
          <span className="text-slate-100 font-bold font-sans uppercase tracking-wider text-xs">
            Forensic Wallet Clusters
          </span>
        </div>

        {selectedCluster && (
          <button
            type="button"
            onClick={() => onSelectCluster(null)}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 rounded border border-slate-700 text-[10px] font-sans transition-colors cursor-pointer"
          >
            <XCircle className="w-3 h-3 text-rose-400" />
            <span>Clear Cluster Selection</span>
          </button>
        )}
      </div>

      {/* Active Selection Banner */}
      {selectedCluster && (
        <div className="p-2.5 bg-purple-950/60 border border-purple-600/80 rounded space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              ACTIVE GRAPH HIGHLIGHT
            </span>
            <span className="text-[9px] bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded border border-purple-700">
              {(selectedCluster.member_addresses || []).length} WALLETS
            </span>
          </div>
          <p className="text-[11px] text-purple-200 font-mono">
            Highlighting cluster:{" "}
            <span className="font-bold text-slate-100">
              {selectedCluster.label || "Cluster"}
            </span>
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <div className="text-slate-400 font-mono text-xs">Analyzing wallet clusters...</div>
        </div>
      )}

      {/* API Error State */}
      {!loading && error && (
        <div className="p-4 bg-red-950/80 border border-red-800 rounded space-y-2 text-center text-red-200">
          <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          <div className="font-bold font-sans text-xs">Unable to retrieve forensic clusters.</div>
          <p className="text-[10px] text-red-300 font-mono">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && clusters.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center space-y-2 text-center text-slate-500">
          <Network className="w-8 h-8 text-slate-700" />
          <div className="font-sans font-semibold text-slate-300 text-xs">
            No forensic clusters identified.
          </div>
          <p className="text-[11px] text-slate-500 max-w-xs font-mono">
            No algorithmically grouped wallet sub-networks were detected for this investigation case.
          </p>
        </div>
      )}

      {/* Render Clusters List */}
      {!loading && !error && clusters.length > 0 && (
        <div className="space-y-3">
          {clusters.map((cluster, idx) => {
            const clusterId = cluster.cluster_id || `cluster-${idx}`;
            const isSelected = selectedCluster && selectedCluster.cluster_id === clusterId;
            const label = cluster.label || `Cluster #${idx + 1}`;
            const badge = getClusterTypeBadge(cluster.cluster_type);
            const addresses = cluster.member_addresses || [];
            const nodeCount = addresses.length;
            const entityName = cluster.entity_name;
            const description = cluster.description;

            // Count how many cluster addresses are visible in current graph topology
            const visibleInGraphCount =
              visibleGraphNodeAddresses.length > 0
                ? addresses.filter((addr) => visibleSet.has(addr.toLowerCase())).length
                : addresses.length;

            return (
              <div
                key={clusterId}
                onClick={() => onSelectCluster(isSelected ? null : cluster)}
                className={`p-3 rounded border transition-all cursor-pointer space-y-2.5 ${
                  isSelected
                    ? "bg-purple-950/80 border-purple-500 ring-1 ring-purple-500/50 shadow-lg"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Cluster Title & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider mb-1 ${badge.colorClass}`}
                    >
                      {badge.label}
                    </span>
                    <div className="font-bold text-slate-100 font-sans text-xs">{label}</div>
                  </div>

                  {/* Risk Score / Volume */}
                  <div className="text-right shrink-0">
                    {cluster.dominant_risk_score !== undefined && (
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">
                          Dominant Risk
                        </span>
                        <span className="text-rose-400 font-bold text-xs font-mono">
                          {cluster.dominant_risk_score}/100
                        </span>
                      </div>
                    )}
                    {cluster.total_volume_usdt !== undefined && cluster.total_volume_usdt > 0 && (
                      <span className="text-[10px] text-teal-400 font-mono block">
                        ${cluster.total_volume_usdt.toLocaleString()} USDT
                      </span>
                    )}
                  </div>
                </div>

                {/* Entity Name if available */}
                {entityName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-sans">
                    <Building className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>
                      Entity: <strong className="text-slate-100">{entityName}</strong>
                    </span>
                  </div>
                )}

                {/* Backend Description if available */}
                {description && (
                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/80">
                    {description}
                  </p>
                )}

                {/* Cluster Stats */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>
                      Members: <strong className="text-slate-200">{nodeCount}</strong>
                    </span>
                  </div>
                  {visibleGraphNodeAddresses.length > 0 && (
                    <div className="text-slate-400">
                      Graph:{" "}
                      <strong className="text-purple-300">
                        {visibleInGraphCount}/{addresses.length}
                      </strong>{" "}
                      visible
                    </div>
                  )}
                </div>

                {/* Sample Addresses list preview */}
                {addresses.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {addresses.slice(0, 3).map((addr) => (
                      <AddressBadge key={addr} address={addr} truncateLength={4} />
                    ))}
                    {addresses.length > 3 && (
                      <span className="text-[9px] text-slate-500 self-center px-1 font-mono">
                        +{addresses.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
