import { create } from "zustand";
import { UserRole, TraceResult, WalletNode, TransferEdge, AuthUser } from "./types";

interface GraphState {
  hopFilter: number;
  layoutName: string;
}

interface AppState {
  // Officer & Application State
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  token: string | null;
  setToken: (token: string | null) => void;
  allowedRoles: (UserRole | string)[];
  setAllowedRoles: (roles: (UserRole | string)[]) => void;
  permissions: string[];
  setPermissions: (permissions: string[]) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (auth: boolean) => void;
  isLoadingAuth: boolean;
  setIsLoadingAuth: (loading: boolean) => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;

  setAuthSession: (params: {
    user: AuthUser | null;
    token: string | null;
    roles?: (UserRole | string)[];
    permissions?: string[];
    isAuthenticated: boolean;
  }) => void;
  clearAuthSession: () => void;

  // Role State & Context Switcher
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;

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
  user: null,
  setUser: (user) => set({ user }),

  token: null,
  setToken: (token) => set({ token }),

  allowedRoles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
  setAllowedRoles: (allowedRoles) => set({ allowedRoles }),

  permissions: [],
  setPermissions: (permissions) => set({ permissions }),

  isAuthenticated: false,
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  isLoadingAuth: true,
  setIsLoadingAuth: (isLoadingAuth) => set({ isLoadingAuth }),

  authError: null,
  setAuthError: (authError) => set({ authError }),

  setAuthSession: ({ user, token, roles = [], permissions = [], isAuthenticated }) => {
    const primaryRole = (user?.role || roles[0] || "investigating_officer") as UserRole;
    set({
      user,
      token,
      allowedRoles: roles.length > 0 ? roles : ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
      permissions,
      isAuthenticated,
      currentRole: primaryRole,
      role: primaryRole,
      isLoadingAuth: false,
      authError: null,
    });
  },

  clearAuthSession: () => {
    set({
      user: null,
      token: null,
      allowedRoles: [],
      permissions: [],
      isAuthenticated: false,
      isLoadingAuth: false,
      authError: null,
      currentRole: "investigating_officer",
      role: "investigating_officer",
    });
  },

  currentRole: "investigating_officer",
  role: "investigating_officer",

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
