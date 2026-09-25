"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Chain, TraceRequest } from "@/lib/types";
import { createTrace, parseFir } from "@/lib/api";
import { FirParserPreview } from "./FirParserPreview";
import {
  Search,
  FileText,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
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

const LOADING_STEPS = [
  "Initializing investigation session",
  "Identifying target blockchain format",
  "Tracing multi-hop TRC-20 transactions",
  "Building graph topology",
  "Analyzing laundering typologies",
  "Checking VASP registry & deposit cluster attribution",
];

export function TraceForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"address" | "complaint">("address");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    address: string; chain: Chain; scamType: string; amountInr: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<FormInputs>({
    defaultValues: { suspect_address: "", chain: "tron", max_hops: 5, value_threshold_pct: 2.0, complaint_id: "" },
  });

  const handleParseFirSubmit = async () => {
    const rawText = getValues("complaint_text");
    if (!rawText?.trim()) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const result = await parseFir(rawText);
      const extractedAddr = result.suspect_address || result.suspect_wallet_address;
      if (extractedAddr) {
        const chain = (result.chain || result.blockchain_type || "tron") as Chain;
        setValue("suspect_address", extractedAddr);
        setValue("chain", chain);
        if (result.max_hops) setValue("max_hops", result.max_hops);
        setParsedData({
          address: extractedAddr,
          chain,
          scamType: result.summary || "Extracted Scam Narrative",
          amountInr: result.estimated_loss_inr ?? 0,
        });
      } else {
        setParseError("Could not extract a valid suspect wallet address from the complaint text. Please enter the wallet address manually.");
        setParsedData(null);
      }
    } catch (err: unknown) {
      console.error(err);
      setParseError((err as Error).message || "Failed to parse FIR complaint narrative.");
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const onSubmit = async (data: FormInputs) => {
    setLoading(true);
    setSubmitError(null);
    setCurrentStepIndex(0);
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 300);
    try {
      const payload: TraceRequest = {
        suspect_address: data.suspect_address,
        chain: data.chain,
        max_hops: Number(data.max_hops),
        value_threshold_pct: Number(data.value_threshold_pct || 2.0),
        complaint_id: data.complaint_id || undefined,
      };
      const result = await createTrace(payload);
      router.push(`/case/${encodeURIComponent(result.case_id)}`);
    } catch (err: unknown) {
      console.error(err);
      setSubmitError((err as Error).message || "Failed to execute trace investigation.");
      setLoading(false);
    } finally {
      clearInterval(stepInterval);
    }
  };

  return (
    <div className="relative w-full max-w-2xl">
      {/* Tab bar */}
      <div className="glass-panel mb-1 flex overflow-hidden rounded-2xl p-1 gap-1">
        {([
          { id: "address", label: "Paste Address", icon: Search },
          { id: "complaint", label: "AI FIR Extraction", icon: FileText },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer overflow-hidden",
              tab === id
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-white/50",
            ].join(" ")}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Form panel */}
      <div className="glass-panel p-6 space-y-5">
        {submitError && (
          <div className="rounded-xl border border-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)] p-3 text-xs text-[var(--destructive)] font-semibold">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {tab === "address" ? (
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                Suspect Wallet Address <span className="text-[var(--destructive)]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. TABC1234567890XYZ99887766554433"
                {...register("suspect_address", { required: "Wallet address is required" })}
                className="field font-mono"
              />
              {errors.suspect_address && (
                <p className="text-xs text-[var(--destructive)]">{errors.suspect_address.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[var(--foreground)]">
                  Raw Victim Complaint / FIR Narrative
                </label>
                <textarea
                  rows={5}
                  placeholder="Paste victim statement describing crypto scam, transaction hashes, or wallet address..."
                  {...register("complaint_text")}
                  className="field"
                />
                <button
                  type="button"
                  onClick={handleParseFirSubmit}
                  disabled={isParsing}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] disabled:opacity-50 cursor-pointer"
                >
                  {isParsing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {isParsing ? "Parsing with Gemini AI…" : "Parse FIR with Gemini AI"}
                </button>
              </div>
              {parseError && (
                <div className="rounded-xl border border-[var(--amber)] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] p-3 text-xs text-[var(--amber)] font-semibold">
                  {parseError}
                </div>
              )}
              {parsedData && (
                <FirParserPreview
                  extractedAddress={getValues("suspect_address") || parsedData.address}
                  extractedChain={getValues("chain") || parsedData.chain}
                  scamType={parsedData.scamType}
                  amountInr={parsedData.amountInr}
                  onAddressChange={(v) => { setValue("suspect_address", v); setParsedData((p) => p ? { ...p, address: v } : null); }}
                  onChainChange={(v) => { setValue("chain", v); setParsedData((p) => p ? { ...p, chain: v } : null); }}
                  onScamTypeChange={(v) => setParsedData((p) => p ? { ...p, scamType: v } : null)}
                  onAmountChange={(v) => setParsedData((p) => p ? { ...p, amountInr: v } : null)}
                />
              )}
            </div>
          )}

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                Blockchain Network <span className="text-[var(--destructive)]">*</span>
              </label>
              <select {...register("chain", { required: true })} className="field">
                <option value="tron">TRON (TRC-20 USDT)</option>
                <option value="solana">SOLANA (SPL Token)</option>
                <option value="ethereum">ETHEREUM (ERC-20)</option>
                <option value="bitcoin">BITCOIN (BTC)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[var(--foreground)]">
                Max Hops (1–10) <span className="text-[var(--destructive)]">*</span>
              </label>
              <input
                type="number" min={1} max={10}
                {...register("max_hops", { required: true, min: 1, max: 10 })}
                className="field"
              />
              {errors.max_hops && <p className="text-xs text-[var(--destructive)]">Must be 1–10</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              Complaint / FIR Reference ID <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. NCRP-2026-88910"
              {...register("complaint_id")}
              className="field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60 cursor-pointer mt-2"
          >
            <ShieldCheck className="size-4" />
            Start Investigation
            <ArrowRight className="size-4" />
          </button>
        </form>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl bg-white/90 backdrop-blur-sm p-8 text-center z-20">
            <div className="size-12 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            <div>
              <p className="font-display text-lg font-bold text-[var(--foreground)]">Executing Investigation Trace</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Analyzing transaction ledger & graph typologies…</p>
            </div>
            <div className="w-full max-w-sm space-y-2 text-left">
              {LOADING_STEPS.map((step, idx) => {
                const done = idx < currentStepIndex;
                const current = idx === currentStepIndex;
                return (
                  <div key={step} className="flex items-center gap-2.5 text-sm">
                    {done ? (
                      <CheckCircle2 className="size-4 text-[var(--primary)] shrink-0" />
                    ) : current ? (
                      <Loader2 className="size-4 text-[var(--amber)] animate-spin shrink-0" />
                    ) : (
                      <div className="size-4 rounded-full border border-[var(--border)] shrink-0" />
                    )}
                    <span className={done ? "text-[var(--primary)] font-medium" : current ? "text-[var(--foreground)] font-semibold" : "text-[var(--muted-foreground)]"}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
