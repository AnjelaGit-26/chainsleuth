import { create } from "zustand";
import { UserRole, TraceResult, WalletNode, TransferEdge } from "./types";

interface GraphState {
  hopFilter: number;
  layoutName: string;
}

interface AppState {
  // Role State
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;

  // Auth & Profile State
  userEmail: string | null;
  setUserEmail: (email: string | null) => void;
  badgeNumber: string | null;
  setBadgeNumber: (badge: string | null) => void;

  // Active Investigation Case
  activeCase: TraceResult | null;
  setActiveCase: (trace: TraceResult | null) => void;

  // Graph Selection
  selectedNode: WalletNode | null;
  setSelectedNode: (node: WalletNode | null) => void;
  selectedEdge: TransferEdge | null;
  setSelectedEdge: (edge: TransferEdge | null) => void;

  // Graph Settings State
  graphState: GraphState;
  setGraphState: (state: Partial<GraphState>) => void;

  // Backward-compatibility aliases
  role: UserRole;
  setRole: (role: UserRole) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  hopFilter: number;
  setHopFilter: (hops: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentRole: "investigating_officer",
  role: "investigating_officer",
  userEmail: null,
  setUserEmail: (userEmail) => set({ userEmail }),
  badgeNumber: null,
  setBadgeNumber: (badgeNumber) => set({ badgeNumber }),

  setCurrentRole: (role) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chainsleuth_role", role);
    }
    set({ currentRole: role, role });
  },

  setRole: (role) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chainsleuth_role", role);
    }
    set({ currentRole: role, role });
  },

  activeCase: null,
  setActiveCase: (activeCase) => set({ activeCase }),

  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),

  selectedEdge: null,
  setSelectedEdge: (selectedEdge) => set({ selectedEdge }),

  graphState: {
    hopFilter: 5,
    layoutName: "grid",
  },

  setGraphState: (newState) =>
    set((state) => ({
      graphState: { ...state.graphState, ...newState },
      hopFilter: newState.hopFilter ?? state.hopFilter,
    })),

  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  selectedEdgeId: null,
  setSelectedEdgeId: (selectedEdgeId) => set({ selectedEdgeId }),

  hopFilter: 5,
  setHopFilter: (hopFilter) =>
    set((state) => ({
      hopFilter,
      graphState: { ...state.graphState, hopFilter },
    })),
}));
