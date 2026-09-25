"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import { Graph3DWrapper } from "@/components/graph/Graph3DWrapper";
import { GraphViewRef } from "@/components/graph/GraphViewRef";
import { GraphControls } from "@/components/graph/GraphControls";
import { GraphMode } from "@/components/graph/GraphModeToggle";
import { WalletDetailPanel } from "@/components/panels/WalletDetailPanel";
import { ForensicClustersPanel } from "@/components/panels/ForensicClustersPanel";
import { InvestigativeAdvisoryPanel } from "@/components/panels/InvestigativeAdvisoryPanel";
import { ForensicDeepDivePanel } from "@/components/case/ForensicDeepDivePanel";
import { RiskBadge } from "@/components/case/RiskBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { getCase, downloadCourtEvidenceBundle } from "@/lib/api";
import { TraceResult, WalletNode, TransferEdge, WalletCluster } from "@/lib/types";
import { EvidenceCertModal } from "@/components/case/EvidenceCertModal";
import { AIInvestigationDocketModal } from "@/components/case/AIInvestigationDocketModal";
import { ShieldAlert, ArrowRightLeft, X, Boxes, XCircle, FileCheck, Archive, ShieldCheck, Loader2, AlertCircle, Sparkles, FileText } from "lucide-react";

export default function CaseWorkbenchPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const graphRef = useRef<GraphViewRef>(null);

  const [traceData, setTraceData] = useState<TraceResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<WalletNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TransferEdge | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<WalletCluster | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"node_inspector" | "clusters">("node_inspector");
  const [showLabels, setShowLabels] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphMode>("2D");
  const [loading, setLoading] = useState(true);

  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDownloadingBundle, setIsDownloadingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const handleDownloadBundle = async () => {
    if (isDownloadingBundle) return;
    setIsDownloadingBundle(true);
    setBundleError(null);
    try {
      await downloadCourtEvidenceBundle(caseId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to download evidence bundle.";
      setBundleError(msg);
    } finally {
      setIsDownloadingBundle(false);
    }
  };

  useEffect(() => {
    getCase(caseId)
      .then((data) => {
        setTraceData(data);
        if (data.nodes && data.nodes.length > 0) {
          setSelectedNode(data.nodes[0]);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [caseId]);

  const selectedClusterAddresses = selectedCluster?.member_addresses || [];

  const handleSelectNodeFromDeepDive = (addr: string) => {
    if (!traceData?.nodes) return;
    const matchingNode = traceData.nodes.find(
      (n) => n.address.toLowerCase() === addr.toLowerCase()
    );
    if (matchingNode) {
      setSelectedNode(matchingNode);
      setSelectedEdge(null);
      setRightPanelTab("node_inspector");
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col space-y-4 font-mono text-xs select-none pr-1">
        {/* Top Graph Header Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-400" />
              <h1 className="text-sm font-bold font-sans text-slate-100 uppercase tracking-wider">
                Case Workbench: {caseId}
              </h1>
            </div>

            {traceData && (
              <>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500 font-sans text-[11px]">Suspect Wallet:</span>
                <AddressBadge address={traceData.suspect_address} truncateLength={6} />
                <span className="text-slate-700">|</span>
                <span className="uppercase text-slate-300 font-bold bg-slate-900 px-2 py-0.5 border border-slate-800 rounded text-[10px]">
                  {traceData.chain || "TRON"}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadBundle}
              disabled={isDownloadingBundle}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-emerald-300 font-sans font-bold text-[11px] rounded border border-slate-700 transition-colors shadow cursor-pointer disabled:cursor-not-allowed"
              title="Download Evidence Bundle (.ZIP)"
            >
              {isDownloadingBundle ? (
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Download Evidence Bundle</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-teal-300 font-sans font-bold text-[11px] rounded border border-slate-700 transition-colors shadow cursor-pointer"
              title="View Certificate Details (Section 63 BSA)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>View Certificate Details</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 font-sans font-bold text-[11px] rounded border border-purple-800 transition-colors shadow cursor-pointer"
              title="Generate AI Forensic Investigation Docket (Gemini 2.0 Flash)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Generate AI Docket</span>
            </button>

            <Link
              href={`/case/${caseId}/notice`}
              className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 hover:bg-teal-500 text-slate-950 font-sans font-bold text-[11px] rounded transition-colors shadow cursor-pointer"
              title="Issue Section 94 BNSS Legal Freeze Notice"
            >
              <FileText className="w-3.5 h-3.5 text-slate-950" />
              <span>Issue Section 94 Notice</span>
            </Link>

            <Link
              href={`/case/${caseId}/fir`}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-teal-300 font-sans font-bold text-[11px] rounded border border-slate-700 transition-colors shadow"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Generate FIR</span>
            </Link>
            {traceData && <RiskBadge score={traceData.overall_risk_score} size="md" />}
          </div>
        </div>

        {bundleError && (
          <div className="p-2 bg-red-950/90 border border-red-700 rounded text-red-200 font-mono text-[11px] flex items-center justify-between shadow">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{bundleError}</span>
            </div>
            <button
              type="button"
              onClick={() => setBundleError(null)}
              className="text-red-400 hover:text-red-200 font-bold px-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Three-Column Investigation Workspace */}
        <div className="grid grid-cols-12 gap-3 h-[580px] min-h-[580px]">
          {/* CENTER: Graph Canvas Area (8 cols) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col space-y-2 h-full min-h-0 relative">
            <GraphControls
              graphMode={graphMode}
              onGraphModeChange={setGraphMode}
              onZoomIn={() => graphRef.current?.zoomIn()}
              onZoomOut={() => graphRef.current?.zoomOut()}
              onFit={() => graphRef.current?.fit()}
              onRelayout={() => graphRef.current?.resetView()}
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels(!showLabels)}
            />

            {/* Floating Active Cluster Banner */}
            {selectedCluster && (
              <div className="absolute top-14 left-4 z-20 bg-purple-950/90 border border-purple-600 backdrop-blur px-3 py-1.5 rounded text-[11px] font-mono flex items-center gap-3 text-purple-200 shadow-xl">
                <span className="flex items-center gap-1.5 font-bold font-sans">
                  <Boxes className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  Cluster Active: {selectedCluster.label || "Cluster"}
                </span>
                <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded font-mono border border-purple-700">
                  {(selectedCluster.member_addresses || []).length} Wallets
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCluster(null)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-rose-100 rounded border border-slate-700 text-[10px] transition-colors cursor-pointer"
                >
                  <XCircle className="w-3 h-3 text-rose-400" />
                  Clear Cluster Selection
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 relative border border-slate-800 rounded">
              {loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 space-y-3">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-slate-400 font-mono text-xs">
                    Building Cypher path graph topology...
                  </div>
                </div>
              ) : !traceData || traceData.nodes.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 space-y-2 text-slate-500 font-mono text-xs">
                  <ShieldAlert className="w-6 h-6 text-slate-700" />
                  <div>No investigation transaction path found for this case.</div>
                </div>
              ) : graphMode === "2D" ? (
                <GraphCanvas
                  ref={graphRef}
                  nodes={traceData.nodes}
                  edges={traceData.edges}
                  showLabels={showLabels}
                  selectedClusterAddresses={selectedClusterAddresses}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setSelectedEdge(null);
                  }}
                  onSelectEdge={(edge) => {
                    setSelectedEdge(edge);
                  }}
                />
              ) : (
                <Graph3DWrapper
                  ref={graphRef}
                  nodes={traceData.nodes}
                  edges={traceData.edges}
                  suspectAddress={traceData.suspect_address}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  showLabels={showLabels}
                  selectedClusterAddresses={selectedClusterAddresses}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setSelectedEdge(null);
                  }}
                  onSelectEdge={(edge) => {
                    setSelectedEdge(edge);
                  }}
                  onFallbackTo2D={() => setGraphMode("2D")}
                />
              )}

              {/* Transaction Edge Click Popover */}
              {selectedEdge && (
                <div className="absolute top-4 left-4 z-30 w-80 bg-slate-900/95 backdrop-blur border border-teal-800/80 rounded p-3 text-xs shadow-2xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-teal-300 flex items-center gap-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transaction Hop Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedEdge(null)}
                      className="text-slate-500 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] block">Transaction Hash</span>
                    {selectedEdge.txHash ? (
                      <AddressBadge address={selectedEdge.txHash} truncateLength={8} />
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-slate-500 block text-[10px]">From Address</span>
                      {selectedEdge.from ? (
                        <AddressBadge address={selectedEdge.from} truncateLength={4} />
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">To Address</span>
                      {selectedEdge.to ? (
                        <AddressBadge address={selectedEdge.to} truncateLength={4} />
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">Transferred Value:</span>
                    <span className="font-bold text-teal-300">
                      {selectedEdge.value !== undefined && selectedEdge.value !== null
                        ? `${selectedEdge.value.toLocaleString()} ${
                            selectedEdge.token || (traceData?.chain === "bitcoin" ? "BTC" : "N/A")
                          }`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 text-right">
                    {selectedEdge.timestamp ? new Date(selectedEdge.timestamp).toLocaleString() : "N/A"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Investigative Advisory + Tabbed Panel (4 cols) */}
          <div className="col-span-12 lg:col-span-4 h-full min-h-0 overflow-y-auto space-y-3 pr-0.5 flex flex-col">
            {traceData && (traceData.recommendations?.length || traceData.sla_cashout_alert) && (
              <InvestigativeAdvisoryPanel
                recommendations={traceData.recommendations}
                slaAlert={traceData.sla_cashout_alert}
                caseId={caseId}
              />
            )}

            {/* Tab Selector Header */}
            <div className="flex items-center bg-slate-900 p-1 rounded border border-slate-800 shrink-0 gap-1 font-sans text-xs">
              <button
                type="button"
                onClick={() => setRightPanelTab("node_inspector")}
                className={`flex-1 py-1.5 px-2 rounded font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-[11px] ${
                  rightPanelTab === "node_inspector"
                    ? "bg-slate-800 text-teal-400 border border-slate-700 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Node Inspector</span>
              </button>

              <button
                type="button"
                onClick={() => setRightPanelTab("clusters")}
                className={`flex-1 py-1.5 px-2 rounded font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-[11px] ${
                  rightPanelTab === "clusters"
                    ? "bg-slate-800 text-purple-400 border border-slate-700 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Boxes className="w-3.5 h-3.5 shrink-0" />
                <span>Forensic Clusters</span>
                {selectedCluster && (
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Tab Panel Content */}
            <div className="flex-1 min-h-0">
              {rightPanelTab === "node_inspector" ? (
                <WalletDetailPanel
                  node={selectedNode}
                  edges={traceData?.edges}
                  attribution={traceData?.attribution}
                  caseId={caseId}
                />
              ) : (
                <ForensicClustersPanel
                  caseId={caseId}
                  selectedCluster={selectedCluster}
                  onSelectCluster={setSelectedCluster}
                  visibleGraphNodeAddresses={traceData?.nodes?.map((n) => n.address) || []}
                />
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Full-Width Section for Forensic Deep Dive Analysis below Workbench Grid */}
        <div className="pt-2">
          <ForensicDeepDivePanel
            caseId={caseId}
            graphNodes={traceData?.nodes}
            onSelectNode={handleSelectNodeFromDeepDive}
          />
        </div>
      </div>

      <EvidenceCertModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        caseId={caseId}
      />

      <AIInvestigationDocketModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        caseId={caseId}
        traceData={traceData}
      />
    </AppShell>
  );
}



