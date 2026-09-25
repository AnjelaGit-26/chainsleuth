"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
} from "react";
import ForceGraph3D, { ForceGraphMethods } from "react-force-graph-3d";
import * as THREE from "three";
import { WalletNode, TransferEdge } from "@/lib/types";
import { GraphViewRef } from "./GraphViewRef";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  calculateGraphLayers,
  getLayerColor,
  getNodeSize,
  LAYER_COLORS,
} from "@/lib/graphLayerUtils";

interface Graph3DProps {
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

export type Graph3DRef = GraphViewRef;

interface ForceNode {
  id: string;
  label: string;
  role: "vasp" | "burner" | "default";
  nodeObj: WalletNode;
  val: number;
  color: string;
  layer: number | null;
  isOrigin: boolean;
  x?: number;
  y?: number;
  z?: number;
}

interface ForceLink {
  id: string;
  source: string;
  target: string;
  label: string;
  width: number;
  suspicious: boolean;
  edgeObj: TransferEdge;
}

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export const Graph3D = forwardRef<Graph3DRef, Graph3DProps>(function Graph3D(
  {
    nodes = [],
    edges = [],
    suspectAddress,
    selectedNode = null,
    selectedEdge = null,
    onSelectNode,
    onSelectEdge,
    selectedClusterAddresses = [],
    onFallbackTo2D,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  const { hopFilter, activeCase } = useAppStore();

  // Measure container dimensions using ResizeObserver
  useEffect(() => {
    if (typeof window === "undefined") return;
    setWebGlSupported(checkWebGLSupport());

    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(300, entry.contentRect.width),
          height: Math.max(300, entry.contentRect.height),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Configure Three.js lighting
  useEffect(() => {
    if (fgRef.current) {
      try {
        const scene = fgRef.current.scene();
        if (scene && !scene.getObjectByName("ambientLight")) {
          const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
          ambientLight.name = "ambientLight";
          scene.add(ambientLight);
        }
        if (scene && !scene.getObjectByName("dirLight")) {
          const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
          dirLight.position.set(200, 200, 200);
          dirLight.name = "dirLight";
          scene.add(dirLight);
        }
      } catch (err) {
        console.warn("Could not attach lighting to Three.js scene:", err);
        setHasError(true);
      }
    }
  }, []);

  // Auto-fit camera when nodes load
  useEffect(() => {
    if (fgRef.current && nodes.length > 0) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 40);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [nodes.length]);

  // Camera Control Ref API implementation
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (fgRef.current) {
        const fg = fgRef.current as unknown as {
          cameraPosition: (
            pos?: { x?: number; y?: number; z?: number },
            target?: { x?: number; y?: number; z?: number },
            ms?: number
          ) => { x?: number; y?: number; z?: number };
        };
        const currentCam = fg.cameraPosition() || { x: 0, y: 0, z: 200 };
        fg.cameraPosition(
          {
            x: (currentCam.x || 0) * 0.8,
            y: (currentCam.y || 0) * 0.8,
            z: (currentCam.z || 200) * 0.8,
          },
          undefined,
          400
        );
      }
    },
    zoomOut: () => {
      if (fgRef.current) {
        const fg = fgRef.current as unknown as {
          cameraPosition: (
            pos?: { x?: number; y?: number; z?: number },
            target?: { x?: number; y?: number; z?: number },
            ms?: number
          ) => { x?: number; y?: number; z?: number };
        };
        const currentCam = fg.cameraPosition() || { x: 0, y: 0, z: 200 };
        fg.cameraPosition(
          {
            x: (currentCam.x || 0) * 1.25,
            y: (currentCam.y || 0) * 1.25,
            z: (currentCam.z || 200) * 1.25,
          },
          undefined,
          400
        );
      }
    },
    fit: () => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 40);
      }
    },
    resetView: () => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 40);
      }
    },
  }));

  // Pre-calculate deterministic graph layers via BFS from origin
  const layerMap = useMemo(() => {
    const originAddress = suspectAddress || activeCase?.suspect_address;
    return calculateGraphLayers(nodes, edges, originAddress);
  }, [nodes, edges, suspectAddress, activeCase?.suspect_address]);

  // Build sets for investigation path highlighting
  const { connectedNodeAddresses, connectedEdgeIds } = useMemo(() => {
    const nodeAddrs = new Set<string>();
    const edgeIds = new Set<string>();

    if (selectedNode) {
      nodeAddrs.add(selectedNode.address);
      edges.forEach((e) => {
        if (e.from === selectedNode.address || e.to === selectedNode.address) {
          edgeIds.add(e.txHash);
          nodeAddrs.add(e.from);
          nodeAddrs.add(e.to);
        }
      });
    }

    if (selectedEdge) {
      edgeIds.add(selectedEdge.txHash);
      nodeAddrs.add(selectedEdge.from);
      nodeAddrs.add(selectedEdge.to);
    }

    return { connectedNodeAddresses: nodeAddrs, connectedEdgeIds: edgeIds };
  }, [selectedNode, selectedEdge, edges]);

  // Map WalletNode[] & TransferEdge[] to 3D graph format with BFS Layer & Origin Highlighting
  const graphData = useMemo(() => {
    const maxVal = Math.max(...edges.map((e) => e.value), 1);

    // Filter nodes by hop filter (without changing precalculated layer numbers)
    const filteredNodes = nodes.filter((n) => {
      const info = layerMap.get(n.address);
      if (!info) return true;
      if (info.isOrigin) return true;
      if (info.layer === null) return true;
      return info.layer <= (hopFilter ?? 10);
    });

    const validNodeAddresses = new Set(filteredNodes.map((n) => n.address));

    const forceNodes: ForceNode[] = filteredNodes.map((n) => {
      const info = layerMap.get(n.address);
      const isOrigin = info?.isOrigin ?? false;
      const layer = info?.layer ?? null;
      const isOfac = n.typologyFlags?.includes("ofac_sanctioned") ?? false;
      const isBridge = n.typologyFlags?.includes("bridge_hop") ?? false;

      const isBurner = n.typologyFlags.length > 0;
      const role: "vasp" | "burner" | "default" = n.isVasp
        ? "vasp"
        : isBurner
        ? "burner"
        : "default";

      const truncated =
        n.address.length > 10
          ? `${n.address.slice(0, 5)}...${n.address.slice(-4)}`
          : n.address;

      const label = isOrigin ? `ORIGIN (${truncated})` : truncated;

      // Priority color mapping: Origin > VASP > OFAC > Bridge > Layer Color
      const color = getLayerColor(layer, isOrigin, n.isVasp, isOfac, isBridge);

      // Radius hierarchy: Origin (16), VASP (14), OFAC (13), Bridge (12), High-Risk (10), Normal (7)
      const val = getNodeSize({
        isOrigin,
        isVasp: n.isVasp,
        isOfacSanctioned: isOfac,
        isBridge,
        riskScore: n.riskScore,
      });

      return {
        id: n.address,
        label,
        role,
        nodeObj: n,
        val,
        color,
        layer,
        isOrigin,
      };
    });

    const filteredEdges = edges.filter(
      (e) => validNodeAddresses.has(e.from) && validNodeAddresses.has(e.to)
    );

    const forceLinks: ForceLink[] = filteredEdges.map((e) => {
      const thickness = Math.min(Math.max(2.5, (e.value / maxVal) * 5), 5);
      const isSuspicious = e.value > 10000 || e.token === "USDT";

      return {
        id: e.txHash,
        source: e.from,
        target: e.to,
        label: `${e.value.toLocaleString()} ${e.token}`,
        width: thickness,
        suspicious: isSuspicious,
        edgeObj: e,
      };
    });

    return { nodes: forceNodes, links: forceLinks };
  }, [nodes, edges, layerMap, hopFilter]);

  // Dynamic node color handling based on selection state
  const getNodeColor = useCallback(
    (node: object) => {
      const n = node as ForceNode;
      const isSelected = selectedNode?.address === n.id;
      if (isSelected) return "#f8fafc"; // Pure white highlight for active selection

      const isFocused = selectedNode || selectedEdge;
      if (isFocused) {
        return connectedNodeAddresses.has(n.id) ? n.color : "#334155"; // Muted slate for unrelated
      }

      return n.color;
    },
    [selectedNode, selectedEdge, connectedNodeAddresses]
  );

  // Dynamic node radius handling
  const getNodeVal = useCallback(
    (node: object) => {
      const n = node as ForceNode;
      if (selectedNode?.address === n.id) return n.val * 1.35;
      return n.val;
    },
    [selectedNode]
  );

  // Link color handling with high contrast
  const getLinkColor = useCallback(
    (link: object) => {
      const l = link as ForceLink;
      const isSelected = selectedEdge?.txHash === l.id;
      if (isSelected) return "#38bdf8";

      const isFocused = selectedNode || selectedEdge;
      if (isFocused) {
        return connectedEdgeIds.has(l.id)
          ? l.suspicious
            ? "#f87171"
            : "#38bdf8"
          : "rgba(51, 65, 85, 0.15)";
      }

      return l.suspicious ? "#f87171" : "#64748b";
    },
    [selectedNode, selectedEdge, connectedEdgeIds]
  );

  // Link width handling
  const getLinkWidth = useCallback(
    (link: object) => {
      const l = link as ForceLink;
      const isSelected = selectedEdge?.txHash === l.id;
      if (isSelected) return 4.5;
      if (selectedNode && connectedEdgeIds.has(l.id)) return 3.5;
      return l.width;
    },
    [selectedNode, selectedEdge, connectedEdgeIds]
  );

  // Custom 3D Mesh Object with Emissive Lighting & Origin Halo
  const getNodeThreeObject = useCallback(
    (node: object) => {
      const n = node as ForceNode;
      const isSelected = selectedNode?.address === n.id;
      const color = getNodeColor(n);
      const radius = getNodeVal(n);

      if (n.isOrigin) {
        const group = new THREE.Group();

        // Core Origin Mesh (Emissive Orange Sphere)
        const coreGeometry = new THREE.SphereGeometry(radius, 24, 24);
        const coreMaterial = new THREE.MeshStandardMaterial({
          color: "#f97316",
          emissive: "#ea580c",
          emissiveIntensity: isSelected ? 0.9 : 0.6,
          roughness: 0.2,
          metalness: 0.3,
        });
        const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        group.add(coreMesh);

        // Outer Emissive Halo Mesh (Transparent Glow Sphere)
        const haloGeometry = new THREE.SphereGeometry(radius * 1.45, 24, 24);
        const haloMaterial = new THREE.MeshBasicMaterial({
          color: "#fb923c",
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
        group.add(haloMesh);

        // Emissive Accent Ring around Origin
        const ringGeometry = new THREE.RingGeometry(radius * 1.5, radius * 1.75, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: "#fdba74",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.5,
        });
        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = Math.PI / 4;
        group.add(ringMesh);

        return group;
      }

      // Standard / VASP / OFAC / Bridge / Layer Mesh
      const isOfac = n.nodeObj.typologyFlags?.includes("ofac_sanctioned");
      const isBridge = n.nodeObj.typologyFlags?.includes("bridge_hop");
      const isClusterHighlighted = selectedClusterAddresses.some(
        (addr) => addr.toLowerCase() === n.nodeObj.address.toLowerCase()
      );
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: isClusterHighlighted ? "#9333ea" : color,
        emissive: isSelected
          ? "#38bdf8"
          : isClusterHighlighted
          ? "#c084fc"
          : isOfac
          ? "#ef4444"
          : isBridge
          ? "#06b6d4"
          : color,
        emissiveIntensity: isSelected
          ? 0.7
          : isClusterHighlighted
          ? 0.8
          : n.nodeObj.isVasp
          ? 0.5
          : isOfac
          ? 0.6
          : isBridge
          ? 0.5
          : 0.3,
        roughness: 0.3,
        metalness: 0.2,
      });

      return new THREE.Mesh(geometry, material);
    },
    [selectedNode, selectedClusterAddresses, getNodeColor, getNodeVal]
  );

  // Compact HTML Hover Tooltip with Origin Badge, OFAC Sanctions Badge, Bridge Hop Badge, & Layer Details
  const getNodeLabel = useCallback((node: object) => {
    const n = node as ForceNode;
    const obj = n.nodeObj;
    const flags = obj.typologyFlags?.join(", ") || "None";
    const isOfac = obj.typologyFlags?.includes("ofac_sanctioned");
    const isBridge = obj.typologyFlags?.includes("bridge_hop");

    const originHeader = n.isOrigin
      ? `<div style="display: inline-block; background: #f97316; color: #ffffff; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">ORIGIN NODE</div>`
      : "";

    const ofacHeader = isOfac
      ? `<div style="display: inline-block; background: #dc2626; color: #ffffff; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; margin-left: 4px;">OFAC SANCTIONS MATCH</div>`
      : "";

    const bridgeHeader = isBridge
      ? `<div style="display: inline-block; background: #0891b2; color: #ffffff; font-weight: bold; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px; margin-left: 4px;">BRIDGE HOP</div>`
      : "";

    const vaspLabel = obj.isVasp
      ? `<div style="font-weight: bold; color: #14b8a6; margin-top: 2px;">VASP / Exchange Target</div>`
      : "";

    const layerBadge = n.isOrigin
      ? `<span style="color: #f97316; font-weight: bold;">0 (Suspect Wallet)</span>`
      : n.layer !== null && n.layer !== undefined
      ? `<span style="color: ${n.color}; font-weight: bold;">Layer ${n.layer >= 5 ? "5+" : n.layer}</span>`
      : `<span style="color: #64748b; font-weight: bold;">Unreachable</span>`;

    return `
      <div style="
        background: #0f172a;
        border: 1px solid ${n.isOrigin ? "#f97316" : isOfac ? "#ef4444" : isBridge ? "#06b6d4" : obj.isVasp ? "#14b8a6" : "#334155"};
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        color: #f1f5f9;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        min-width: 180px;
      ">
        ${originHeader}${ofacHeader}${bridgeHeader}
        <div style="font-weight: bold; color: ${n.isOrigin ? "#f97316" : isOfac ? "#f87171" : isBridge ? "#22d3ee" : "#38bdf8"}; font-size: 12px;">${n.label}</div>
        ${vaspLabel}
        <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
          Address: <span style="color: #f1f5f9;">${obj.address}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
          Graph Layer: ${layerBadge}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
          Chain: <span style="color: #cbd5e1; font-weight: bold;">${(obj.chain || "tron").toUpperCase()}</span> | Risk: <span style="color: ${obj.riskScore > 70 ? "#ef4444" : "#14b8a6"}; font-weight: bold;">${obj.riskScore}/100</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
          Balance: <span style="color: #cbd5e1;">${obj.balance.toLocaleString()}</span>
        </div>
        <div style="font-size: 9px; color: #64748b; margin-top: 3px;">
          Flags: ${flags}
        </div>
      </div>
    `;
  }, []);

  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as ForceNode;
      onSelectNode?.(n.nodeObj);
      onSelectEdge?.(null);
    },
    [onSelectNode, onSelectEdge]
  );

  const handleLinkClick = useCallback(
    (link: object) => {
      const l = link as ForceLink;
      onSelectEdge?.(l.edgeObj);
      onSelectNode?.(null);
    },
    [onSelectNode, onSelectEdge]
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectNode?.(null);
    onSelectEdge?.(null);
  }, [onSelectNode, onSelectEdge]);

  if (!webGlSupported || hasError) {
    return (
      <div className="w-full h-full min-h-[420px] bg-slate-950 border border-slate-800 rounded flex flex-col items-center justify-center p-6 text-center select-none font-mono">
        <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
        <div className="text-slate-200 font-sans text-sm font-semibold mb-1">
          3D Visualization Unavailable
        </div>
        <div className="text-slate-400 text-xs max-w-sm mb-4">
          WebGL acceleration is disabled or unsupported in this browser session.
        </div>
        {onFallbackTo2D && (
          <button
            type="button"
            onClick={onFallbackTo2D}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-teal-400 hover:text-teal-300 hover:bg-slate-800 text-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Switch to 2D Graph
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-[#0b1329] border border-slate-800 rounded overflow-hidden select-none"
    >
      <ForceGraph3D
        ref={fgRef as unknown as React.MutableRefObject<ForceGraphMethods>}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#0b1329"
        nodeThreeObject={getNodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={getNodeLabel}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={getLinkColor}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={getLinkColor}
        linkCurvature={0.1}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        showNavInfo={false}
      />

      {/* 3D Investigation Graph Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-20 bg-slate-900/90 backdrop-blur border border-slate-800 rounded p-2.5 shadow-xl font-mono text-[10px] text-slate-300 pointer-events-auto max-w-[200px] space-y-1.5">
        <div className="font-bold text-slate-200 tracking-wider uppercase text-[9px] border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>Investigation Layers</span>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#f97316]/40"
              style={{ backgroundColor: LAYER_COLORS[0] }}
            />
            <span className="font-bold text-[#f97316]">ORIGIN (Layer 0)</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS[1] }}
            />
            <span>Layer 1</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS[2] }}
            />
            <span>Layer 2</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS[3] }}
            />
            <span>Layer 3</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS[4] }}
            />
            <span>Layer 4</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS["5+"] }}
            />
            <span>Layer 5+</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: LAYER_COLORS.unreachable }}
            />
            <span>Unreachable</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rotate-45 shrink-0"
                style={{ backgroundColor: LAYER_COLORS.vasp }}
              />
              <span className="text-teal-400 font-semibold">VASP Target</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#ef4444]/40"
              style={{ backgroundColor: LAYER_COLORS.ofac }}
            />
            <span className="text-red-400 font-bold">OFAC Sanctioned</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#06b6d4]/40"
              style={{ backgroundColor: LAYER_COLORS.bridge }}
            />
            <span className="text-cyan-400 font-bold">Bridge Hop</span>
          </div>
        </div>
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-mono text-xs pointer-events-none">
          No Graph Topology Loaded
        </div>
      )}
    </div>
  );
});


