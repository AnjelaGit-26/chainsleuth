"use client";

import React from "react";
import { WalletNode, TransferEdge, VASPAttribution } from "@/lib/types";
import { TypologyFlags } from "./TypologyFlags";
import { RiskBadge } from "@/components/case/RiskBadge";
import { VaspAttributionCard } from "./VaspAttributionCard";
import { ArrowUpRight, ArrowDownLeft, ShieldAlert } from "lucide-react";

interface WalletDetailPanelProps {
  node: WalletNode | null;
  edges?: TransferEdge[];
  attribution?: VASPAttribution | null;
  caseId?: string;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export function WalletDetailPanel({ node, edges = [], attribution = null, caseId = "" }: WalletDetailPanelProps) {
  if (!node) {
    return (
      <div className="glass-panel h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="size-8 text-[var(--muted-foreground)]" />
        <div>
          <p className="font-semibold text-[var(--foreground)] text-sm">No Node Selected</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">
            Click any wallet node on the graph to inspect balance, transaction history &amp; typology flags.
          </p>
        </div>
      </div>
    );
  }

  const isTargetVasp = node.isVasp || (attribution && node.address.toLowerCase() === attribution.deposit_address.toLowerCase());
  if (isTargetVasp && attribution) {
    return <VaspAttributionCard attribution={attribution} caseId={caseId} />;
  }

  const walletTxs = edges.filter((e) => e.from === node.address || e.to === node.address);

  return (
    <div className="glass-panel flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Wallet Inspector</p>
        <RiskBadge score={node.riskScore} size="sm" />
      </div>

      {/* Address */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">Full Wallet Address</p>
        <p className="font-mono text-xs text-[var(--foreground)] break-all bg-white/50 rounded-lg px-3 py-2 border border-[color-mix(in_oklab,var(--border)_50%,transparent)]">
          {node.address}
        </p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/40 border border-[color-mix(in_oklab,var(--border)_40%,transparent)]">
        <InfoRow label="Chain" value={<span className="uppercase">{node.chain}</span>} />
        <InfoRow
          label="Balance"
          value={`${node.balance.toLocaleString()} ${
            node.chain === "tron" ? "TRX" : node.chain === "ethereum" ? "ETH" : node.chain === "bitcoin" ? "BTC" : "SOL"
          }`}
        />
        <InfoRow label="Risk Score" value={`${node.riskScore}/100`} />
        <InfoRow label="First Seen" value={new Date(node.firstSeen).toLocaleDateString("en-IN")} />
        {node.gnn_risk_score != null && (
          <InfoRow label="GraphSAGE GNN Score" value={`${node.gnn_risk_score}/100`} />
        )}
        {node.anomaly_score != null && (
          <InfoRow label="ML Anomaly Score" value={node.anomaly_score.toFixed(2)} />
        )}
      </div>

      {/* Typology flags */}
      {node.typologyFlags.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Detected Laundering Typologies
          </p>
          <TypologyFlags flags={node.typologyFlags} />
        </div>
      )}

      {/* Transaction hops */}
      <div className="flex-1 space-y-2 border-t border-[color-mix(in_oklab,var(--border)_40%,transparent)] pt-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          Transaction Hops ({walletTxs.length})
        </p>

        {walletTxs.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] text-center py-4">No transfer hops for this node</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {walletTxs.map((tx) => {
              const isOut = tx.from === node.address;
              return (
                <div
                  key={tx.txHash}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/40 border border-[color-mix(in_oklab,var(--border)_40%,transparent)] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-lg text-xs ${
                        isOut
                          ? "bg-[color-mix(in_oklab,var(--destructive)_10%,transparent)] text-[var(--destructive)]"
                          : "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] text-[var(--primary)]"
                      }`}
                      title={isOut ? "Outbound" : "Inbound"}
                    >
                      {isOut ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-[var(--foreground)] truncate">
                        {isOut ? tx.to.slice(0, 10) : tx.from.slice(0, 10)}…
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <p className="font-mono text-xs font-bold text-[var(--foreground)] shrink-0">
                    {tx.value.toLocaleString()} {tx.token}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
