"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Chain, TraceRequest, TraceResult, WalletNode, TypologyFlag } from "@/lib/types";
import { createTrace, parseFir } from "@/lib/api";
import { FirParserPreview } from "./FirParserPreview";
import {
  Search,
  FileText,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface FormInputs {
  suspect_address: string;
  chain: Chain;
  max_hops: number;
  value_threshold_pct: number;
  complaint_id?: string;
  complaint_text?: string;
}

export function TraceForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"address" | "complaint">("address");
  const [isParsing, setIsParsing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    address: string;
    chain: Chain;
    scamType: string;
    amountInr: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormInputs>({
    defaultValues: {
      suspect_address: "",
      chain: "tron",
      max_hops: 5,
      value_threshold_pct: 2.0,
      complaint_id: "",
    },
  });

  const handleParseFirSubmit = async () => {
    const rawText = getValues("complaint_text");
    if (!rawText || !rawText.trim()) return;

    setIsParsing(true);
    setSubmitError(null);
    try {
      const result = await parseFir(rawText);
      const extractedAddr = result.suspect_address || "";
      const extractedChain = result.chain || "tron";

      if (!extractedAddr) {
        setSubmitError("Could not extract a valid suspect wallet address from the complaint text.");
        return;
      }

      setValue("suspect_address", extractedAddr);
      setValue("chain", extractedChain);

      setParsedData({
        address: extractedAddr,
        chain: extractedChain,
        scamType: "Extracted Complaint Narrative Target",
        amountInr: 0,
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to parse FIR complaint text.";
      setSubmitError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const onSubmit = async (data: FormInputs) => {
    setLoading(true);
    setSubmitError(null);
    setTraceResult(null);

    try {
      const requestPayload: TraceRequest = {
        suspect_address: data.suspect_address.trim(),
        chain: data.chain,
        max_hops: Number(data.max_hops),
        value_threshold_pct: Number(data.value_threshold_pct || 2.0),
        complaint_id: data.complaint_id,
      };

      const result = await createTrace(requestPayload);
      setTraceResult(result);
      setLoading(false);
      
      // Auto-navigate to case workbench
      setTimeout(() => {
        router.push(`/case/${result.case_id}`);
      }, 1500);
    } catch (err: unknown) {
      console.warn("[TraceForm] Trace execution error:", err);
      const msg = err instanceof Error ? err.message : "Failed to initiate trace with backend API.";
      setSubmitError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded p-6 font-mono text-xs select-none">
      {/* Submit Error Banner */}
      {submitError && (
        <div className="mb-4 p-3 bg-red-950/80 border border-red-800 rounded text-red-300 font-sans text-xs flex items-center justify-between">
          <span>{submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-red-400 hover:text-red-200 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 mb-6 font-sans">
        <button
          type="button"
          onClick={() => setTab("address")}
          className={`flex items-center gap-2 px-4 py-2 font-semibold text-xs border-b-2 transition-colors ${
            tab === "address"
              ? "border-teal-500 text-teal-400 bg-slate-900/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Search className="w-4 h-4" />
          Paste Address
        </button>

        <button
          type="button"
          onClick={() => setTab("complaint")}
          className={`flex items-center gap-2 px-4 py-2 font-semibold text-xs border-b-2 transition-colors ${
            tab === "complaint"
              ? "border-teal-500 text-teal-400 bg-slate-900/50"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          Paste Complaint Text (AI Extraction)
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {tab === "address" ? (
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Suspect Wallet Address *
            </label>
            <input
              type="text"
              placeholder="e.g. TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9"
              {...register("suspect_address", { required: "Wallet address is required" })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-xs"
            />
            <div className="text-[10px] text-slate-500 mt-1">
              Expected: TRON (T...), EVM (0x...), Solana (Base58), or Bitcoin (1..., 3..., bc1...).
            </div>
            {errors.suspect_address && (
              <span className="text-red-400 text-[11px] mt-1 block">
                {errors.suspect_address.message}
              </span>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Raw Victim Complaint / FIR Narrative Text
              </label>
              <textarea
                rows={5}
                placeholder="Paste victim statement narrative describing crypto scam, transaction hashes, or wallet address..."
                {...register("complaint_text")}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-xs leading-relaxed"
              />
              <button
                type="button"
                onClick={handleParseFirSubmit}
                disabled={isParsing}
                className="mt-2 text-xs font-sans font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-teal-800/80 rounded transition-colors"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Parsing FIR narrative with Gemini AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Parse FIR Narrative with Gemini AI
                  </>
                )}
              </button>
            </div>

            {/* Extracted Parameters Review Panel */}
            {parsedData && (
              <FirParserPreview
                extractedAddress={getValues("suspect_address") || parsedData.address}
                extractedChain={getValues("chain") || parsedData.chain}
                scamType={parsedData.scamType}
                amountInr={parsedData.amountInr}
                onAddressChange={(val) => {
                  setValue("suspect_address", val);
                  setParsedData((prev) => (prev ? { ...prev, address: val } : null));
                }}
                onChainChange={(val) => {
                  setValue("chain", val);
                  setParsedData((prev) => (prev ? { ...prev, chain: val } : null));
                }}
                onScamTypeChange={(val) =>
                  setParsedData((prev) => (prev ? { ...prev, scamType: val } : null))
                }
                onAmountChange={(val) =>
                  setParsedData((prev) => (prev ? { ...prev, amountInr: val } : null))
                }
              />
            )}
          </div>
        )}

        {/* Common Form Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Blockchain Network *
            </label>
            <select
              {...register("chain", { required: "Chain is required" })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500 uppercase font-mono text-xs"
            >
              <option value="tron">TRON (TRC-20 USDT)</option>
              <option value="solana">SOLANA (SPL Token)</option>
              <option value="ethereum">ETHEREUM (ERC-20)</option>
              <option value="bitcoin">BITCOIN (BTC UTXO)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              Max Hops (1 to 10) *
            </label>
            <input
              type="number"
              min={1}
              max={10}
              {...register("max_hops", {
                required: "Max hops is required",
                min: { value: 1, message: "Min 1 hop" },
                max: { value: 10, message: "Max 10 hops" },
              })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-xs"
            />
            {errors.max_hops && (
              <span className="text-red-400 text-[11px] mt-1 block">
                {errors.max_hops.message}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">
            Complaint / FIR Reference ID (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. NCRP-2026-88910"
            {...register("complaint_id")}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500 font-mono text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-slate-950 font-sans font-bold text-xs rounded flex items-center justify-center gap-2 transition-colors mt-6 cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          Start Investigation
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Real Execution Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded p-6 flex flex-col items-center justify-center text-center space-y-4 z-20 font-mono">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />

          <div className="space-y-1.5">
            <div className="text-xs font-bold font-sans uppercase tracking-widest text-teal-400">
              AI / FORENSIC ANALYSIS
            </div>
            <div className="text-sm font-bold font-sans text-slate-100">
              Running forensic analysis...
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
              Executing backend graph traversal & forensic intelligence pipeline.
            </p>
          </div>
        </div>
      )}

      {/* Post-Trace Telemetry Result Overlay */}
      {!loading && traceResult && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm rounded p-6 flex flex-col items-center justify-center text-center space-y-4 z-20 font-mono">
          <div className="w-full max-w-md bg-slate-900 border border-teal-500/80 rounded p-4 text-left space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold font-sans text-teal-400 uppercase tracking-wider">
                AI / ML TRACE TELEMETRY
              </span>
              <span className="text-[10px] bg-teal-950 text-teal-300 font-bold px-2 py-0.5 rounded border border-teal-800">
                EXECUTION COMPLETED
              </span>
            </div>

            {(() => {
              const suspectNode =
                traceResult.nodes?.find(
                  (n: WalletNode) => n.address.toLowerCase() === traceResult.suspect_address.toLowerCase()
                ) || traceResult.nodes?.[0];

              const overallRiskDisplay =
                traceResult.overall_risk_score !== undefined && traceResult.overall_risk_score !== null
                  ? `${traceResult.overall_risk_score}/100`
                  : "Unavailable";

              const gnnRiskDisplay =
                suspectNode?.gnn_risk_score !== undefined && suspectNode?.gnn_risk_score !== null
                  ? String(suspectNode.gnn_risk_score)
                  : "Unavailable";

              const anomalyScoreDisplay =
                suspectNode?.anomaly_score !== undefined && suspectNode?.anomaly_score !== null
                  ? String(suspectNode.anomaly_score)
                  : "Unavailable";

              const vaspDisplay = traceResult.attribution?.vasp_name || "VASP attribution unavailable";

              const typologies = suspectNode?.typologyFlags;

              return (
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px] uppercase">Overall Risk</div>
                      <div className="font-bold text-slate-100">{overallRiskDisplay}</div>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px] uppercase">GNN Risk Score</div>
                      <div className="font-bold text-slate-100">{gnnRiskDisplay}</div>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px] uppercase">Anomaly Score</div>
                      <div className="font-bold text-slate-100">{anomalyScoreDisplay}</div>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px] uppercase">Attributed VASP</div>
                      <div className="font-bold text-teal-300 truncate">{vaspDisplay}</div>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                    <div className="text-slate-500 text-[10px] uppercase">Detected Typologies</div>
                    {typologies === undefined || typologies === null ? (
                      <div className="text-slate-400 italic">Unavailable</div>
                    ) : typologies.length === 0 ? (
                      <div className="text-slate-400">None</div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {typologies.map((t: TypologyFlag | string, idx: number) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.2 bg-teal-950 text-teal-300 border border-teal-800 rounded font-bold uppercase"
                          >
                            {String(t)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => router.push(`/case/${traceResult.case_id}`)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-sans font-bold text-xs rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Open Case Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
