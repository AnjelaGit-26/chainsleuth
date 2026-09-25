"use client";

import React, { useEffect, useState, useRef, use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { GraphCanvas, GraphCanvasRef } from "@/components/graph/GraphCanvas";
import { Graph3D } from "@/components/graph/Graph3D";
import { GraphControls } from "@/components/graph/GraphControls";
import { WalletDetailPanel } from "@/components/panels/WalletDetailPanel";
import { RiskBadge } from "@/components/case/RiskBadge";
import { getCase } from "@/lib/api";
import { TraceResult, WalletNode, TransferEdge } from "@/lib/types";
import { ShieldAlert, ArrowRightLeft, X, Loader2 } from "lucide-react";

export default function CaseWorkbenchPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);
  const graphCanvasRef = useRef<GraphCanvasRef>(null);

  const [traceData, setTraceData] = useState<TraceResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<WalletNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<TransferEdge | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [activeLayerFilter, setActiveLayerFilter] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCase(caseId)
      .then((data) => {
        setTraceData(data);
        if (data.nodes?.length > 0) setSelectedNode(data.nodes[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [caseId]);

  return (
    <AppShell>
      <div className="workspace-in flex flex-col gap-4" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Header */}
        <div className="glass-panel flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldAlert className="size-5 text-[var(--primary)] shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-base font-bold text-[var(--foreground)] truncate">
                Case Workbench: {caseId}
              </h1>
              {traceData && (
                <p className="font-mono text-xs text-[var(--muted-foreground)] truncate">
                  {traceData.suspect_address.slice(0, 14)}…{traceData.suspect_address.slice(-8)}
                  &nbsp;·&nbsp;<span className="uppercase">{traceData.chain}</span>
                </p>
              )}
            </div>
          </div>
          {traceData && <RiskBadge score={traceData.overall_risk_score} size="md" />}
        </div>

        {/* Workspace */}
        <div className="flex flex-1 gap-4 min-h-0" style={{ height: "calc(100vh - 240px)" }}>
          {/* Graph area */}
          <div className="flex flex-1 flex-col gap-3 min-h-0">
            <GraphControls
              onZoomIn={() => graphCanvasRef.current?.zoomIn()}
              onZoomOut={() => graphCanvasRef.current?.zoomOut()}
              onFit={() => graphCanvasRef.current?.fit()}
              onRelayout={() => graphCanvasRef.current?.relayout()}
              onFocusSource={() => graphCanvasRef.current?.focusSource()}
              onFocusDestination={() => graphCanvasRef.current?.focusDestination()}
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels(!showLabels)}
              viewMode={viewMode}
              onToggleViewMode={(mode) => setViewMode(mode)}
              activeLayerFilter={activeLayerFilter}
              onLayerFilterChange={(layer) => setActiveLayerFilter(layer)}
            />

            <div className="glass-panel relative flex-1 min-h-0 overflow-hidden">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="size-8 animate-spin text-[var(--primary)]" />
                  <p className="text-sm text-[var(--muted-foreground)]">Building graph topology…</p>
                </div>
              ) : !traceData || traceData.nodes.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
                  <ShieldAlert className="size-8" />
                  <p className="text-sm">No transaction path found for this case.</p>
                </div>
              ) : viewMode === "3D" ? (
                <Graph3D
                  ref={graphCanvasRef}
                  nodes={traceData.nodes}
                  edges={traceData.edges}
                  suspectAddress={traceData.suspect_address}
                  attribution={traceData.attribution}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  showLabels={showLabels}
                  activeLayerFilter={activeLayerFilter}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setSelectedEdge(null);
                  }}
                  onSelectEdge={(edge) => setSelectedEdge(edge)}
                />
              ) : (
                <GraphCanvas
                  ref={graphCanvasRef}
                  nodes={traceData.nodes}
                  edges={traceData.edges}
                  suspectAddress={traceData.suspect_address}
                  attribution={traceData.attribution}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  showLabels={showLabels}
                  activeLayerFilter={activeLayerFilter}
                  onSelectNode={(node) => {
                    setSelectedNode(node);
                    setSelectedEdge(null);
                  }}
                  onSelectEdge={(edge) => setSelectedEdge(edge)}
                />
              )}

              {/* Edge detail popover */}
              {selectedEdge && (
                <div className="glass-panel absolute top-4 left-4 z-30 w-80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--foreground)] flex items-center gap-1.5 text-sm">
                      <ArrowRightLeft className="size-4 text-[var(--primary)]" />
                      Transaction Hop
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedEdge(null)}
                      className="size-6 inline-flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors cursor-pointer"
                    >
                      <X className="size-3.5 text-[var(--muted-foreground)]" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[var(--muted-foreground)] mb-0.5">Transaction Hash</p>
                      <p className="font-mono text-[var(--foreground)] break-all">
                        {selectedEdge.txHash.slice(0, 20)}…
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[var(--muted-foreground)] mb-0.5">From</p>
                        <p className="font-mono text-[var(--foreground)]">
                          {selectedEdge.from.slice(0, 8)}…
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--muted-foreground)] mb-0.5">To</p>
                        <p className="font-mono text-[var(--foreground)]">
                          {selectedEdge.to.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[color-mix(in_oklab,var(--border)_50%,transparent)]">
                      <span className="text-[var(--muted-foreground)]">Value</span>
                      <span className="font-bold font-mono text-[var(--primary)]">
                        {selectedEdge.value.toLocaleString()} {selectedEdge.token}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--muted-foreground)] text-right">
                      {new Date(selectedEdge.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 overflow-y-auto">
            <WalletDetailPanel
              node={selectedNode}
              edges={traceData?.edges}
              attribution={traceData?.attribution}
              caseId={caseId}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
