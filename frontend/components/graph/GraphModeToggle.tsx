"use client";

import React from "react";
import { Box, Layers } from "lucide-react";

export type GraphMode = "2D" | "3D";

interface GraphModeToggleProps {
  mode: GraphMode;
  onChange: (mode: GraphMode) => void;
}

export function GraphModeToggle({ mode, onChange }: GraphModeToggleProps) {
  return (
    <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded font-mono text-xs select-none">
      <button
        type="button"
        onClick={() => onChange("2D")}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
          mode === "2D"
            ? "bg-slate-800 text-teal-400 font-bold border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Switch to 2D Cytoscape Graph"
        aria-label="2D Graph Mode"
      >
        <Layers className="w-3 h-3" />
        <span>2D</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("3D")}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
          mode === "3D"
            ? "bg-slate-800 text-teal-400 font-bold border border-slate-700 shadow-sm"
            : "text-slate-400 hover:text-slate-200"
        }`}
        title="Switch to 3D WebGL Force Graph"
        aria-label="3D Graph Mode"
      >
        <Box className="w-3 h-3" />
        <span>3D</span>
      </button>
    </div>
  );
}
