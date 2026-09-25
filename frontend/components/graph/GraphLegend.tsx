"use client";

import React, { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { LAYER_COLORS, NodeLayerInfo } from "@/lib/graphLayerUtils";

interface GraphLegendProps {
  layerMap: Map<string, NodeLayerInfo>;
  nodeCount: number;
  edgeCount: number;
}

export function GraphLegend({ layerMap, nodeCount, edgeCount }: GraphLegendProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Extract unique active layers from current graph
  const activeLayers = new Set<number | string>();
  let maxHopDepth = 0;
  let hasSource = false;
  let hasDestination = false;

  layerMap.forEach((info) => {
    if (info.isSource) hasSource = true;
    if (info.isDestination) hasDestination = true;
    if (info.layer !== null) {
      activeLayers.add(info.layer);
      if (info.layer > maxHopDepth) maxHopDepth = info.layer;
    } else {
      activeLayers.add("Unavailable");
    }
  });

  const uniqueLayersCount = Array.from(activeLayers).filter((l) => typeof l === "number").length;

  return (
    <div className="absolute bottom-3 left-3 z-20 max-w-xs rounded-xl bg-slate-900/90 backdrop-blur-md border border-white/10 p-3 text-slate-200 text-xs shadow-2xl transition-all">
      {/* Legend Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px] text-slate-300 uppercase">
          <span>Graph Layers</span>
          <div className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              onClick={() => setShowInfo(!showInfo)}
              className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
              aria-label="Layer info explanation"
            >
              <Info className="size-3.5" />
            </button>
            {showInfo && (
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2.5 rounded-lg bg-slate-950 border border-cyan-500/30 text-[10px] leading-relaxed text-slate-300 shadow-xl z-30">
                Layer indicates the wallet&apos;s hop distance from the investigation source based on the available transaction graph. Layer does not represent risk or legal status.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
          title={collapsed ? "Expand Legend" : "Collapse Legend"}
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {/* Active Layer Items */}
          <div className="grid grid-cols-1 gap-1 text-[11px]">
            {hasSource && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0 shadow-sm"
                  style={{ backgroundColor: LAYER_COLORS.source }}
                />
                <span className="font-semibold text-rose-300">Layer 0 — Suspect / Source</span>
              </div>
            )}
            {activeLayers.has(1) && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.layer1 }}
                />
                <span>Layer 1 — 1 Hop</span>
              </div>
            )}
            {activeLayers.has(2) && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.layer2 }}
                />
                <span>Layer 2 — 2 Hops</span>
              </div>
            )}
            {activeLayers.has(3) && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.layer3 }}
                />
                <span>Layer 3 — 3 Hops</span>
              </div>
            )}
            {activeLayers.has(4) && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.layer4 }}
                />
                <span>Layer 4 — 4 Hops</span>
              </div>
            )}
            {Array.from(activeLayers).some((l) => typeof l === "number" && l >= 5) && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.layer5Plus }}
                />
                <span>Layer 5+ — Extended Hops</span>
              </div>
            )}
            {hasDestination && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rotate-45 inline-block shrink-0 shadow-sm"
                  style={{ backgroundColor: LAYER_COLORS.destination }}
                />
                <span className="font-semibold text-cyan-300">Destination / Attributed VASP</span>
              </div>
            )}
            {activeLayers.has("Unavailable") && (
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: LAYER_COLORS.unavailable }}
                />
                <span className="text-slate-400">Layer Unavailable</span>
              </div>
            )}
          </div>

          {/* Layer Summary Statistics */}
          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 font-mono">
            <div>
              Layers: <b className="text-slate-200">{uniqueLayersCount}</b>
            </div>
            <div>
              Max Hops: <b className="text-slate-200">{maxHopDepth}</b>
            </div>
            <div>
              Nodes: <b className="text-slate-200">{nodeCount}</b>
            </div>
            <div>
              Edges: <b className="text-slate-200">{edgeCount}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
