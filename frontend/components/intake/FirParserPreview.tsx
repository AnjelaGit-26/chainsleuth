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
    <div className="p-4 bg-slate-900 border border-teal-800/60 rounded font-mono text-xs space-y-3 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-teal-400 font-semibold uppercase tracking-wider text-[11px]">
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>Gemini AI Extracted Parameters (Editable Review Panel)</span>
        </div>
        <span className="text-[10px] text-teal-300 font-bold bg-teal-950 px-2 py-0.5 border border-teal-800 rounded flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> VERIFIED
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Extracted Address */}
        <div className="col-span-2">
          <label className="text-slate-400 text-[11px] block mb-1">
            Extracted Wallet Address (Editable)
          </label>
          <input
            type="text"
            value={extractedAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-teal-300 font-mono text-xs focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Detected Chain */}
        <div>
          <label className="text-slate-400 text-[11px] block mb-1">
            Detected Blockchain Network
          </label>
          <select
            value={extractedChain}
            onChange={(e) => onChainChange(e.target.value as Chain)}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs uppercase focus:outline-none focus:border-teal-500"
          >
            <option value="tron">TRON (TRC-20 USDT)</option>
            <option value="solana">SOLANA (SPL Token)</option>
            <option value="ethereum">ETHEREUM (ERC-20)</option>
            <option value="bitcoin">BITCOIN (BTC UTXO)</option>
          </select>
        </div>

        {/* Extracted Amount */}
        <div>
          <label className="text-slate-400 text-[11px] block mb-1">
            Extracted Loss Amount (INR)
          </label>
          <input
            type="number"
            value={amountInr}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Scam Type */}
        <div className="col-span-2">
          <label className="text-slate-400 text-[11px] block mb-1">
            Detected Scam Typology Classification
          </label>
          <input
            type="text"
            value={scamType}
            onChange={(e) => onScamTypeChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-mono text-xs focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>
    </div>
  );
}
