import {
  CaseSummary,
  Chain,
  LegalNoticePayload,
  TraceRequest,
  TraceResult,
  VASPAttribution,
  WalletNode,
  TransferEdge,
} from "./types";
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
  },
  {
    address: "TFUNDER00000000000000000000001",
    chain: "tron",
    riskScore: 91,
    balance: 1540.0,
    firstSeen: "2026-09-18T14:20:00Z",
    typologyFlags: ["first_funder_match"],
  },
  {
    address: "TBURNER00100100100100100100101",
    chain: "tron",
    riskScore: 88,
    balance: 0.0,
    firstSeen: "2026-09-19T11:10:00Z",
    typologyFlags: ["zero_gas_burner"],
  },
  {
    address: "TPEEL00100100100100100100100101",
    chain: "tron",
    riskScore: 85,
    balance: 12.0,
    firstSeen: "2026-09-20T09:15:00Z",
    typologyFlags: ["peeling_chain"],
  },
  {
    address: "TPEEL00200200200200200200200202",
    chain: "tron",
    riskScore: 83,
    balance: 8.5,
    firstSeen: "2026-09-20T09:22:00Z",
    typologyFlags: ["peeling_chain"],
  },
  {
    address: "TPEEL00300300300300300300300303",
    chain: "tron",
    riskScore: 86,
    balance: 5.0,
    firstSeen: "2026-09-20T09:30:00Z",
    typologyFlags: ["peeling_chain"],
  },
  {
    address: "TFANOUT00100100100100100100101",
    chain: "tron",
    riskScore: 79,
    balance: 45.0,
    firstSeen: "2026-09-20T09:40:00Z",
    typologyFlags: ["fan_out"],
  },
  {
    address: "TSMURF010010010010010010010011",
    chain: "tron",
    riskScore: 72,
    balance: 2.0,
    firstSeen: "2026-09-20T09:45:00Z",
    typologyFlags: [],
  },
  {
    address: "TSMURF020020020020020020020022",
    chain: "tron",
    riskScore: 70,
    balance: 1.5,
    firstSeen: "2026-09-20T09:46:00Z",
    typologyFlags: [],
  },
  {
    address: "TDEXSWAP001001001001001001001",
    chain: "tron",
    riskScore: 45,
    balance: 8900.0,
    firstSeen: "2026-08-01T00:00:00Z",
    typologyFlags: ["dex_swap"],
  },
  {
    address: "TCOINDCXDEPOSIT9988776655443311",
    chain: "tron",
    riskScore: 96,
    balance: 0.0,
    firstSeen: "2026-09-20T10:05:00Z",
    typologyFlags: [],
    isVasp: true,
  },
  {
    address: "TCOINDCXHOTSWEEP0000000000000000",
    chain: "tron",
    riskScore: 10,
    balance: 450000.0,
    firstSeen: "2024-01-01T00:00:00Z",
    typologyFlags: [],
    isVasp: true,
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

import {
  ParsedComplaintResponse,
  NoticeGenerateResponse,
} from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://chain-sleuth-backend.onrender.com/api/v1").replace(/\/+$/, "");

export async function createTrace(req: TraceRequest): Promise<TraceResult> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      ...MOCK_TRACE_RESULT,
      suspect_address: req.suspect_address || MOCK_TRACE_RESULT.suspect_address,
      chain: req.chain || MOCK_TRACE_RESULT.chain,
    });
  }

  const res = await fetch(`${API_BASE}/trace/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      suspect_address: req.suspect_address,
      chain: req.chain,
      max_hops: req.max_hops ?? 5,
      value_threshold_pct: req.value_threshold_pct ?? 2.0,
      complaint_id: req.complaint_id || null,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Trace API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function getCase(caseId: string): Promise<TraceResult> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      ...MOCK_TRACE_RESULT,
      case_id: caseId,
    });
  }

  const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}`);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Get Case API error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function getCases(skip: number = 0, limit: number = 20): Promise<CaseSummary[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(MOCK_CASES);
  }

  const res = await fetch(`${API_BASE}/cases/?skip=${skip}&limit=${limit}`);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Get Cases API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).cases)) {
    return (data as Record<string, unknown>).cases as CaseSummary[];
  }
  return [];
}

export async function parseFir(complaintText: string): Promise<ParsedComplaintResponse> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      suspect_wallet_address: "TABC1234567890XYZ99887766554433",
      blockchain_type: "tron",
      max_trace_hops: 5,
      estimated_loss_inr: 485000,
      summary: "Victim complaint describing Telegram part-time job crypto scam",
      confidence: "high",
      raw_model_output: null,
      suspect_address: "TABC1234567890XYZ99887766554433",
      chain: "tron",
      max_hops: 5,
    });
  }

  const res = await fetch(`${API_BASE}/fir/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ complaintText, complaint_text: complaintText }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`FIR Parse API error (${res.status}): ${errorText}`);
  }

  const backendData: ParsedComplaintResponse = await res.json();

  // Map backend response fields explicitly to frontend expectations
  return {
    ...backendData,
    suspect_address: backendData.suspect_wallet_address || undefined,
    chain: (backendData.blockchain_type as Chain) || undefined,
    max_hops: backendData.max_trace_hops || undefined,
  };
}

export async function generateNotice(
  payload: LegalNoticePayload
): Promise<NoticeGenerateResponse> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      notice_ref: "NOTICE-CS2026-001",
      pdf_url: "#mock-pdf-url",
      pdfUrl: "#mock-pdf-url",
      sha256_evidence_hash: payload.sha256_evidence_hash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      vasp_name: payload.attributed_vasp?.vasp_name || "CoinDCX",
      case_number: payload.case_number,
      is_fiu_registered: payload.attributed_vasp?.is_fiu_registered ?? true,
    });
  }

  const res = await fetch(`${API_BASE}/notices/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Notice Generation API error (${res.status}): ${errorText}`);
  }

  const data: NoticeGenerateResponse = await res.json();
  const rawRecord = data as unknown as Record<string, unknown>;
  return {
    ...data,
    pdfUrl: data.pdf_url || (typeof rawRecord.pdfUrl === "string" ? rawRecord.pdfUrl : undefined),
  };
}

export const runTrace = createTrace;
export const fetchCase = getCase;
export const fetchCases = getCases;

