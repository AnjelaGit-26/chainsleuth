"use client";

import React from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  Box,
  Layers,
  Target,
  Building2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

interface GraphControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onRelayout?: () => void;
  onFocusSource?: () => void;
  onFocusDestination?: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  viewMode?: "2D" | "3D";
  onToggleViewMode?: (mode: "2D" | "3D") => void;
  activeLayerFilter?: number | string | null;
  onLayerFilterChange?: (layer: number | string | null) => void;
}

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onRelayout,
  onFocusSource,
  onFocusDestination,
  showLabels = true,
  onToggleLabels,
  viewMode = "2D",
  onToggleViewMode,
  activeLayerFilter = null,
  onLayerFilterChange,
}: GraphControlsProps) {
  const { hopFilter, setHopFilter } = useAppStore();

  return (
    <div className="glass-panel flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs select-none">
      {/* Zoom & View & Camera Focus Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* 2D | 3D Toggle */}
        <div className="flex items-center rounded-xl bg-black/5 p-0.5 border border-black/10 mr-1">
          <button
            type="button"
            onClick={() => onToggleViewMode?.("2D")}
            className={[
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
              viewMode === "2D"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            ].join(" ")}
            title="2D Cytoscape Graph"
          >
            <Layers className="size-3.5" />
            2D
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode?.("3D")}
            className={[
              "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer",
              viewMode === "3D"
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            ].join(" ")}
            title="3D Force Graph (Three.js)"
          >
            <Box className="size-3.5" />
            3D
          </button>
        </div>

        {/* Camera Action Controls */}
        <button
          type="button"
          onClick={onZoomIn}
          className="size-8 inline-flex items-center justify-center rounded-xl bg-white/60 hover:bg-white text-[var(--foreground)] border border-white/60 shadow-xs transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="size-4 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          className="size-8 inline-flex items-center justify-center rounded-xl bg-white/60 hover:bg-white text-[var(--foreground)] border border-white/60 shadow-xs transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="size-4 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
        </button>

        <button
          type="button"
          onClick={onFit}
          className="size-8 inline-flex items-center justify-center rounded-xl bg-white/60 hover:bg-white text-[var(--foreground)] border border-white/60 shadow-xs transition-colors cursor-pointer"
          title="Fit Graph to View"
        >
          <Maximize2 className="size-4 text-[var(--muted-foreground)] hover:text-[var(--primary)]" />
        </button>

        <button
          type="button"
          onClick={onRelayout}
          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-white/60 hover:bg-white text-xs font-semibold text-[var(--foreground)] border border-white/60 shadow-xs transition-colors cursor-pointer"
          title="Re-layout Graph"
        >
          <RefreshCw className="size-3.5 text-[var(--primary)]" />
          <span className="hidden sm:inline">Relayout</span>
        </button>

        {/* Focus Source & Focus Destination Navigation */}
        <button
          type="button"
          onClick={onFocusSource}
          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-600 border border-rose-500/20 shadow-xs transition-colors cursor-pointer"
          title="Focus Camera on Source / Suspect Wallet (Layer 0)"
        >
          <Target className="size-3.5 text-rose-500" />
          <span className="hidden md:inline">Focus Source</span>
        </button>

        <button
          type="button"
          onClick={onFocusDestination}
          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-600 border border-cyan-500/20 shadow-xs transition-colors cursor-pointer"
          title="Focus Camera on Destination / Attributed VASP Node"
        >
          <Building2 className="size-3.5 text-cyan-500" />
          <span className="hidden md:inline">Focus Destination</span>
        </button>

        <button
          type="button"
          onClick={onToggleLabels}
          className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-xl bg-white/60 hover:bg-white text-xs font-semibold text-[var(--foreground)] border border-white/60 shadow-xs transition-colors cursor-pointer"
          title="Toggle Graph Labels"
        >
          {showLabels ? (
            <Eye className="size-3.5 text-[var(--primary)]" />
          ) : (
            <EyeOff className="size-3.5 text-[var(--muted-foreground)]" />
          )}
          <span>{showLabels ? "Labels On" : "Labels Off"}</span>
        </button>
      </div>

      {/* Layer Filter & Hop Slider */}
      <div className="flex items-center gap-3 pl-2 border-l border-white/40">
        {/* Layer Filter Selector */}
        <div className="flex items-center gap-1.5">
          <Filter className="size-3.5 text-[var(--muted-foreground)] shrink-0" />
          <select
            value={activeLayerFilter === null ? "all" : String(activeLayerFilter)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "all") onLayerFilterChange?.(null);
              else onLayerFilterChange?.(val);
            }}
            className="h-8 rounded-xl bg-white/70 border border-white/60 px-2 text-xs font-semibold text-[var(--foreground)] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="all">All Layers</option>
            <option value="0">Layer 0 (Source)</option>
            <option value="1">Layer 1</option>
            <option value="2">Layer 2</option>
            <option value="3">Layer 3</option>
            <option value="4">Layer 4</option>
            <option value="5+">Layer 5+</option>
          </select>
        </div>

        {/* Hop Depth Filter Slider */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Hops:
          </span>
          <input
            type="range"
            min={1}
            max={10}
            value={hopFilter}
            onChange={(e) => setHopFilter(Number(e.target.value))}
            className="w-16 accent-[var(--primary)] cursor-pointer h-1.5 rounded-lg bg-black/10"
          />
          <span className="grid size-5 place-items-center rounded-full bg-[var(--primary)] text-white text-[10px] font-mono font-bold">
            {hopFilter}
          </span>
        </div>
      </div>
    </div>
  );
}
