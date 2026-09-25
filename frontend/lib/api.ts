import { useAppStore } from "./store";
import {
  CaseSummary,
  Chain,
  LegalNoticePayload,
  TraceRequest,
  TraceResult,
  VASPAttribution,
  WalletNode,
  TransferEdge,
  CaseClustersResponse,
  WalletCluster,
  FIRCreate,
  FIRResponse,
  NCRPComplaintRecord,
  NCRPBatchIngestRequest,
  NCRPBatchIngestResponse,
  SyndicateCorrelationItem,
  NcrpCorrelationsResponse,
  AuditLogItem,
  AuthUser,
  AuthRoles,
  CustomWalletTagPayload,
  CustomWalletLabelItem,
  BridgeHopItem,
  CaseBridgesResponse,
  PrivacySwapperItem,
  CasePrivacyResponse,
  IntermediaryMule,
  LayeringAnalysisPath,
  LayeringAnalysisResponse,
  EvidenceCertResponse,
  AIReportResponse,
} from "./types";

export const API_BASE_URL = (() => {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL || "https://chainsleuth-backend-81pg.onrender.com/api/v1"
  ).replace(/\/+$/, "");
  return raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`;
})();

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

// 12-Node Realistic TRON Crypto-Fraud Investigation Mock Graph
const MOCK_NODES: WalletNode[] = [
  {
    address: "TABC1234567890XYZ99887766554433",
    chain: "tron",
    riskScore: 94,
    balance: 0.0,
    firstSeen: "2026-09-20T09:00:00Z",
    typologyFlags: ["zero_gas_burner"],
    gnn_risk_score: 95,
    typology_score: 90,
    anomaly_score: 0.88,
    heuristics_score: 85,
    risk_category: "CRITICAL",
    explanation: "High-risk nexus wallet flagged for zero-gas burner laundering on TRON with calibrated risk 94/100.",
    pmla_flag: true,
  },
  {
    address: "TFUNDER00000000000000000000001",
    chain: "tron",
    riskScore: 91,
    balance: 1540.0,
    firstSeen: "2026-09-18T14:20:00Z",
    typologyFlags: ["first_funder_match"],
    gnn_risk_score: 92,
    typology_score: 88,
    anomaly_score: 0.82,
    heuristics_score: 80,
    risk_category: "CRITICAL",
    explanation: "Gas-funding nexus wallet financing suspected money mule addresses.",
    pmla_flag: false,
  },
  {
    address: "TBURNER00100100100100100100101",
    chain: "tron",
    riskScore: 88,
    balance: 0.0,
    firstSeen: "2026-09-19T11:10:00Z",
    typologyFlags: ["zero_gas_burner"],
    gnn_risk_score: 89,
    typology_score: 85,
    anomaly_score: 0.78,
    heuristics_score: 75,
    risk_category: "CRITICAL",
    explanation: "Burner wallet with zero native gas balance after high-velocity transfers.",
    pmla_flag: false,
  },
  {
    address: "TPEEL00100100100100100100100101",
    chain: "tron",
    riskScore: 85,
    balance: 12.0,
    firstSeen: "2026-09-20T09:15:00Z",
    typologyFlags: ["peeling_chain"],
    gnn_risk_score: 86,
    typology_score: 88,
    anomaly_score: 0.75,
    heuristics_score: 70,
    risk_category: "CRITICAL",
    explanation: "Intermediate layering node engaged in peeling-chain structuring.",
    pmla_flag: true,
  },
  {
    address: "TPEEL00200200200200200200200202",
    chain: "tron",
    riskScore: 83,
    balance: 8.5,
    firstSeen: "2026-09-20T09:22:00Z",
    typologyFlags: ["peeling_chain"],
    gnn_risk_score: 84,
    typology_score: 85,
    anomaly_score: 0.72,
    heuristics_score: 70,
    risk_category: "CRITICAL",
    explanation: "Peeling-chain hop splitting funds into sub-threshold amounts.",
    pmla_flag: true,
  },
  {
    address: "TPEEL00300300300300300300300303",
    chain: "tron",
    riskScore: 86,
    balance: 5.0,
    firstSeen: "2026-09-20T09:30:00Z",
    typologyFlags: ["peeling_chain"],
    gnn_risk_score: 87,
    typology_score: 88,
    anomaly_score: 0.76,
    heuristics_score: 70,
    risk_category: "CRITICAL",
    explanation: "Peeling-chain conduit routing structured transfers toward exchange deposit.",
    pmla_flag: true,
  },
  {
    address: "TFANOUT00100100100100100100101",
    chain: "tron",
    riskScore: 79,
    balance: 45.0,
    firstSeen: "2026-09-20T09:40:00Z",
    typologyFlags: ["fan_out"],
    gnn_risk_score: 80,
    typology_score: 82,
    anomaly_score: 0.69,
    heuristics_score: 65,
    risk_category: "CRITICAL",
    explanation: "Smurfing / fan-out node dispersing assets across multiple beneficiary wallets.",
    pmla_flag: true,
  },
  {
    address: "TSMURF010010010010010010010011",
    chain: "tron",
    riskScore: 72,
    balance: 2.0,
    firstSeen: "2026-09-20T09:45:00Z",
    typologyFlags: [],
    gnn_risk_score: 73,
    typology_score: 60,
    anomaly_score: 0.61,
    heuristics_score: 55,
    risk_category: "HIGH",
    explanation: "Downstream mule account receiving dispersed smurfed funds.",
    pmla_flag: false,
  },
  {
    address: "TSMURF020020020020020020020022",
    chain: "tron",
    riskScore: 70,
    balance: 1.5,
    firstSeen: "2026-09-20T09:46:00Z",
    typologyFlags: [],
    gnn_risk_score: 71,
    typology_score: 58,
    anomaly_score: 0.59,
    heuristics_score: 55,
    risk_category: "HIGH",
    explanation: "Downstream mule account receiving dispersed smurfed funds.",
    pmla_flag: false,
  },
  {
    address: "TDEXSWAP001001001001001001001",
    chain: "tron",
    riskScore: 45,
    balance: 8900.0,
    firstSeen: "2026-08-01T00:00:00Z",
    typologyFlags: ["dex_swap"],
    gnn_risk_score: 42,
    typology_score: 40,
    anomaly_score: 0.35,
    heuristics_score: 40,
    risk_category: "MEDIUM",
    explanation: "Decentralized automated market maker liquidity pool contract.",
    pmla_flag: false,
  },
  {
    address: "TCOINDCXDEPOSIT9988776655443311",
    chain: "tron",
    riskScore: 96,
    balance: 0.0,
    firstSeen: "2026-09-20T10:05:00Z",
    typologyFlags: [],
    isVasp: true,
    gnn_risk_score: 96,
    typology_score: 92,
    anomaly_score: 0.91,
    heuristics_score: 90,
    risk_category: "CRITICAL",
    explanation: "Final beneficiary deposit address at CoinDCX registered exchange.",
    pmla_flag: true,
  },
  {
    address: "TCOINDCXHOTSWEEP0000000000000000",
    chain: "tron",
    riskScore: 10,
    balance: 450000.0,
    firstSeen: "2024-01-01T00:00:00Z",
    typologyFlags: [],
    isVasp: true,
    gnn_risk_score: 12,
    typology_score: 0,
    anomaly_score: 0.05,
    heuristics_score: 30,
    risk_category: "LOW",
    explanation: "CoinDCX exchange hot wallet infrastructure address.",
    pmla_flag: false,
  },
];

const MOCK_EDGES: TransferEdge[] = [
  {
    txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    from: "TFUNDER00000000000000000000001",
    to: "TABC1234567890XYZ99887766554433",
    value: 15.0,
    token: "TRX",
    timestamp: "2026-09-20T08:55:00Z",
  },
  {
    txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    from: "TFUNDER00000000000000000000001",
    to: "TBURNER00100100100100100100101",
    value: 15.0,
    token: "TRX",
    timestamp: "2026-09-19T11:05:00Z",
  },
  {
    txHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    from: "TBURNER00100100100100100100101",
    to: "TABC1234567890XYZ99887766554433",
    value: 50000.0,
    token: "USDT",
    timestamp: "2026-09-20T09:02:00Z",
  },
  {
    txHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
    from: "TABC1234567890XYZ99887766554433",
    to: "TPEEL00100100100100100100100101",
    value: 48500.0,
    token: "USDT",
    timestamp: "2026-09-20T09:14:00Z",
  },
  {
    txHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
    from: "TABC1234567890XYZ99887766554433",
    to: "TFANOUT00100100100100100100101",
    value: 15000.0,
    token: "USDT",
    timestamp: "2026-09-20T09:38:00Z",
  },
  {
    txHash: "0x6666666666666666666666666666666666666666666666666666666666666666",
    from: "TFANOUT00100100100100100100101",
    to: "TSMURF010010010010010010010011",
    value: 5000.0,
    token: "USDT",
    timestamp: "2026-09-20T09:44:00Z",
  },
  {
    txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
    from: "TFANOUT00100100100100100100101",
    to: "TSMURF020020020020020020020022",
    value: 5000.0,
    token: "USDT",
    timestamp: "2026-09-20T09:45:00Z",
  },
  {
    txHash: "0x8888888888888888888888888888888888888888888888888888888888888888",
    from: "TPEEL00100100100100100100100101",
    to: "TPEEL00200200200200200200200202",
    value: 42600.0,
    token: "USDT",
    timestamp: "2026-09-20T09:21:00Z",
  },
  {
    txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
    from: "TPEEL00200200200200200200200202",
    to: "TDEXSWAP001001001001001001001",
    value: 3500.0,
    token: "USDT",
    timestamp: "2026-09-20T09:26:00Z",
  },
  {
    txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    from: "TPEEL00200200200200200200200202",
    to: "TPEEL00300300300300300300300303",
    value: 39100.0,
    token: "USDT",
    timestamp: "2026-09-20T09:29:00Z",
  },
  {
    txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    from: "TPEEL00300300300300300300300303",
    to: "TCOINDCXDEPOSIT9988776655443311",
    value: 36000.0,
    token: "USDT",
    timestamp: "2026-09-20T10:04:00Z",
  },
  {
    txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    from: "TCOINDCXDEPOSIT9988776655443311",
    to: "TCOINDCXHOTSWEEP0000000000000000",
    value: 36000.0,
    token: "USDT",
    timestamp: "2026-09-20T10:12:00Z",
  },
];

const MOCK_ATTRIBUTION: VASPAttribution = {
  vasp_name: "CoinDCX (Neblio Technologies Pvt Ltd)",
  is_fiu_registered: true,
  confidence_score: 97.8,
  deposit_address: "TCOINDCXDEPOSIT9988776655443311",
  hot_wallet_address: "TCOINDCXHOTSWEEP0000000000000000",
  nodal_officer_email: "nodal.compliance@coindcx.com",
  nodal_officer_phone: "+91-22-6900-1122",
};

export const MOCK_TRACE_RESULT: TraceResult = {
  case_id: "CS-2026-8891",
  suspect_address: "TABC1234567890XYZ99887766554433",
  nodes: MOCK_NODES,
  edges: MOCK_EDGES,
  attribution: MOCK_ATTRIBUTION,
  overall_risk_score: 94,
  chain: "tron",
  created_at: "2026-09-20T10:30:00Z",
  status: "active",
};

export const MOCK_CASES: CaseSummary[] = [
  {
    case_id: "CS-2026-8891",
    suspect_address: "TABC1234567890XYZ99887766554433",
    chain: "tron",
    overall_risk_score: 94,
    status: "active",
    created_at: "2026-09-20T10:30:00Z",
    attributed_vasp_name: "CoinDCX",
  },
  {
    case_id: "CS-2026-8892",
    suspect_address: "TX998877665544332211AABBCCDDEEFF",
    chain: "tron",
    overall_risk_score: 88,
    status: "pending_approval",
    created_at: "2026-09-20T08:15:00Z",
    attributed_vasp_name: "WazirX",
  },
  {
    case_id: "CS-2026-8893",
    suspect_address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkkkkkk",
    chain: "solana",
    overall_risk_score: 82,
    status: "pending_approval",
    created_at: "2026-09-19T14:45:00Z",
    attributed_vasp_name: "Binance",
  },
  {
    case_id: "CS-2026-8894",
    suspect_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    chain: "ethereum",
    overall_risk_score: 79,
    status: "frozen",
    created_at: "2026-09-18T16:20:00Z",
    attributed_vasp_name: "CoinDCX",
  },
  {
    case_id: "CS-2026-8895",
    suspect_address: "TL889900112233445566778899AABBCC",
    chain: "tron",
    overall_risk_score: 65,
    status: "active",
    created_at: "2026-09-17T11:10:00Z",
    attributed_vasp_name: undefined,
  },
  {
    case_id: "CS-2026-8896",
    suspect_address: "9xZzL771239840192841029834019284",
    chain: "solana",
    overall_risk_score: 42,
    status: "closed",
    created_at: "2026-09-15T09:00:00Z",
    attributed_vasp_name: undefined,
  },
];

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const storeToken = useAppStore.getState().token;
  if (storeToken) return storeToken;
  return localStorage.getItem("token") || localStorage.getItem("auth_token") || null;
}

export function getAuthHeaders(customToken?: string, contentType = "application/json"): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const token = customToken || getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchAuthMe(token?: string): Promise<AuthUser> {
  if (!token) {
    return {
      email: "officer@chainsleuth.gov.in",
      name: "Investigating Officer",
      role: "investigating_officer",
    };
  }
  try {
    const headers = getAuthHeaders(token, "");
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      return {
        email: "officer@chainsleuth.gov.in",
        name: "Investigating Officer",
        role: "investigating_officer",
      };
    }
    return await res.json();
  } catch {
    return {
      email: "officer@chainsleuth.gov.in",
      name: "Investigating Officer",
      role: "investigating_officer",
    };
  }
}

export async function fetchAuthRoles(token?: string): Promise<AuthRoles> {
  if (!token) {
    return {
      roles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
      permissions: [],
      active_role: "investigating_officer",
    };
  }
  try {
    const headers = getAuthHeaders(token, "");
    const res = await fetch(`${API_BASE_URL}/auth/roles`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      return {
        roles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
        permissions: [],
        active_role: "investigating_officer",
      };
    }
    const data = await res.json();
    return {
      roles: Array.isArray(data.roles) ? data.roles : ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      active_role: data.active_role || "investigating_officer",
    };
  } catch {
    return {
      roles: ["investigating_officer", "supervisory_officer", "vasp_nodal_officer"],
      permissions: [],
      active_role: "investigating_officer",
    };
  }
}

export async function createTrace(req: TraceRequest): Promise<TraceResult> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      ...MOCK_TRACE_RESULT,
      suspect_address: req.suspect_address || MOCK_TRACE_RESULT.suspect_address,
      chain: req.chain || MOCK_TRACE_RESULT.chain,
    });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/trace/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Backend API Error (${res.status}): ${errorText || res.statusText}`);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === "TypeError" || err.message === "Failed to fetch")) {
      throw new Error(
        `Unable to reach forensic trace backend service (${API_BASE_URL}). The Render backend may be starting up or experiencing network connectivity issues. Please try again.`
      );
    }
    throw err;
  }
}

export async function getCase(caseId: string): Promise<TraceResult> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      ...MOCK_TRACE_RESULT,
      case_id: caseId,
    });
  }

  // Try primary route: /cases/{caseId}
  let res = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
    headers: getAuthHeaders("", ""),
  });

  // If 404, try secondary route: /trace/{caseId}
  if (!res.ok && res.status === 404) {
    const secondaryRes = await fetch(`${API_BASE_URL}/trace/${caseId}`, {
      headers: getAuthHeaders("", ""),
    });
    if (secondaryRes.ok) {
      res = secondaryRes;
    }
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to fetch case ${caseId} (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    ...data,
    chain: normalizeChain(data.chain || data.blockchain_type),
    nodes: data.nodes || [],
    edges: data.edges || [],
    attribution: data.attribution || null,
  };
}

export function normalizeChain(rawChain?: string): Chain {
  if (!rawChain) return "tron";
  const lower = rawChain.toLowerCase();
  if (lower.includes("btc") || lower.includes("bitcoin")) return "bitcoin";
  if (lower.includes("eth") || lower.includes("ethereum")) return "ethereum";
  if (lower.includes("sol") || lower.includes("solana")) return "solana";
  if (lower.includes("tron") || lower.includes("trx")) return "tron";
  return (lower as Chain) || "tron";
}

export async function getCases(): Promise<CaseSummary[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(MOCK_CASES);
  }

  const res = await fetch(`${API_BASE_URL}/cases/`, {
    headers: getAuthHeaders("", ""),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to fetch cases (${res.status}): ${errorText}`);
  }

  const rawList: Record<string, unknown>[] = await res.json();
  return rawList.map((item) => ({
    ...(item as unknown as CaseSummary),
    chain: normalizeChain((item.chain || item.blockchain_type) as string | undefined),
    attributed_vasp_name: (item.attributed_vasp_name || item.attributed_vasp) as string | undefined,
  }));
}

export async function parseFir(complaintText: string): Promise<Partial<TraceRequest>> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      suspect_address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",
      chain: "tron",
      max_hops: 5,
      value_threshold_pct: 2.0,
      complaint_id: "FIR-2026-DELHI-402",
    });
  }

  const res = await fetch(`${API_BASE_URL}/fir/parse`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ complaintText, complaint_text: complaintText }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to parse FIR complaint text (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    suspect_address: data.suspect_wallet_address || data.suspect_address || "",
    chain: normalizeChain(data.blockchain_type || data.chain),
    max_hops: data.max_trace_hops || data.max_hops || 5,
    value_threshold_pct: 2.0,
    complaint_id: data.complaint_id,
  };
}

export async function generateNotice(
  payload: LegalNoticePayload
): Promise<{ pdfUrl: string; sha256_evidence_hash: string }> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      pdfUrl: "#mock-pdf-url",
      sha256_evidence_hash: payload.sha256_evidence_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  }

  const res = await fetch(`${API_BASE_URL}/notices/generate`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to generate legal freeze notice (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  const pdfUrl = data.pdf_url?.startsWith("http")
    ? data.pdf_url
    : `${origin}${data.pdf_url}`;

  return {
    pdfUrl,
    sha256_evidence_hash: data.sha256_evidence_hash || "",
  };
}

export async function downloadCourtEvidenceBundle(caseId: string): Promise<void> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/export-bundle`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] downloadCourtEvidenceBundle network failure:", err);
    throw new Error("Connection error: Unable to reach backend server.");
  }

  if (res.status === 401) {
    throw new Error("Authentication error (401): Please log in again.");
  }
  if (res.status === 403) {
    throw new Error("Permission error (403): You do not have authorization to export evidence bundles.");
  }
  if (res.status === 404) {
    throw new Error("Case/evidence unavailable (404): Evidence bundle not found for this case.");
  }
  if (res.status >= 500) {
    throw new Error("Backend generation failure (500): Server error while building evidence package.");
  }
  if (!res.ok) {
    throw new Error(`Export failed with status ${res.status}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Case_${caseId}_Court_Evidence_Bundle.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function getCaseClusters(caseId: string): Promise<CaseClustersResponse> {
  try {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const res = await fetch(`${API_BASE_URL}/cases/${encodeURIComponent(caseId)}/clusters`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch forensic clusters (${res.status})`);
    }

    const data = await res.json();
    const clustersList: WalletCluster[] = Array.isArray(data.clusters)
      ? data.clusters
      : Array.isArray(data)
      ? data
      : [];

    return {
      case_id: data.case_id || caseId,
      cluster_count: data.cluster_count ?? clustersList.length,
      clusters: clustersList,
    };
  } catch (err) {
    console.error("[API] getCaseClusters backend call failed:", err);
    throw new Error("Unable to retrieve forensic clusters.");
  }
}

export async function createFir(payload: FIRCreate): Promise<FIRResponse> {
  let res: Response;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    res = await fetch(`${API_BASE_URL}/fir/`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[API] createFir network failure:", err);
    throw new Error("Connection error: Unable to reach backend server.");
  }

  if (res.status === 401) {
    throw new Error("Authentication error (401): Please log in to generate an FIR.");
  }
  if (res.status === 403) {
    throw new Error("Permission error (403): You do not have authorization to generate an FIR.");
  }
  if (res.status === 422) {
    const errorBody = await res.json().catch(() => null);
    const detailMsg = errorBody?.detail
      ? Array.isArray(errorBody.detail)
        ? errorBody.detail.map((d: { msg?: string }) => d.msg || "").join(", ")
        : errorBody.detail
      : "";
    throw new Error(`Validation error (422): ${detailMsg || "Please check your input fields."}`);
  }
  if (res.status >= 500) {
    throw new Error("Backend generation failure (500): Failed to generate FIR document on server.");
  }
  if (!res.ok) {
    throw new Error(`FIR generation failed with status ${res.status}`);
  }

  const data: FIRResponse = await res.json();
  return data;
}

export async function downloadFir(firId: string, pdfUrl?: string): Promise<void> {
  const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  const targetUrl = pdfUrl
    ? pdfUrl.startsWith("http")
      ? pdfUrl
      : `${origin}${pdfUrl}`
    : `${API_BASE_URL}/fir/${encodeURIComponent(firId)}/download`;

  if (typeof window !== "undefined") {
    window.open(targetUrl, "_blank");
  }
}

export async function ingestNcrpComplaints(
  payload: NCRPBatchIngestRequest | NCRPComplaintRecord[]
): Promise<NCRPBatchIngestResponse> {
  let res: Response;
  const bodyPayload = Array.isArray(payload) ? { complaints: payload } : payload;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    res = await fetch(`${API_BASE_URL}/ncrp/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });
  } catch (err) {
    console.error("[API] ingestNcrpComplaints network failure:", err);
    throw new Error("Connection error: Unable to reach backend server.");
  }

  if (res.status === 401) {
    throw new Error("Authentication error (401): Please log in to ingest NCRP/SAHYOG complaints.");
  }
  if (res.status === 403) {
    throw new Error("Permission error (403): You do not have permission to ingest NCRP/SAHYOG complaints.");
  }
  if (res.status === 422) {
    const errorBody = await res.json().catch(() => null);
    const detailMsg = errorBody?.detail
      ? Array.isArray(errorBody.detail)
        ? errorBody.detail.map((d: { msg?: string }) => d.msg || "").join(", ")
        : errorBody.detail
      : "";
    throw new Error(`Validation error (422): ${detailMsg || "Please check submitted complaint parameters."}`);
  }
  if (res.status >= 500) {
    throw new Error("Backend processing failure (500): Server error during NCRP complaint ingestion.");
  }
  if (!res.ok) {
    throw new Error(`NCRP Ingestion failed with status ${res.status}`);
  }

  const data: NCRPBatchIngestResponse = await res.json();
  return data;
}

export async function runNcrpBatchTrace(complaintIds: string[]): Promise<TraceResult[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}/ncrp/batch-trace`, {
    method: "POST",
    headers,
    body: JSON.stringify(complaintIds),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Batch trace failed with status ${res.status}: ${errorText || res.statusText}`);
  }

  const data: TraceResult[] = await res.json();
  return data;
}

export async function getNcrpCorrelations(): Promise<NcrpCorrelationsResponse> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    res = await fetch(`${API_BASE_URL}/ncrp/correlations`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getNcrpCorrelations network failure:", err);
    throw new Error("Unable to retrieve NCRP correlation intelligence.");
  }

  if (res.status === 401) {
    throw new Error("Unable to retrieve NCRP correlation intelligence: Authentication required.");
  }
  if (res.status === 403) {
    throw new Error("Unable to retrieve NCRP correlation intelligence: Access denied.");
  }
  if (!res.ok) {
    throw new Error("Unable to retrieve NCRP correlation intelligence.");
  }

  const data = await res.json();
  const list: SyndicateCorrelationItem[] = Array.isArray(data.correlations)
    ? data.correlations
    : Array.isArray(data)
    ? data
    : [];

  return {
    total_correlations: data.total_correlations ?? list.length,
    correlations: list,
  };
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("auth_token") ||
        localStorage.getItem("access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    res = await fetch(`${API_BASE_URL}/audit/logs`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getAuditLogs network failure:", err);
    throw new Error("Unable to retrieve supervisory audit logs.");
  }

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch supervisory audit logs (${res.status})`);
  }

  const data = await res.json();
  const logsList: AuditLogItem[] = Array.isArray(data.logs)
    ? data.logs
    : Array.isArray(data)
    ? data
    : [];

  return logsList;
}

export async function getVaspRegistry(): Promise<CustomWalletLabelItem[]> {
  let res: Response;
  try {
    const headers = getAuthHeaders(undefined, "");
    res = await fetch(`${API_BASE_URL}/vasp/labels`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getVaspRegistry network failure:", err);
    throw new Error("Unable to load VASP labels database.");
  }

  if (!res.ok) {
    throw new Error(`Unable to load VASP labels database (${res.status}).`);
  }

  const data = await res.json();
  const list = Array.isArray(data.labels)
    ? data.labels
    : Array.isArray(data.registry)
    ? data.registry
    : Array.isArray(data)
    ? data
    : [];
  return list;
}

export async function getCustomLabels(query?: string): Promise<CustomWalletLabelItem[]> {
  let res: Response;
  try {
    const headers = getAuthHeaders(undefined, "");
    const url = query
      ? `${API_BASE_URL}/vasp/labels?query=${encodeURIComponent(query)}`
      : `${API_BASE_URL}/vasp/labels`;

    res = await fetch(url, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getCustomLabels network failure:", err);
    throw new Error("Unable to load custom wallet labels.");
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch custom wallet labels (${res.status})`);
  }

  const data = await res.json();
  const labelsList: CustomWalletLabelItem[] = Array.isArray(data.labels)
    ? data.labels
    : Array.isArray(data)
    ? data
    : [];

  return labelsList;
}

export async function tagCustomWallet(payload: CustomWalletTagPayload): Promise<{ success: boolean; message?: string }> {
  let res: Response;
  try {
    const headers = getAuthHeaders(undefined, "application/json");
    res = await fetch(`${API_BASE_URL}/vasp/labels`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[API] tagCustomWallet network failure:", err);
    throw new Error("Unable to save wallet tag.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Unable to save wallet tag (${res.status}): ${errorText}`);
  }

  return await res.json().catch(() => ({ success: true }));
}

export async function getWalletTags(address: string): Promise<CustomWalletLabelItem[]> {
  if (!address) return [];

  // 1. Primary: Look up investigator annotations created via the internal database
  try {
    const customList = await getCustomLabels(address);
    if (Array.isArray(customList) && customList.length > 0) {
      return customList;
    }
  } catch (err) {
    console.warn("[API] getCustomLabels lookup failed:", err);
  }

  // 2. Secondary: Check VASP / Threat Intel tags endpoint for agency DB attributions
  try {
    const headers = getAuthHeaders(undefined, "");
    const res = await fetch(`${API_BASE_URL}/vasp/tags/${encodeURIComponent(address)}`, {
      method: "GET",
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      // If agency DB or threat intel identified a real entity (not a generic unattributed wallet)
      if (
        data &&
        typeof data === "object" &&
        data.source !== "unattributed" &&
        data.category !== "unattributed" &&
        (data.entity_name || data.vasp_name)
      ) {
        return [
          {
            id: data.id || data.address || address,
            address: data.address || address,
            entity_name: data.entity_name || data.vasp_name,
            entity_type: data.entity_type || data.category || "vasp",
            chain: data.chain,
            confidence: data.confidence,
            source: data.source,
            case_reference: data.case_reference,
            notes: data.notes,
            tags: Array.isArray(data.tags) ? data.tags : [],
          },
        ];
      }
    }
  } catch {
    // Fallback: no annotations found
  }

  return [];
}

export const runTrace = createTrace;
export const fetchCase = getCase;
export const fetchCases = getCases;

export async function getCaseBridges(caseId: string): Promise<CaseBridgesResponse> {
  let res: Response;
  const encodedId = encodeURIComponent(caseId);
  try {
    const headers = getAuthHeaders(undefined, "");
    res = await fetch(`${API_BASE_URL}/cases/${encodedId}/bridge-hops`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getCaseBridges network failure:", err);
    throw new Error("Unable to reach server to load bridge analysis.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load bridge analysis (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const rawHops: Record<string, unknown>[] = Array.isArray(data.bridge_hops)
    ? data.bridge_hops
    : Array.isArray(data.hops)
    ? data.hops
    : Array.isArray(data)
    ? data
    : [];

  const bridge_hops: BridgeHopItem[] = rawHops.map((item) => ({
    bridge_protocol: (item.bridge_protocol as string) || (item.bridge_name as string) || (item.protocol as string) || "Unknown Protocol",
    source_chain: (item.source_chain as string) || (item.src_chain as string) || "tron",
    destination_chain: (item.destination_chain as string) || (item.dest_chain as string) || "ethereum",
    source_tx_hash: (item.source_tx_hash as string) || (item.tx_hash as string) || "",
    amount_usd: typeof item.amount_usd === "number" ? item.amount_usd : typeof item.value === "number" ? item.value : undefined,
    token: item.token as string | undefined,
    destination_wallet: (item.destination_wallet as string) || (item.dest_wallet as string) || (item.recipient_address as string) || undefined,
    destination_tx_hash: (item.destination_tx_hash as string) || (item.dest_tx_hash as string) || undefined,
  }));

  return {
    case_id: (data.case_id as string) || caseId,
    total_bridges_detected: typeof data.total_bridges_detected === "number"
      ? data.total_bridges_detected
      : typeof data.bridge_hop_count === "number"
      ? data.bridge_hop_count
      : bridge_hops.length,
    bridge_hops,
  };
}

export async function getCasePrivacy(caseId: string): Promise<CasePrivacyResponse> {
  let res: Response;
  const encodedId = encodeURIComponent(caseId);
  try {
    const headers = getAuthHeaders(undefined, "");
    res = await fetch(`${API_BASE_URL}/cases/${encodedId}/privacy-dossier`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getCasePrivacy network failure:", err);
    throw new Error("Unable to reach server to load privacy analysis.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load privacy analysis (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const rawSwappers: Record<string, unknown>[] = Array.isArray(data.privacy_swappers_detected)
    ? data.privacy_swappers_detected
    : Array.isArray(data.detected_swapper_hops)
    ? data.detected_swapper_hops
    : Array.isArray(data.swappers)
    ? data.swappers
    : Array.isArray(data)
    ? data
    : [];

  const privacy_swappers_detected: PrivacySwapperItem[] = rawSwappers.map((item) => ({
    service_name: (item.service_name as string) || (item.swapper_name as string) || (item.service as string) || "Instant Swapper",
    swapper_type: item.swapper_type as string | undefined,
    input_currency: (item.input_currency as string) || (item.input_asset as string) || "N/A",
    output_currency: (item.output_currency as string) || (item.output_asset as string) || "N/A",
    intercept_address: (item.intercept_address as string) || (item.deposit_address as string) || (item.address as string) || "",
    subpoena_questionnaire_ready: typeof item.subpoena_questionnaire_ready === "boolean"
      ? item.subpoena_questionnaire_ready
      : Array.isArray(data.investigative_playbook) && data.investigative_playbook.length > 0
      ? true
      : undefined,
  }));

  return {
    case_id: (data.case_id as string) || caseId,
    privacy_swappers_detected,
  };
}

export async function getCaseLayering(caseId: string): Promise<LayeringAnalysisResponse> {
  let res: Response;
  const encodedId = encodeURIComponent(caseId);
  try {
    const headers = getAuthHeaders(undefined, "");
    res = await fetch(`${API_BASE_URL}/cases/${encodedId}/layering-analysis`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getCaseLayering network failure:", err);
    throw new Error("Unable to reach server to load layering analysis.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load layering analysis (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const rawMules: Record<string, unknown>[] = Array.isArray(data.classified_intermediaries)
    ? data.classified_intermediaries
    : Array.isArray(data.intermediary_mules)
    ? data.intermediary_mules
    : Array.isArray(data.intermediaries)
    ? data.intermediaries
    : Array.isArray(data.mules)
    ? data.mules
    : [];

  const classified_intermediaries: IntermediaryMule[] = rawMules.map((item) => ({
    address: (item.address as string) || (item.wallet as string) || (item.node as string) || "",
    role: (item.role as string) || (item.classification as string) || "Intermediary Hop",
    holding_time_minutes: typeof item.holding_time_minutes === "number"
      ? item.holding_time_minutes
      : typeof item.holding_time === "number"
      ? item.holding_time
      : undefined,
  }));

  const paths: LayeringAnalysisPath[] = Array.isArray(data.paths) ? data.paths : [];

  return {
    case_id: (data.case_id as string) || caseId,
    suspect_address: data.suspect_address as string | undefined,
    total_paths_discovered: typeof data.total_paths_discovered === "number" ? data.total_paths_discovered : undefined,
    min_hop_count: typeof data.min_hop_count === "number" ? data.min_hop_count : undefined,
    max_hop_count: typeof data.max_hop_count === "number" ? data.max_hop_count : undefined,
    paths,
    classified_intermediaries,
    summary: data.summary as string | undefined,
    generated_at: data.generated_at as string | undefined,
    peeling_chain_count: typeof data.peeling_chain_count === "number" ? data.peeling_chain_count : null,
    fan_out_count: typeof data.fan_out_count === "number" ? data.fan_out_count : null,
    rapid_movement_detected: typeof data.rapid_movement_detected === "boolean" ? data.rapid_movement_detected : null,
    max_layering_depth: typeof data.max_hop_count === "number"
      ? data.max_hop_count
      : typeof data.max_layering_depth === "number"
      ? data.max_layering_depth
      : undefined,
    intermediary_mules: classified_intermediaries,
  };
}

export async function getCaseEvidenceCert(caseId: string): Promise<EvidenceCertResponse> {
  let res: Response;
  const encodedId = encodeURIComponent(caseId);
  try {
    const headers = getAuthHeaders(undefined, "");
    res = await fetch(`${API_BASE_URL}/cases/${encodedId}/evidence-cert`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    console.error("[API] getCaseEvidenceCert network failure:", err);
    throw new Error("Connection error: Unable to reach backend server.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to load evidence certificate (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return {
    certificate_type: (data.certificate_type || data.cert_type) as string | undefined,
    former_equivalent: data.former_equivalent as string | undefined,
    case_id: (data.case_id || data.caseId) as string | undefined,
    evidence_sha256_hash: (data.evidence_sha256_hash || data.sha256_hash || data.hash) as string | undefined,
    total_nodes_analyzed:
      typeof data.total_nodes_analyzed === "number"
        ? data.total_nodes_analyzed
        : typeof data.nodes_count === "number"
        ? data.nodes_count
        : undefined,
    total_transactions_traced:
      typeof data.total_transactions_traced === "number"
        ? data.total_transactions_traced
        : typeof data.transactions_count === "number"
        ? data.transactions_count
        : undefined,
    attributed_vasp:
      data.attributed_vasp !== undefined && data.attributed_vasp !== null && String(data.attributed_vasp).trim() !== ""
        ? String(data.attributed_vasp)
        : null,
  };
}

export async function generateForensicReport(caseInput: string | TraceResult): Promise<AIReportResponse> {
  let traceData: TraceResult;

  if (typeof caseInput === "string") {
    traceData = await getCase(caseInput);
  } else {
    traceData = caseInput;
  }

  let res: Response;
  try {
    const headers = getAuthHeaders(undefined, "application/json");
    res = await fetch(`${API_BASE_URL}/report/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(traceData),
    });
  } catch (err) {
    console.error("[API] generateForensicReport network failure:", err);
    throw new Error("Connection error: Unable to reach backend server.");
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Failed to generate investigation docket (${res.status}): ${errorText || res.statusText}`);
  }

  const data = await res.json();
  return {
    case_id: (data.case_id || data.caseId) as string | undefined,
    suspect_address: (data.suspect_address || data.suspectAddress) as string | undefined,
    chain: data.chain as string | undefined,
    overall_risk_score: typeof data.overall_risk_score === "number" ? data.overall_risk_score : undefined,
    report: data.report as string | undefined,
  };
}








