"use client";

import React from "react";
import { TypologyFlag } from "@/lib/types";
import { Layers, Flame, Share2, Link2, Repeat, Info } from "lucide-react";

interface TypologyFlagsProps {
  flags: TypologyFlag[];
}

const TYPOLOGY_CONFIG: Record<TypologyFlag, { title: string; icon: React.ElementType; color: string; explanation: string }> = {
  peeling_chain: {
    title: "Peeling Chain",
    icon: Layers,
    color: "text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)]",
    explanation: "Most value continues to a new wallet while smaller portions are peeled away to cash out.",
  },
  zero_gas_burner: {
    title: "Zero-Gas Burner",
    icon: Flame,
    color: "text-[var(--destructive)] bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] border-[color-mix(in_oklab,var(--destructive)_25%,transparent)]",
    explanation: "Fresh wallet with zero native gas balance used exclusively for temporary scam fund routing.",
  },
  fan_out: {
    title: "Fan-Out Analysis",
    icon: Share2,
    color: "text-[var(--amber)] bg-[color-mix(in_oklab,var(--amber)_8%,transparent)] border-[color-mix(in_oklab,var(--amber)_25%,transparent)]",
    explanation: "Large funds split rapidly across multiple sub-wallets to bypass detection thresholds.",
  },
  first_funder_match: {
    title: "First Funder Match",
    icon: Link2,
    color: "text-purple-600 bg-purple-50 border-purple-200",
    explanation: "Gas fee trace links this burner wallet to a master syndicate wallet reused across multiple FIRs.",
  },
  dex_swap: {
    title: "DEX Swap Hop",
    icon: Repeat,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    explanation: "Automated liquidity pool swap transaction on a decentralised exchange protocol.",
  },
  ofac_sanctioned: {
    title: "OFAC Sanctioned Entity",
    icon: Info,
    color: "text-red-700 bg-red-100 border-red-300",
    explanation: "Wallet address flagged on US Treasury OFAC SDN sanctions list.",
  },
  bridge_hop: {
    title: "Cross-Chain Bridge Hop",
    icon: Share2,
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    explanation: "Funds moved across blockchains via decentralized bridge protocol.",
  },
  coinjoin_mixer: {
    title: "CoinJoin / Tumbler Mixer",
    icon: Layers,
    color: "text-orange-700 bg-orange-50 border-orange-200",
    explanation: "Privacy mixer transaction designed to obscure money trail.",
  },
  burner_wallet: {
    title: "Disposable Burner Wallet",
    icon: Flame,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    explanation: "Single-use wallet discarded immediately after transaction execution.",
  },
};

export function TypologyFlags({ flags }: TypologyFlagsProps) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="space-y-2">
      {flags.map((flag) => {
        const cfg = TYPOLOGY_CONFIG[flag] ?? {
          title: flag,
          icon: Info,
          color: "text-[var(--muted-foreground)] bg-[var(--muted)] border-[var(--border)]",
          explanation: "Automated transaction anomaly detected.",
        };
        const Icon = cfg.icon;
        return (
          <div key={flag} className={`rounded-xl border p-3 space-y-1 ${cfg.color}`}>
            <div className="flex items-center gap-2 font-semibold text-xs">
              <Icon className="size-3.5 shrink-0" />
              <span>{cfg.title}</span>
            </div>
            <p className="text-xs leading-relaxed opacity-80 pl-5">{cfg.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}
