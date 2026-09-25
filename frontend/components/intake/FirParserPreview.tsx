"use client";

import React from "react";
import { Chain } from "@/lib/types";
import { Sparkles, CheckCircle2 } from "lucide-react";

interface FirParserPreviewProps {
  extractedAddress: string;
  extractedChain: Chain;
  scamType: string;
  amountInr: number;
  onAddressChange: (val: string) => void;
  onChainChange: (val: Chain) => void;
  onScamTypeChange: (val: string) => void;
  onAmountChange: (val: number) => void;
}

export function FirParserPreview({
  extractedAddress,
  extractedChain,
  scamType,
  amountInr,
  onAddressChange,
  onChainChange,
  onScamTypeChange,
  onAmountChange,
}: FirParserPreviewProps) {
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_5%,transparent)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color-mix(in_oklab,var(--primary)_20%,transparent)] pb-2">
        <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-xs">
          <Sparkles className="size-4" />
          Gemini AI Extracted Parameters
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--primary)]">
          <CheckCircle2 className="size-3" />
          VERIFIED
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">
            Extracted Wallet Address <span className="font-normal">(editable)</span>
          </label>
          <input
            type="text"
            value={extractedAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="field font-mono text-[var(--primary)]"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">Blockchain Network</label>
          <select
            value={extractedChain}
            onChange={(e) => onChainChange(e.target.value as Chain)}
            className="field"
          >
            <option value="tron">TRON (TRC-20)</option>
            <option value="solana">SOLANA (SPL)</option>
            <option value="ethereum">ETHEREUM (ERC-20)</option>
            <option value="bitcoin">BITCOIN (BTC)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">Loss Amount (INR)</label>
          <input
            type="number"
            value={amountInr}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            className="field"
          />
        </div>

        <div className="col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-[var(--muted-foreground)]">Scam Typology Classification</label>
          <input
            type="text"
            value={scamType}
            onChange={(e) => onScamTypeChange(e.target.value)}
            className="field"
          />
        </div>
      </div>
    </div>
  );
}
