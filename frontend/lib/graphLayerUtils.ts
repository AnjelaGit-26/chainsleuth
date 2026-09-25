import { WalletNode, TransferEdge, VASPAttribution } from "./types";

export interface NodeLayerInfo {
  node: WalletNode;
  layer: number | null; // 0, 1, 2, 3, 4, 5... or null if "Unavailable"
  isSource: boolean;
  isDestination: boolean;
  color: string;
  layerLabel: string;
}

export const LAYER_COLORS = {
  source: "#EF4444",      // Layer 0 - Strong red
  layer1: "#F97316",      // Layer 1 - Orange
  layer2: "#F59E0B",      // Layer 2 - Yellow/amber
  layer3: "#10B981",      // Layer 3 - Green
  layer4: "#3B82F6",      // Layer 4 - Blue
  layer5Plus: "#8B5CF6",  // Layer 5+ - Purple
  destination: "#06B6D4", // Destination/VASP - Distinct teal
  unavailable: "#64748B", // Unavailable - Slate
};

export function getLayerColor(
  layer: number | null,
  isDestination: boolean,
  isSource: boolean
): string {
  if (isSource) return LAYER_COLORS.source;
  if (isDestination) return LAYER_COLORS.destination;
  if (layer === null || layer === undefined) return LAYER_COLORS.unavailable;
  if (layer === 0) return LAYER_COLORS.source;
  if (layer === 1) return LAYER_COLORS.layer1;
  if (layer === 2) return LAYER_COLORS.layer2;
  if (layer === 3) return LAYER_COLORS.layer3;
  if (layer === 4) return LAYER_COLORS.layer4;
  return LAYER_COLORS.layer5Plus;
}

export function computeNodeLayers(
  nodes: WalletNode[],
  edges: TransferEdge[],
  suspectAddress?: string,
  attribution?: VASPAttribution | null
): Map<string, NodeLayerInfo> {
  const map = new Map<string, NodeLayerInfo>();
  if (!nodes || nodes.length === 0) return map;

  // Find source address
  const normSuspect = suspectAddress?.toLowerCase();
  let sourceAddr = nodes.find((n) => n.address.toLowerCase() === normSuspect)?.address;
  if (!sourceAddr && nodes.length > 0) {
    sourceAddr = nodes[0].address;
  }

  // Build directed adjacency list for BFS graph distance from source
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    const u = e.from.toLowerCase();
    const v = e.to.toLowerCase();
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push(v);
  });

  // BFS calculation
  const distances = new Map<string, number>();
  if (sourceAddr) {
    const startKey = sourceAddr.toLowerCase();
    distances.set(startKey, 0);
    const queue: string[] = [startKey];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currDist = distances.get(curr)!;
      const neighbors = adj.get(curr) || [];
      for (const nxt of neighbors) {
        if (!distances.has(nxt)) {
          distances.set(nxt, currDist + 1);
          queue.push(nxt);
        }
      }
    }
  }

  nodes.forEach((node) => {
    const key = node.address.toLowerCase();
    const isSource = key === sourceAddr?.toLowerCase();
    const isDestination = Boolean(
      node.isVasp ||
        (attribution && attribution.deposit_address?.toLowerCase() === key) ||
        (attribution && attribution.hot_wallet_address?.toLowerCase() === key)
    );

    const layer = distances.has(key) ? distances.get(key)! : null;
    const color = getLayerColor(layer, isDestination, isSource);

    let layerLabel = "Layer Unavailable";
    if (isSource) {
      layerLabel = "Layer 0 — Source / Suspect Wallet";
    } else if (isDestination) {
      layerLabel = `Layer ${layer ?? "Unavailable"} — Destination / VASP`;
    } else if (layer !== null) {
      layerLabel =
        layer >= 5
          ? `Layer 5+ (${layer} hops)`
          : `Layer ${layer} (${layer} hop${layer > 1 ? "s" : ""})`;
    }

    map.set(node.address, {
      node,
      layer,
      isSource,
      isDestination,
      color,
      layerLabel,
    });
  });

  return map;
}
