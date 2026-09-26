"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo,
} from "react";
import ForceGraph3D, { ForceGraphMethods } from "react-force-graph-3d";
import { WalletNode, TransferEdge, VASPAttribution } from "@/lib/types";
import { GraphCanvasRef } from "./GraphCanvas";
import { computeNodeLayers } from "@/lib/graphLayerUtils";
import { GraphLegend } from "./GraphLegend";

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

export const Graph3DInner = forwardRef<GraphCanvasRef, Graph3DProps>(function Graph3DInner(
  {
    nodes = [],
    edges = [],
    suspectAddress,
    attribution,
    onSelectNode,
    onSelectEdge,
    selectedNode,
    showLabels = true,
    activeLayerFilter = null,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });

  // Compute graph layer mapping
  const layerMap = useMemo(() => {
    return computeNodeLayers(nodes, edges, suspectAddress, attribution);
  }, [nodes, edges, suspectAddress, attribution]);

  // Handle dynamic container sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 450,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Expose imperative camera control ref compatible with GraphCanvasRef
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (!fgRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fg = fgRef.current as any;
      const currentPos = fg.cameraPosition();
      if (currentPos) {
        fg.cameraPosition(
          { x: currentPos.x * 0.8, y: currentPos.y * 0.8, z: currentPos.z * 0.8 },
          undefined,
          400
        );
      }
    },
    zoomOut: () => {
      if (!fgRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fg = fgRef.current as any;
      const currentPos = fg.cameraPosition();
      if (currentPos) {
        fg.cameraPosition(
          { x: currentPos.x * 1.25, y: currentPos.y * 1.25, z: currentPos.z * 1.25 },
          undefined,
          400
        );
      }
    },
    fit: () => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 30);
      }
    },
    relayout: () => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
        fgRef.current.zoomToFit(400, 30);
      }
    },
    focusSource: () => {
      if (!fgRef.current) return;
      // Find source node in graphData
      let sourceNodeInfo = Array.from(layerMap.values()).find((i) => i.isSource);
      if (!sourceNodeInfo && nodes.length > 0) {
        sourceNodeInfo = layerMap.get(nodes[0].address);
      }
      if (sourceNodeInfo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fg = fgRef.current as any;
        const gData = fg.graphData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetObj = gData.nodes?.find((n: any) => n.id === sourceNodeInfo?.node.address);
        if (targetObj) {
          const nx = targetObj.x || 0;
          const ny = targetObj.y || 0;
          const nz = targetObj.z || 0;
          fg.cameraPosition({ x: nx, y: ny, z: nz + 100 }, { x: nx, y: ny, z: nz }, 1000);
        }
      }
    },
    focusDestination: () => {
      if (!fgRef.current) return;
      const destNodeInfo = Array.from(layerMap.values()).find((i) => i.isDestination);
      if (destNodeInfo) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fg = fgRef.current as any;
        const gData = fg.graphData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetObj = gData.nodes?.find((n: any) => n.id === destNodeInfo.node.address);
        if (targetObj) {
          const nx = targetObj.x || 0;
          const ny = targetObj.y || 0;
          const nz = targetObj.z || 0;
          fg.cameraPosition({ x: nx, y: ny, z: nz + 100 }, { x: nx, y: ny, z: nz }, 1000);
        }
      }
    },
  }));

  // Graph Data Formatting & 3D Spatial Layering
  const graphData = useMemo(() => {
    const maxVal = Math.max(...edges.map((e) => e.value), 1);

    // Filter nodes by layer if active
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

    const formattedNodes = filteredNodes.map((n) => {
      const info = layerMap.get(n.address);
      const layerNum = info?.layer ?? 0;

      const truncated =
        n.address && n.address.length > 10
          ? `${n.address.slice(0, 5)}...${n.address.slice(-4)}`
          : n.address || "Unknown";

      // 3D Spatial Layering: depth (Z axis) increases with layer distance
      const zPos = -layerNum * 100;

      return {
        id: n.address,
        address: n.address,
        label: truncated,
        color: info?.color || "#64748B",
        val: info?.isSource ? 9 : info?.isDestination ? 8 : 4.5,
        fz: zPos, // Fixed Z-depth based on layer for spatial progression
        layerInfo: info,
        rawNode: n,
      };
    });

    const formattedLinks = filteredEdges.map((e) => {
      const isSuspicious = e.value > 10000 || e.token === "USDT";
      return {
        id: e.txHash,
        source: e.from,
        target: e.to,
        value: e.value,
        token: e.token,
        timestamp: e.timestamp,
        txHash: e.txHash,
        color: isSuspicious ? "#F43F5E" : "#94A3B8",
        width: Math.min(Math.max(1.5, (e.value / maxVal) * 5), 5),
        rawEdge: e,
      };
    });

    return { nodes: formattedNodes, links: formattedLinks };
  }, [nodes, edges, layerMap, activeLayerFilter]);

  // Handle Node Click
  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      if (node && node.rawNode) {
        onSelectNode?.(node.rawNode);
        onSelectEdge?.(null);
        // Focus camera on clicked node
        if (fgRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fg = fgRef.current as any;
          const nx = node.x || 0;
          const ny = node.y || 0;
          const nz = node.z || 0;
          const distance = 80;
          const distRatio = 1 + distance / Math.hypot(nx || 1, ny || 1, nz || 1);
          fg.cameraPosition(
            { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio },
            { x: nx, y: ny, z: nz },
            1000
          );
        }
      }
    },
    [onSelectNode, onSelectEdge]
  );

  // Node Hover Tooltip
  const nodeLabel = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      const n = node.rawNode as WalletNode;
      const info = node.layerInfo as ReturnType<typeof layerMap.get>;
      if (!n) return "";

      const addressStr = n.address ? n.address : "Unavailable";
      const chainStr = n.chain ? n.chain.toUpperCase() : "Unavailable";
      const layerStr = info?.layerLabel || "Layer Unavailable";
      const hopStr = info?.layer !== null && info?.layer !== undefined ? info.layer : "Unavailable";

      const vaspStr =
        n.isVasp
          ? attribution?.vasp_name || "Identified KYC VASP"
          : "VASP attribution unavailable";

      const riskStr = n.riskScore != null ? `${n.riskScore}/100` : "Risk assessment unavailable";
      const balanceStr =
        n.balance != null
          ? `${n.balance.toLocaleString()} ${
              n.chain === "tron"
                ? "TRX"
                : n.chain === "ethereum" || n.chain === "base"
                ? "ETH"
                : n.chain === "bitcoin"
                ? "BTC"
                : "SOL"
            }`
          : "Balance unavailable";

      return `
        <div style="background: rgba(15,23,42,0.95); border: 1px solid ${node.color || "rgba(255,255,255,0.15)"}; backdrop-filter: blur(8px); padding: 12px 16px; border-radius: 12px; font-family: monospace; font-size: 11px; color: #F8FAFC; max-width: 310px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="font-weight: bold; color: ${node.color || "#38BDF8"}; margin-bottom: 4px; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between;">
            <span>${info?.isSource ? "🔴 Source / Suspect Wallet" : info?.isDestination ? "🏢 Destination / VASP" : "👛 Investigation Wallet"}</span>
          </div>
          <div style="font-size: 10px; color: #94A3B8; word-break: break-all; margin-bottom: 8px;">${addressStr}</div>

          <div style="background: rgba(255,255,255,0.05); padding: 6px 8px; border-radius: 6px; margin-bottom: 8px; font-size: 10px;">
            <div style="color: ${node.color || "#38BDF8"}; font-weight: bold;">${layerStr}</div>
            <div style="color: #94A3B8;">Hop Distance: ${hopStr}</div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; border-t: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div><span style="color:#64748B;">Chain:</span> <b>${chainStr}</b></div>
            <div><span style="color:#64748B;">Risk:</span> <b>${riskStr}</b></div>
            <div><span style="color:#64748B;">Balance:</span> <b>${balanceStr}</b></div>
            <div><span style="color:#64748B;">VASP:</span> <b>${vaspStr}</b></div>
          </div>
        </div>
      `;
    },
    [attribution, layerMap]
  );

  // Link Hover Tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkLabel = useCallback((link: any) => {
    const txHashStr = link.txHash ? `${link.txHash.slice(0, 16)}…` : "Transaction hash unavailable";
    const valueStr =
      link.value != null
        ? `${link.value.toLocaleString()} ${link.token || ""}`
        : "Amount unavailable";
    const timeStr = link.timestamp
      ? new Date(link.timestamp).toLocaleString()
      : "Timestamp unavailable";

    return `
      <div style="background: rgba(15,23,42,0.95); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(8px); padding: 10px 14px; border-radius: 12px; font-family: monospace; font-size: 11px; color: #F8FAFC; max-width: 280px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="font-weight: bold; color: #38BDF8; margin-bottom: 4px;">➡️ Transfer Hop</div>
        <div><span style="color:#64748B;">TxHash:</span> <span style="word-break:break-all;">${txHashStr}</span></div>
        <div><span style="color:#64748B;">Value:</span> <b style="color:#4ADE80;">${valueStr}</b></div>
        <div><span style="color:#64748B;">Timestamp:</span> ${timeStr}</div>
      </div>
    `;
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="relative w-full h-full min-h-[420px] bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 font-mono text-xs">
        No Graph Data Available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden select-none"
    >
      {/* Visual Indicator of Labels Toggle */}
      {!showLabels && (
        <div className="absolute top-3 right-3 z-10 rounded-lg bg-black/60 backdrop-blur-xs px-2.5 py-1 font-mono text-[10px] text-slate-400 border border-white/10">
          Labels Hidden
        </div>
      )}

      {/* Dynamic Graph Legend Overlay */}
      {nodes.length > 0 && (
        <GraphLegend layerMap={layerMap} nodeCount={nodes.length} edgeCount={edges.length} />
      )}

      <ForceGraph3D
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={fgRef as any}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#0B132B"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeColor={(n: any) =>
          selectedNode && n.address === selectedNode.address ? "#38BDF8" : n.color || "#64748B"
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeVal={(n: any) =>
          selectedNode && n.address === selectedNode.address ? (n.val || 5) * 1.5 : n.val || 5
        }
        nodeLabel={showLabels ? nodeLabel : undefined}
        linkLabel={showLabels ? linkLabel : undefined}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkColor={(l: any) => l.color || "#94A3B8"}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkWidth={(l: any) => l.width || 1.5}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={2}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          onSelectNode?.(null);
          onSelectEdge?.(null);
        }}
        showNavInfo={false}
      />
    </div>
  );
});
