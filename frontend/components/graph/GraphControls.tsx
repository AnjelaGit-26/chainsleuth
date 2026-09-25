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
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { GraphModeToggle, GraphMode } from "./GraphModeToggle";

interface GraphControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onRelayout?: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
  graphMode?: GraphMode;
  onGraphModeChange?: (mode: GraphMode) => void;
}

export function GraphControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onRelayout,
  showLabels = true,
  onToggleLabels,
  graphMode = "2D",
  onGraphModeChange,
}: GraphControlsProps) {
  const { hopFilter, setHopFilter } = useAppStore();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-xs text-slate-300 select-none">
      {/* Zoom & View Controls */}
      <div className="flex items-center gap-1">
        {onGraphModeChange && (
          <div className="mr-1 pr-2 border-r border-slate-800">
            <GraphModeToggle mode={graphMode} onChange={onGraphModeChange} />
          </div>
        )}

        <button
          type="button"
          onClick={onZoomIn}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onFit}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Fit Graph to View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onRelayout}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1"
          title="Re-layout / Reset View"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="text-[10px] hidden sm:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={onToggleLabels}
          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1 border-l border-slate-800 ml-1 pl-2"
          title="Toggle Graph Labels"
        >
          {showLabels ? (
            <Eye className="w-3.5 h-3.5 text-teal-400" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="text-[10px]">{showLabels ? "Hide Labels" : "Show Labels"}</span>
        </button>
      </div>

      {/* Hop Depth Filter Slider */}
      <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-[11px] text-slate-400">Hop Depth:</span>
        <input
          type="range"
          min={1}
          max={10}
          value={hopFilter}
          onChange={(e) => setHopFilter(Number(e.target.value))}
          className="w-20 accent-teal-500 bg-slate-800 cursor-pointer"
        />
        <span className="w-4 text-center font-bold text-teal-400">{hopFilter}</span>
      </div>
    </div>
  );
}

