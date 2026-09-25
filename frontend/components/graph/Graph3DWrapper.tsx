"use client";

import React, { forwardRef } from "react";
import dynamic from "next/dynamic";
import { WalletNode, TransferEdge } from "@/lib/types";
import { GraphViewRef } from "./GraphViewRef";

interface Graph3DWrapperProps {
  nodes?: WalletNode[];
  edges?: TransferEdge[];
  suspectAddress?: string;
  selectedNode?: WalletNode | null;
  selectedEdge?: TransferEdge | null;
  onSelectNode?: (node: WalletNode | null) => void;
  onSelectEdge?: (edge: TransferEdge | null) => void;
  showLabels?: boolean;
  selectedClusterAddresses?: string[];
  onFallbackTo2D?: () => void;
}

const DynamicGraph3D = dynamic(
  () => import("./Graph3D").then((mod) => mod.Graph3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[420px] bg-slate-950 border border-slate-800 rounded flex flex-col items-center justify-center space-y-3 font-mono text-xs select-none">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400">Initializing 3D investigation graph...</div>
      </div>
    ),
  }
);

export const Graph3DWrapper = forwardRef<GraphViewRef, Graph3DWrapperProps>(
  function Graph3DWrapper(props, ref) {
    return <DynamicGraph3D ref={ref} {...props} />;
  }
);
