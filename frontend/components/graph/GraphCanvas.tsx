"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import cytoscape from "cytoscape";
import { getCytoscapeStyles } from "./graphStyles";
import { WalletNode, TransferEdge, VASPAttribution } from "@/lib/types";
import { computeNodeLayers } from "@/lib/graphLayerUtils";
import { GraphLegend } from "./GraphLegend";

export interface GraphCanvasRef {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  relayout: () => void;
  focusSource: () => void;
  focusDestination: () => void;
}

interface GraphCanvasProps {
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

export const GraphCanvas = forwardRef<GraphCanvasRef, GraphCanvasProps>(function GraphCanvas(
  {
    nodes = [],
    edges = [],
    suspectAddress,
    attribution,
    onSelectNode,
    onSelectEdge,
    showLabels = true,
    activeLayerFilter = null,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Compute graph layer hierarchy
  const layerMap = useMemo(() => {
    return computeNodeLayers(nodes, edges, suspectAddress, attribution);
  }, [nodes, edges, suspectAddress, attribution]);

  // Imperative handle for controls
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
    relayout: () => {
      if (cyRef.current) {
        const layout = cyRef.current.layout({
          name: "breadthfirst",
          directed: true,
          padding: 40,
          spacingFactor: 1.3,
        });
        layout.run();
      }
    },
    focusSource: () => {
      if (!cyRef.current) return;
      let sourceElem = cyRef.current.nodes('[?isSource]');
      if (sourceElem.length === 0) sourceElem = cyRef.current.nodes().first();
      if (sourceElem.length > 0) {
        cyRef.current.animate({
          center: { eles: sourceElem },
          zoom: 1.5,
          duration: 600,
        });
      }
    },
    focusDestination: () => {
      if (!cyRef.current) return;
      const destElem = cyRef.current.nodes('[?isDestination]');
      if (destElem.length > 0) {
        cyRef.current.animate({
          center: { eles: destElem.first() },
          zoom: 1.5,
          duration: 600,
        });
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const maxEdgeVal = Math.max(...edges.map((e) => e.value), 1);

    // Filter nodes by active layer if set
    const filteredNodes = nodes.filter((n) => {
      if (activeLayerFilter === null || activeLayerFilter === "all") return true;
      const info = layerMap.get(n.address);
      if (!info) return true;
      if (activeLayerFilter === "5+") return (info.layer ?? 99) >= 5;
      if (activeLayerFilter === "unavailable") return info.layer === null;
      return info.layer === Number(activeLayerFilter);
    });

    const filteredNodeAddresses = new Set(filteredNodes.map((n) => n.address.toLowerCase()));

    const filteredEdges = edges.filter(
      (e) =>
        filteredNodeAddresses.has(e.from.toLowerCase()) &&
        filteredNodeAddresses.has(e.to.toLowerCase())
    );

    const elements: cytoscape.ElementDefinition[] = [
      ...filteredNodes.map((n) => {
        const info = layerMap.get(n.address);
        const truncated =
          n.address.length > 8
            ? `${n.address.slice(0, 4)}...${n.address.slice(-4)}`
            : n.address;
        return {
          data: {
            id: n.address,
            label: truncated,
            color: info?.color || "#64748B",
            isSource: info?.isSource || false,
            isDestination: info?.isDestination || false,
            layer: info?.layer,
            layerLabel: info?.layerLabel || "Layer Unavailable",
            nodeObj: n,
          },
        };
      }),
      ...filteredEdges.map((e) => {
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
        padding: 40,
        spacingFactor: 1.3,
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
  }, [nodes, edges, layerMap, showLabels, activeLayerFilter, onSelectNode, onSelectEdge]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-white/40 backdrop-blur-md rounded-2xl select-none overflow-hidden">
      <div ref={containerRef} className="w-full h-full min-h-[420px]" />

      {/* Dynamic Graph Legend Overlay */}
      {nodes.length > 0 && (
        <GraphLegend layerMap={layerMap} nodeCount={nodes.length} edgeCount={edges.length} />
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)] font-mono text-xs">
          No Graph Data Available
        </div>
      )}
    </div>
  );
});
