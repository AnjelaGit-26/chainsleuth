export type Chain = "tron" | "solana" | "ethereum" | "bitcoin" | "base";

export interface TraceRequest {
  suspect_address: string;
  chain: Chain;
  max_hops?: number;
  value_threshold_pct?: number;
  complaint_id?: string;
}

export interface WalletNode {
  address: string;
  chain: Chain;
  riskScore: number;
  balance: number;
  firstSeen: string;
  typologyFlags: TypologyFlag[];
  isVasp?: boolean | null;
  gnn_risk_score?: number | null;
  anomaly_score?: number | null;
}

export type TypologyFlag =
  | "peeling_chain"
  | "fan_out"
  | "zero_gas_burner"
  | "first_funder_match"
  | "dex_swap"
  | "ofac_sanctioned"
  | "bridge_hop"
  | "coinjoin_mixer"
  | "burner_wallet";

export interface TransferEdge {
  txHash: string;
  from: string;
  to: string;
  value: number;
  token: string;
  timestamp: string;
}

export interface VASPAttribution {
  vasp_name: string;
  is_fiu_registered: boolean;
  confidence_score: number;
  deposit_address: string;
  hot_wallet_address: string;
  nodal_officer_email: string;
  nodal_officer_phone?: string | null;
}

export interface TraceResult {
  case_id: string;
  suspect_address: string;
  chain: Chain;
  nodes: WalletNode[];
  edges: TransferEdge[];
  attribution: VASPAttribution | null;
  overall_risk_score: number;
  created_at: string;
  status: string;
  recommendations?: string[];
  sla_cashout_alert?: string | null;
}

export interface ParsedComplaintResponse {
  suspect_wallet_address: string | null;
  blockchain_type: Chain | string | null;
  max_trace_hops: number | null;
  estimated_loss_inr: number | null;
  summary: string | null;
  confidence: string | null;
  raw_model_output: string | null;
  // Mapped/adapted properties for convenience
  suspect_address?: string;
  chain?: Chain;
  max_hops?: number;
}

export interface LegalNoticePayload {
  case_number: string;
  suspect_address: string;
  attributed_vasp: VASPAttribution;
  loss_amount_inr: number;
  flow_summary: string;
  sha256_evidence_hash: string;
}

export interface NoticeGenerateResponse {
  notice_ref: string;
  pdf_url: string;
  pdfUrl?: string; // Mapped camelCase alias
  sha256_evidence_hash: string;
  vasp_name: string;
  case_number: string;
  is_fiu_registered: boolean;
}

export type UserRole =
  | "investigating_officer"
  | "supervisory_officer"
  | "vasp_nodal_officer";

export interface CaseSummary {
  case_id: string;
  suspect_address: string;
  chain: Chain;
  overall_risk_score: number;
  status: string;
  created_at: string;
  node_count?: number;
  edge_count?: number;
  attributed_vasp?: string | null;
  attributed_vasp_name?: string | null;
}

