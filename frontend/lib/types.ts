export type Chain = "tron" | "solana" | "ethereum" | "bitcoin";

export interface TraceRequest {
  suspect_address: string;
  chain: Chain;
  max_hops: number;
  value_threshold_pct: number;
  complaint_id?: string;
}

export interface SanctionsInfo {
  sanction_date?: string;
  designation_reason?: string;
  sanctioned_entity_name?: string;
  jurisdiction?: string;
  ofac_identifier?: string;
}

export interface BridgeInfo {
  bridge_name?: string;
  source_chain?: Chain | string;
  destination_chain?: Chain | string;
  dest_chain?: Chain | string;
  tx_hash?: string;
  confidence_score?: number;
  confidence?: number;
  timestamp?: string;
}

export interface WalletNode {
  address: string;
  chain: Chain;
  riskScore: number;
  balance: number;
  firstSeen: string;
  typologyFlags: TypologyFlag[];
  isVasp?: boolean;
  sanctionsInfo?: SanctionsInfo;
  bridgeInfo?: BridgeInfo;

  // AI / ML Forensic Intelligence Fields (Optional Backend Schema)
  gnn_risk_score?: number | null;
  anomaly_score?: number | null;
  typology_score?: number | null;
  heuristics_score?: number | null;
  risk_category?: string | null;
  explanation?: string | null;
  pmla_flag?: boolean | string | null;
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
  | "burner_wallet"
  | (string & {});

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
  nodal_officer_phone?: string;
}

export interface TraceResult {
  case_id: string;
  suspect_address: string;
  nodes: WalletNode[];
  edges: TransferEdge[];
  attribution: VASPAttribution | null;
  overall_risk_score: number;
  chain?: Chain;
  created_at?: string;
  status?: "active" | "pending_approval" | "frozen" | "closed";
  recommendations?: string[];
  sla_cashout_alert?: string;
}

export interface LegalNoticePayload {
  case_number: string;
  suspect_address: string;
  attributed_vasp: VASPAttribution;
  loss_amount_inr: number;
  flow_summary: string;
  sha256_evidence_hash: string;
}

export type UserRole =
  | "investigating_officer"
  | "supervisory_officer"
  | "vasp_nodal_officer";

export interface AuthUser {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  nickname?: string;
  role?: UserRole | string;
  roles?: (UserRole | string)[];
  permissions?: string[];
  is_admin?: boolean;
  is_investigator?: boolean;
  department?: string;
  badge_number?: string;
}

export interface AuthRoles {
  roles: (UserRole | string)[];
  permissions: string[];
  active_role?: UserRole | string;
  is_admin?: boolean;
  is_investigator?: boolean;
}

export interface CaseSummary {
  case_id: string;
  suspect_address: string;
  chain: Chain;
  overall_risk_score: number;
  status: "active" | "pending_approval" | "frozen" | "closed";
  created_at: string;
  attributed_vasp_name?: string;
}

export type ClusterType =
  | "vasp_sweep"
  | "syndicate_gas"
  | "layering_cell"
  | "smurfing_cell"
  | "dex_liquidity"
  | (string & {});

export interface WalletCluster {
  cluster_id: string;
  cluster_type: ClusterType;
  label: string;
  member_addresses: string[];
  total_volume_usdt?: number;
  dominant_risk_score?: number;
  description: string;
  entity_name?: string | null;
}

export interface CaseClustersResponse {
  case_id: string;
  cluster_count: number;
  clusters: WalletCluster[];
}

export interface FIRCreate {
  case_id: string;
  complainant_name: string;
  complainant_designation?: string;
  incident_description: string;
  suspect_addresses: string[];
  estimated_loss_inr?: number;
  date_of_incident: string;
}

export interface FIRResponse {
  fir_id: string;
  fir_number?: string;
  complaint_id?: string;
  case_id: string;
  complainant_name: string;
  complainant_designation?: string;
  incident_description: string;
  suspect_addresses: string[];
  estimated_loss_inr?: number;
  date_of_incident: string;
  generated_at?: string;
  created_at?: string;
  pdf_url?: string;
  download_url?: string;
  sha256_hash?: string;
}

export interface NCRPComplaintRecord {
  acknowledgement_number: string;
  complainant_name: string;
  suspect_wallet_address: string;
  category?:
    | "Investment Scam"
    | "Task-Based Fraud"
    | "Sextortion"
    | "Phishing"
    | "Ransomware"
    | "Darknet / Organised Crime"
    | "Impersonation Fraud"
    | (string & {});
  sub_category?: string | null;
  complaint_date?: string;
  incident_state?: string;
  complainant_contact?: string | null;
  blockchain?: Chain | string;
  reported_loss_inr?: number | null;
  complaint_text?: string | null;
}

export interface NCRPBatchIngestRequest {
  batch_id?: string;
  source_portal?: "NCRP" | "SAHYOG" | "I4C_PORTAL" | string;
  complaints: NCRPComplaintRecord[];
}

export interface IngestedSummaryItem {
  acknowledgement_number: string;
  case_id: string;
  suspect_address: string;
  chain: string;
  is_valid_address: boolean;
  status: string;
}

export interface NCRPBatchIngestResponse {
  batch_id: string;
  source_portal: string;
  total_complaints: number;
  valid_wallets_count: number;
  records: IngestedSummaryItem[];
  ingested_at: string;
}

export type CorrelationType =
  | "shared_gas_funder"
  | "shared_vasp_deposit"
  | "cross_jurisdiction_syndicate"
  | (string & {});

export type SyndicateThreatLevel = "CRITICAL" | "HIGH" | "MEDIUM" | (string & {});

export interface SyndicateCorrelationItem {
  correlation_id: string;
  correlation_type: CorrelationType;
  pivot_address: string;
  pivot_entity_label: string;
  linked_ncrp_ack_numbers: string[];
  linked_suspect_addresses: string[];
  total_aggregate_loss_inr: number;
  reporting_states: string[];
  syndicate_threat_level: SyndicateThreatLevel;
  action_recommendation: string;
}

export interface NcrpCorrelationsResponse {
  total_correlations: number;
  correlations: SyndicateCorrelationItem[];
}

export interface AuditLogItem {
  id: string;
  officer: string;
  action: string;
  query: string;
  timestamp: string;
}

export interface VASPRegistryItem {
  vasp_name: string;
  fiu_registered?: boolean;
  is_fiu_registered?: boolean;
  nodal_officer_email: string;
  jurisdiction: string;
  supported_chains: string[];
  notice_turnaround_hours?: number;
  notice_turnaround?: string;
  hot_wallet_address?: string;
  deposit_address?: string;
}

export type CustomTagEntityType =
  | "exchange"
  | "mule"
  | "scam"
  | "mixer"
  | "darknet"
  | "gambling"
  | "seized";

export interface CustomWalletTagPayload {
  address: string;
  entity_name: string;
  entity_type: CustomTagEntityType | string;
  chain?: string;
  confidence?: number;
  source?: string;
  case_reference?: string;
  notes?: string;
  tags?: string[];
}

export interface CustomWalletLabelItem {
  id?: string;
  address: string;
  entity_name: string;
  entity_type: CustomTagEntityType | string;
  chain?: string;
  confidence?: number;
  source?: string;
  case_reference?: string;
  notes?: string;
  tags?: string[];
  created_at?: string;
  created_by?: string;
}

export interface BridgeHopItem {
  bridge_protocol: string;
  source_chain: string;
  destination_chain: string;
  source_tx_hash: string;
  amount_usd?: number;
  token?: string;
  destination_wallet?: string;
  destination_tx_hash?: string;
  dest_tx_hash?: string;
}

export interface CaseBridgesResponse {
  case_id: string;
  total_bridges_detected: number;
  bridge_hops: BridgeHopItem[];
}

export interface PrivacySwapperItem {
  service_name: string;
  swapper_type?: string;
  input_currency: string;
  output_currency: string;
  intercept_address: string;
  subpoena_questionnaire_ready?: boolean;
}

export interface CasePrivacyResponse {
  case_id: string;
  privacy_swappers_detected: PrivacySwapperItem[];
}

export interface IntermediaryMule {
  address: string;
  role: string;
  holding_time_minutes?: number;
}

export interface LayeringAnalysisPath {
  path_id?: string;
  hop_count?: number;
  nodes?: string[];
  edges?: unknown[];
  summary?: string;
}

export interface LayeringAnalysisResponse {
  case_id: string;
  suspect_address?: string;
  total_paths_discovered?: number;
  min_hop_count?: number;
  max_hop_count?: number;
  paths?: LayeringAnalysisPath[];
  classified_intermediaries?: IntermediaryMule[];
  summary?: string;
  generated_at?: string;
  peeling_chain_count?: number | null;
  fan_out_count?: number | null;
  rapid_movement_detected?: boolean | null;
  max_layering_depth?: number;
  intermediary_mules?: IntermediaryMule[];
}

export interface EvidenceCertResponse {
  certificate_type?: string;
  former_equivalent?: string;
  case_id?: string;
  evidence_sha256_hash?: string;
  total_nodes_analyzed?: number;
  total_transactions_traced?: number;
  attributed_vasp?: string | null;
  statutory_declarations?: string[] | string | null;
  statutory_declaration?: string | null;
}

export interface AIReportResponse {
  case_id?: string;
  suspect_address?: string;
  chain?: string;
  overall_risk_score?: number;
  report?: string;
}






