"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CaseBridgesResponse,
  CasePrivacyResponse,
  LayeringAnalysisResponse,
  WalletNode,
} from "@/lib/types";
import {
  getCaseBridges,
  getCasePrivacy,
  getCaseLayering,
} from "@/lib/api";
import {
  ArrowRightLeft,
  ShieldAlert,
  Layers,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

interface ForensicDeepDivePanelProps {
  caseId: string;
  graphNodes?: WalletNode[];
  onSelectNode?: (address: string) => void;
}

type TabType = "bridges" | "privacy" | "layering";

function truncateHash(hash: string, length = 8): string {
  if (!hash) return "N/A";
  if (hash.length <= length * 2) return hash;
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
}

function getExplorerUrl(txHash?: string | null, chain?: string | null): string | null {
  if (!txHash || typeof txHash !== "string" || !txHash.trim()) return null;
  if (!chain || typeof chain !== "string" || !chain.trim()) return null;
  const c = chain.toLowerCase().trim();
  const hash = txHash.trim();
  if (c.includes("tron") || c.includes("trx")) return `https://tronscan.org/#/transaction/${hash}`;
  if (c.includes("eth") || c.includes("ethereum")) return `https://etherscan.io/tx/${hash}`;
  if (c.includes("sol") || c.includes("solana")) return `https://solscan.io/tx/${hash}`;
  if (c.includes("btc") || c.includes("bitcoin")) return `https://mempool.space/tx/${hash}`;
  return null;
}

export function ForensicDeepDivePanel({
  caseId,
  graphNodes = [],
  onSelectNode,
}: ForensicDeepDivePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("bridges");

  // Bridges State
  const [bridgesData, setBridgesData] = useState<CaseBridgesResponse | null>(null);
  const [loadingBridges, setLoadingBridges] = useState(false);
  const [errorBridges, setErrorBridges] = useState<string | null>(null);

  // Privacy State
  const [privacyData, setPrivacyData] = useState<CasePrivacyResponse | null>(null);
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [errorPrivacy, setErrorPrivacy] = useState<string | null>(null);

  // Layering State
  const [layeringData, setLayeringData] = useState<LayeringAnalysisResponse | null>(null);
  const [loadingLayering, setLoadingLayering] = useState(false);
  const [errorLayering, setErrorLayering] = useState<string | null>(null);

  // Copy state helper
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const fetchBridges = useCallback(() => {
    if (!caseId) return;
    setLoadingBridges(true);
    setErrorBridges(null);
    getCaseBridges(caseId)
      .then((data) => setBridgesData(data))
      .catch((err) => setErrorBridges(err instanceof Error ? err.message : "Unable to load bridge analysis."))
      .finally(() => setLoadingBridges(false));
  }, [caseId]);

  const fetchPrivacy = useCallback(() => {
    if (!caseId) return;
    setLoadingPrivacy(true);
    setErrorPrivacy(null);
    getCasePrivacy(caseId)
      .then((data) => setPrivacyData(data))
      .catch((err) => setErrorPrivacy(err instanceof Error ? err.message : "Unable to load privacy analysis."))
      .finally(() => setLoadingPrivacy(false));
  }, [caseId]);

  const fetchLayering = useCallback(() => {
    if (!caseId) return;
    setLoadingLayering(true);
    setErrorLayering(null);
    getCaseLayering(caseId)
      .then((data) => setLayeringData(data))
      .catch((err) => setErrorLayering(err instanceof Error ? err.message : "Unable to load layering analysis."))
      .finally(() => setLoadingLayering(false));
  }, [caseId]);

  useEffect(() => {
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      fetchBridges();
      fetchPrivacy();
      fetchLayering();
    });
    return () => {
      isMounted = false;
    };
  }, [fetchBridges, fetchPrivacy, fetchLayering]);

  const isWalletInGraph = (addr?: string) => {
    if (!addr) return false;
    return graphNodes.some((n) => n.address.toLowerCase() === addr.toLowerCase());
  };

  const renderAddressWithAction = (address: string, label: string) => {
    const exists = isWalletInGraph(address);
    return (
      <div className="flex items-center gap-1.5 font-mono text-[11px]">
        <span className="text-slate-300 font-semibold" title={address}>
          {truncateHash(address, 6)}
        </span>
        <button
          type="button"
          onClick={() => handleCopy(address)}
          aria-label={`Copy ${label}`}
          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title={`Copy ${label}`}
        >
          {copiedText === address ? (
            <Check className="w-3 h-3 text-teal-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
        {exists && onSelectNode && (
          <button
            type="button"
            onClick={() => onSelectNode(address)}
            className="px-1.5 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[10px] font-sans font-bold transition-colors cursor-pointer"
            title="Highlight in Graph Workbench"
          >
            Inspect in Graph
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 font-sans select-none space-y-4">
      {/* Header & Section Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <span>Forensic Deep Dive Analysis</span>
          </h3>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time ledger intelligence for cross-chain bridges, privacy swappers, and multi-hop layering.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-md font-mono text-xs shrink-0 flex-wrap sm:flex-nowrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("bridges")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "bridges"
                ? "bg-slate-800 text-teal-300 border border-teal-800 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cross-Chain Bridges</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("privacy")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "privacy"
                ? "bg-slate-800 text-purple-300 border border-purple-800 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            <span>Privacy / Swappers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("layering")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "layering"
                ? "bg-slate-800 text-amber-300 border border-amber-800 shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Layering Analysis</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: CROSS-CHAIN BRIDGES */}
      {activeTab === "bridges" && (
        <div className="space-y-4">
          {loadingBridges && (
            <div className="p-8 text-center bg-slate-900/40 rounded border border-slate-900 font-mono text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-teal-400 animate-spin" />
              <span>Loading bridge analysis...</span>
            </div>
          )}

          {errorBridges && !loadingBridges && (
            <div className="p-4 bg-red-950/60 border border-red-800 rounded font-mono text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Unable to load bridge analysis ({errorBridges})</span>
              </div>
              <button
                type="button"
                onClick={fetchBridges}
                className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded font-sans text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!loadingBridges && !errorBridges && bridgesData && (
            <>
              {/* Summary Header */}
              <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded border border-slate-800">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  Total Bridges Detected
                </span>
                <span className="text-base font-bold font-mono text-cyan-400 px-2.5 py-0.5 bg-cyan-950 rounded border border-cyan-800">
                  {bridgesData.total_bridges_detected}
                </span>
              </div>

              {bridgesData.bridge_hops.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded border border-slate-800/60 font-mono text-xs text-slate-500">
                  No bridge hops returned for this case.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bridgesData.bridge_hops.map((hop, idx) => {
                    const sourceExplorerUrl = getExplorerUrl(hop.source_tx_hash, hop.source_chain);
                    const destTxHash = hop.destination_tx_hash || hop.dest_tx_hash;
                    const destExplorerUrl = getExplorerUrl(destTxHash, hop.destination_chain);

                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-900/90 border border-slate-800 rounded font-mono text-xs space-y-3"
                      >
                        {/* Source Chain -> Bridge Protocol -> Destination Chain Flow */}
                        <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800">
                          <div className="text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Source</div>
                            <div className="font-bold text-slate-200 uppercase">{hop.source_chain}</div>
                          </div>
                          <div className="flex flex-col items-center px-2">
                            <ArrowRight className="w-4 h-4 text-cyan-400" />
                            <span className="text-[10px] font-bold text-cyan-300 uppercase mt-0.5">
                              {hop.bridge_protocol}
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Destination</div>
                            <div className="font-bold text-slate-200 uppercase">{hop.destination_chain}</div>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 text-[11px] pt-1 border-t border-slate-800/80">
                          {hop.token && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Token:</span>
                              <span className="font-bold text-slate-200">{hop.token}</span>
                            </div>
                          )}
                          {hop.amount_usd !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Amount USD:</span>
                              <span className="font-bold text-teal-400">
                                ${hop.amount_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {hop.destination_wallet && (
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">Destination Wallet:</span>
                              {renderAddressWithAction(hop.destination_wallet, "destination wallet")}
                            </div>
                          )}

                          {/* Source Tx Hash */}
                          {hop.source_tx_hash ? (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                              <span className="text-slate-500">Source Tx Hash:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-300" title={hop.source_tx_hash}>
                                  {truncateHash(hop.source_tx_hash, 6)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(hop.source_tx_hash)}
                                  aria-label="Copy source transaction hash"
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                  title="Copy source transaction hash"
                                >
                                  {copiedText === hop.source_tx_hash ? (
                                    <Check className="w-3 h-3 text-teal-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                                {sourceExplorerUrl ? (
                                  <a
                                    href={sourceExplorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[10px] font-sans font-bold transition-colors cursor-pointer"
                                    title={`View on ${hop.source_chain || "block"} explorer`}
                                  >
                                    <span>Explorer</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                    Explorer unavailable
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {/* Destination Tx Hash (if provided by backend) */}
                          {destTxHash ? (
                            <div className="flex justify-between items-center pt-1 border-t border-slate-800/40">
                              <span className="text-slate-500">Dest Tx Hash:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-300" title={destTxHash}>
                                  {truncateHash(destTxHash, 6)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(destTxHash)}
                                  aria-label="Copy destination transaction hash"
                                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                  title="Copy destination transaction hash"
                                >
                                  {copiedText === destTxHash ? (
                                    <Check className="w-3 h-3 text-teal-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                                {destExplorerUrl ? (
                                  <a
                                    href={destExplorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-[10px] font-sans font-bold transition-colors cursor-pointer"
                                    title={`View on ${hop.destination_chain || "block"} explorer`}
                                  >
                                    <span>Explorer</span>
                                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                    Explorer unavailable
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PRIVACY / SWAPPER ACTIVITY */}
      {activeTab === "privacy" && (
        <div className="space-y-4">
          {loadingPrivacy && (
            <div className="p-8 text-center bg-slate-900/40 rounded border border-slate-900 font-mono text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
              <span>Loading privacy analysis...</span>
            </div>
          )}

          {errorPrivacy && !loadingPrivacy && (
            <div className="p-4 bg-red-950/60 border border-red-800 rounded font-mono text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Unable to load privacy analysis ({errorPrivacy})</span>
              </div>
              <button
                type="button"
                onClick={fetchPrivacy}
                className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded font-sans text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!loadingPrivacy && !errorPrivacy && privacyData && (
            <>
              {/* Investigation Alert Banner */}
              {privacyData.privacy_swappers_detected.length > 0 && (
                <div className="p-3 bg-purple-950/80 border border-purple-700 rounded text-purple-200 font-mono text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold font-sans text-xs text-purple-300 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
                    <span>Privacy / Swapper Activity Detected</span>
                  </div>
                  <p className="text-[11px] text-purple-300/90 leading-relaxed font-mono">
                    Backend forensic analysis returned privacy-swapper activity for this case.
                  </p>
                </div>
              )}

              {privacyData.privacy_swappers_detected.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded border border-slate-800/60 font-mono text-xs text-slate-500">
                  No privacy-swapper findings returned for this case.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {privacyData.privacy_swappers_detected.map((item, idx) => {
                    const subpoenaStatus =
                      item.subpoena_questionnaire_ready === true
                        ? "Available"
                        : item.subpoena_questionnaire_ready === false
                        ? "Not available"
                        : "Unavailable";

                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-900/90 border border-slate-800 rounded font-mono text-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-slate-100 font-sans text-sm">{item.service_name}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-extrabold uppercase">
                            {item.swapper_type || "Swapper"}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Input Currency:</span>
                            <span className="font-bold text-slate-200">{item.input_currency}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Output Currency:</span>
                            <span className="font-bold text-purple-300">{item.output_currency}</span>
                          </div>
                          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
                            <span className="text-slate-500">Intercept Address:</span>
                            {renderAddressWithAction(item.intercept_address, "intercept address")}
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-slate-500">Subpoena Questionnaire:</span>
                            <span
                              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                subpoenaStatus === "Available"
                                  ? "bg-teal-950 text-teal-400 border border-teal-800"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {subpoenaStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SUB-TAB 3: LAYERING ANALYSIS */}
      {activeTab === "layering" && (
        <div className="space-y-4">
          {loadingLayering && (
            <div className="p-8 text-center bg-slate-900/40 rounded border border-slate-900 font-mono text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
              <span>Loading layering analysis...</span>
            </div>
          )}

          {errorLayering && !loadingLayering && (
            <div className="p-4 bg-red-950/60 border border-red-800 rounded font-mono text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Unable to load layering analysis ({errorLayering})</span>
              </div>
              <button
                type="button"
                onClick={fetchLayering}
                className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded font-sans text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {!loadingLayering && !errorLayering && layeringData && (
            <>
              {/* Analysis Summary Banner from Backend */}
              {layeringData.summary && (
                <div className="p-3 bg-slate-900/90 border border-slate-800 rounded font-mono text-xs space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Analysis Summary</div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{layeringData.summary}</p>
                </div>
              )}

              {/* Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-900/80 p-3 rounded border border-slate-800 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Max Layering Depth</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {layeringData.max_hop_count !== undefined && layeringData.max_hop_count !== null
                      ? `${layeringData.max_hop_count} ${layeringData.max_hop_count === 1 ? "Hop" : "Hops"}`
                      : layeringData.max_layering_depth !== undefined && layeringData.max_layering_depth !== null
                      ? `${layeringData.max_layering_depth} ${layeringData.max_layering_depth === 1 ? "Hop" : "Hops"}`
                      : "Unavailable"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Total Paths</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {layeringData.total_paths_discovered !== undefined && layeringData.total_paths_discovered !== null
                      ? layeringData.total_paths_discovered
                      : "Unavailable"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Min Hop Count</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {layeringData.min_hop_count !== undefined && layeringData.min_hop_count !== null
                      ? layeringData.min_hop_count
                      : "Unavailable"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Peeling Chains</div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">
                    {layeringData.peeling_chain_count !== undefined && layeringData.peeling_chain_count !== null
                      ? layeringData.peeling_chain_count
                      : "Unavailable"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Fan-Out Count</div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">
                    {layeringData.fan_out_count !== undefined && layeringData.fan_out_count !== null
                      ? layeringData.fan_out_count
                      : "Unavailable"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Rapid Movement</div>
                  <div className="text-xs font-bold mt-0.5">
                    {layeringData.rapid_movement_detected === true ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Rapid movement detected
                      </span>
                    ) : layeringData.rapid_movement_detected === false ? (
                      <span className="text-slate-400">No rapid movement detected</span>
                    ) : (
                      <span className="text-slate-400 font-normal">Unavailable</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Intermediary Mules Table */}
              {(() => {
                const mules = layeringData.classified_intermediaries || layeringData.intermediary_mules || [];
                return (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 font-sans uppercase tracking-wider">
                      Intermediary Mule Wallets ({mules.length})
                    </div>

                    {mules.length === 0 ? (
                      <div className="p-6 text-center bg-slate-900/30 rounded border border-slate-800/60 font-mono text-xs text-slate-500">
                        No intermediary mule wallets returned for this case.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-800 rounded bg-slate-900/60">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase bg-slate-950">
                              <th className="p-2.5">Wallet Address</th>
                              <th className="p-2.5">Role</th>
                              <th className="p-2.5 text-right">Holding Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {mules.map((mule, idx) => {
                              const holdingTimeText =
                                mule.holding_time_minutes !== undefined && mule.holding_time_minutes !== null
                                  ? `${mule.holding_time_minutes} minutes`
                                  : "Unavailable";

                              return (
                                <tr key={idx} className="hover:bg-slate-900/90 transition-colors">
                                  <td className="p-2.5">
                                    {renderAddressWithAction(mule.address, "intermediary wallet")}
                                  </td>
                                  <td className="p-2.5">
                                    <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[10px] font-bold">
                                      {mule.role}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right text-slate-300 font-bold">
                                    {holdingTimeText}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Laundering Paths Section */}
              {layeringData.paths && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 font-sans uppercase tracking-wider">
                    Laundering Paths Discovered ({layeringData.paths.length})
                  </div>
                  {layeringData.paths.length === 0 ? (
                    <div className="p-4 text-center bg-slate-900/30 rounded border border-slate-800/60 font-mono text-xs text-slate-500">
                      No laundering paths discovered.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {layeringData.paths.map((p, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/80 border border-slate-800 rounded font-mono text-xs space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Path #{idx + 1}</span>
                            <span className="text-amber-400 font-bold">{p.hop_count ?? 0} Hops</span>
                          </div>
                          {p.summary && <p className="text-[11px] text-slate-300">{p.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
