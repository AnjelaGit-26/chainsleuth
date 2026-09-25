"use client";

import React, { forwardRef } from "react";
import dynamic from "next/dynamic";
import { WalletNode, TransferEdge, VASPAttribution } from "@/lib/types";
import { GraphCanvasRef } from "./GraphCanvas";

interface Graph3DProps {
  nodes?: WalletNode[];
  edges?: TransferEdge[];
  suspectAddress?: string;
  attribution?: VASPAttribution | null;
  onSelectNode?: (node: WalletNode | null) => void;
  onSelectEdge?: (edge: TransferEdge | null) => void;
  selectedNode?: WalletNode | null;
  selectedEdge?: TransferEdge | null;
  showLabels?: boolean;
  activeLayerFilter?: number | string | null;
}

const DynamicGraph3DInner = dynamic(
  () => import("./Graph3DInner").then((m) => m.Graph3DInner),
  {
    ssr: false,
    loading: () => (
      <div className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 font-mono text-xs">
        <div className="size-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        <span>Initializing 3D Forensic Engine…</span>
      </div>
    ),
  }
);

export const Graph3D = forwardRef<GraphCanvasRef, Graph3DProps>(function Graph3D(
  props,
  ref
) {
  return <DynamicGraph3DInner {...props} ref={ref} />;
});
