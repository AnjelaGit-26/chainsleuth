"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import cytoscape from "cytoscape";
import { getCytoscapeStyles } from "./graphStyles";
import { WalletNode, TransferEdge } from "@/lib/types";

import { GraphViewRef } from "./GraphViewRef";

export interface GraphCanvasRef extends GraphViewRef {
  relayout: () => void;
}

interface GraphCanvasProps {
  nodes?: WalletNode[];
  edges?: TransferEdge[];
  onSelectNode?: (node: WalletNode | null) => void;
  onSelectEdge?: (edge: TransferEdge | null) => void;
  showLabels?: boolean;
  selectedClusterAddresses?: string[];
}

export const GraphCanvas = forwardRef<GraphViewRef, GraphCanvasProps>(function GraphCanvas(
  { nodes = [], edges = [], onSelectNode, onSelectEdge, showLabels = true, selectedClusterAddresses = [] },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (cyRef.current) {
        cyRef.current.zoom(cyRef.current.zoom() * 1.25);
      }
    },
    zoomOut: () => {
      if (cyRef.current) {
        cyRef.current.zoom(cyRef.current.zoom() * 0.8);
      }
    },
    fit: () => {
      if (cyRef.current) {
        cyRef.current.fit(undefined, 30);
      }
    },
    resetView: () => {
      if (cyRef.current) {
        const layout = cyRef.current.layout({
          name: "breadthfirst",
          directed: true,
          padding: 30,
          spacingFactor: 1.25,
        });
        layout.run();
        cyRef.current.fit(undefined, 30);
      }
    },
    relayout: () => {
      if (cyRef.current) {
        const layout = cyRef.current.layout({
          name: "breadthfirst",
          directed: true,
          padding: 30,
          spacingFactor: 1.25,
        });
        layout.run();
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Helper to calculate edge line width based on transaction value
    const maxEdgeVal = Math.max(...edges.map((e) => e.value), 1);

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => {
        const isOfac = n.typologyFlags?.includes("ofac_sanctioned");
        const isBridge = n.typologyFlags?.includes("bridge_hop");
        const isBurner = n.typologyFlags.length > 0;
        const role = n.isVasp ? "vasp" : isOfac ? "ofac" : isBridge ? "bridge" : isBurner ? "burner" : "default";
        const truncated =
          n.address.length > 8
            ? `${n.address.slice(0, 4)}...${n.address.slice(-4)}`
            : n.address;
        return {
          data: {
            id: n.address,
            label: truncated,
            role: role,
            nodeObj: n,
          },
        };
      }),
      ...edges.map((e) => {
        const thickness = Math.min(Math.max(2, (e.value / maxEdgeVal) * 6), 6);
        const isSuspicious = e.value > 10000 || e.token === "USDT";
        return {
          data: {
            id: e.txHash,
            source: e.from,
            target: e.to,
            label: `${e.value.toLocaleString()} ${e.token}`,
            width: thickness,
            suspicious: isSuspicious ? "true" : "false",
            edgeObj: e,
          },
        };
      }),
    ];

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: getCytoscapeStyles(showLabels),
      layout: {
        name: "breadthfirst",
        directed: true,
        padding: 30,
        spacingFactor: 1.25,
      },
    });

    cyRef.current.on("tap", "node", (evt) => {
      const nodeData = evt.target.data("nodeObj") as WalletNode;
      onSelectNode?.(nodeData);
      onSelectEdge?.(null);
    });

    cyRef.current.on("tap", "edge", (evt) => {
      const edgeData = evt.target.data("edgeObj") as TransferEdge;
      onSelectEdge?.(edgeData);
      onSelectNode?.(null);
    });

    cyRef.current.on("tap", (evt) => {
      if (evt.target === cyRef.current) {
        onSelectNode?.(null);
        onSelectEdge?.(null);
      }
    });

    return () => {
      cyRef.current?.destroy();
    };
  }, [nodes, edges, showLabels, onSelectNode, onSelectEdge]);

  // Effect to highlight cluster nodes
  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().removeClass("cluster-highlighted");
    if (selectedClusterAddresses && selectedClusterAddresses.length > 0) {
      const addrSet = new Set(selectedClusterAddresses.map((a) => a.toLowerCase()));
      cyRef.current.nodes().forEach((node) => {
        if (addrSet.has(node.id().toLowerCase())) {
          node.addClass("cluster-highlighted");
        }
      });
    }
  }, [selectedClusterAddresses, nodes]);


  return (
    <div className="relative w-full h-full bg-slate-950 border border-slate-800 rounded select-none overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-xs">
          No Graph Topology Loaded
        </div>
      )}
    </div>
  );
});
