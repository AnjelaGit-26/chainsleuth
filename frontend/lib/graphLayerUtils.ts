import { WalletNode, TransferEdge } from "./types";

export interface NodeLayerInfo {
  layer: number | null;
  isOrigin: boolean;
}

export const LAYER_COLORS: Record<
  number | "5+" | "unreachable" | "origin" | "vasp" | "ofac" | "bridge",
  string
> = {
  0: "#f97316",           // Origin (Orange)
  1: "#38bdf8",           // Layer 1 (Sky Blue)
  2: "#818cf8",           // Layer 2 (Indigo)
  3: "#a78bfa",           // Layer 3 (Purple)
  4: "#34d399",           // Layer 4 (Emerald)
  "5+": "#facc15",        // Layer 5+ (Yellow)
  unreachable: "#64748b", // Unreachable / Disconnected (Slate Muted)
  origin: "#f97316",      // Origin Node Highlight Color
  vasp: "#14b8a6",        // Attributed VASP / Exchange Target (Teal)
  ofac: "#ef4444",        // OFAC Sanctioned Node (Red)
  bridge: "#06b6d4",      // Cross-Chain Bridge Hop Node (Cyan)
};

/**
 * Computes graph layers using Breadth-First Search (BFS) based on shortest hop distance from the origin node.
 * Handles cycles safely with a visited map and marks disconnected nodes as layer = null.
 */
export function calculateGraphLayers(
  nodes: WalletNode[],
  edges: TransferEdge[],
  suspectAddress?: string
): Map<string, NodeLayerInfo> {
  const result = new Map<string, NodeLayerInfo>();

  if (!nodes || nodes.length === 0) return result;

  // 1. Determine origin address (suspect wallet)
  let originNode: WalletNode | undefined;
  if (suspectAddress) {
    originNode = nodes.find(
      (n) => n.address.toLowerCase() === suspectAddress.toLowerCase()
    );
  }

  // Fallback: check zero_gas_burner typology or default to first node
  if (!originNode) {
    originNode =
      nodes.find((n) => n.typologyFlags?.includes("zero_gas_burner")) || nodes[0];
  }

  const originAddrLower = originNode?.address.toLowerCase();

  // 2. Build undirected adjacency list for graph traversal
  const adj = new Map<string, Set<string>>();
  nodes.forEach((n) => adj.set(n.address.toLowerCase(), new Set()));

  edges.forEach((e) => {
    const fromLower = e.from.toLowerCase();
    const toLower = e.to.toLowerCase();
    if (!adj.has(fromLower)) adj.set(fromLower, new Set());
    if (!adj.has(toLower)) adj.set(toLower, new Set());
    adj.get(fromLower)!.add(toLower);
    adj.get(toLower)!.add(fromLower);
  });

  // 3. BFS Shortest Path Distance Calculation from Origin
  const layers = new Map<string, number>();

  if (originAddrLower && adj.has(originAddrLower)) {
    layers.set(originAddrLower, 0);
    const queue: Array<{ addr: string; dist: number }> = [
      { addr: originAddrLower, dist: 0 },
    ];

    while (queue.length > 0) {
      const { addr, dist } = queue.shift()!;
      const neighbors = adj.get(addr);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!layers.has(neighbor)) {
            layers.set(neighbor, dist + 1);
            queue.push({ addr: neighbor, dist: dist + 1 });
          }
        }
      }
    }
  }

  // 4. Map results back to original node addresses
  nodes.forEach((n) => {
    const lower = n.address.toLowerCase();
    const isOrigin = lower === originAddrLower;
    const layer = layers.has(lower) ? layers.get(lower)! : null;
    result.set(n.address, { layer, isOrigin });
  });

  return result;
}

/**
 * Returns node color according to strict priority:
 * 1. Origin (#f97316 Orange)
 * 2. VASP (#14b8a6 Teal)
 * 3. OFAC Sanctioned (#ef4444 Red)
 * 4. Bridge Hop (#06b6d4 Cyan)
 * 5. Layer color (Layers 1-5+ / Unreachable)
 */
export function getLayerColor(
  layer: number | null,
  isOrigin?: boolean,
  isVasp?: boolean,
  isOfacSanctioned?: boolean,
  isBridge?: boolean
): string {
  if (isOrigin) return LAYER_COLORS.origin;
  if (isVasp) return LAYER_COLORS.vasp;
  if (isOfacSanctioned) return LAYER_COLORS.ofac;
  if (isBridge) return LAYER_COLORS.bridge;
  if (layer === null || layer === undefined) return LAYER_COLORS.unreachable;
  if (layer >= 5) return LAYER_COLORS["5+"];
  return LAYER_COLORS[layer as 0 | 1 | 2 | 3 | 4] || LAYER_COLORS["5+"];
}

/**
 * Returns node radius hierarchy:
 * Origin: 16
 * VASP: 14
 * OFAC Sanctioned: 13
 * Bridge Hop: 12
 * High-Risk (> 70): 10
 * Normal: 7
 */
export function getNodeSize(node: {
  isOrigin?: boolean;
  isVasp?: boolean;
  isOfacSanctioned?: boolean;
  isBridge?: boolean;
  riskScore?: number;
}): number {
  if (node.isOrigin) return 16;
  if (node.isVasp) return 14;
  if (node.isOfacSanctioned) return 13;
  if (node.isBridge) return 12;
  if ((node.riskScore ?? 0) > 70) return 10;
  return 7;
}
