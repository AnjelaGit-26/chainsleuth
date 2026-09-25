"use client";

import React from "react";
import Link from "next/link";
import { VASPAttribution } from "@/lib/types";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Mail,
  Phone,
  Target,
  Layers,
  ArrowRight,
} from "lucide-react";

interface VaspAttributionCardProps {
  attribution: VASPAttribution | null;
  caseId: string;
}

export function VaspAttributionCard({ attribution, caseId }: VaspAttributionCardProps) {
  if (!attribution) return null;

  return (
    <div className="glass-panel flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[color-mix(in_oklab,var(--border)_40%,transparent)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-[var(--primary)]">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">VASP Match Identified</p>
            <p className="font-display text-sm font-bold text-[var(--foreground)] truncate">{attribution.vasp_name}</p>
          </div>
        </div>
        {attribution.is_fiu_registered ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--primary)] shrink-0">
            <CheckCircle2 className="size-3" />
            FIU-IND
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--amber)_35%,transparent)] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--amber)] shrink-0">
            <AlertTriangle className="size-3" />
            Unregistered
          </span>
        )}
      </div>

      {/* Confidence */}
      <div className="rounded-xl bg-white/40 border border-[color-mix(in_oklab,var(--border)_40%,transparent)] p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--muted-foreground)]">Attribution Confidence</span>
          <span className="font-mono text-sm font-bold text-[var(--primary)]">{attribution.confidence_score}%</span>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          Attribution verified via 1-hop sweep heuristics linking suspect funds directly to {attribution.vasp_name} deposit infrastructure.
        </p>
      </div>

      {/* Deposit address — actionable */}
      <div className="rounded-xl border-2 border-[color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
            <Target className="size-3.5 animate-pulse" />
            Actionable Deposit Address
          </span>
          <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            FREEZE TARGET
          </span>
        </div>
        <p className="font-mono text-xs text-[var(--foreground)] break-all bg-white/60 rounded-lg px-3 py-2 border border-[color-mix(in_oklab,var(--primary)_25%,transparent)]">
          {attribution.deposit_address}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)]">
          Primary KYC-linked account named in Section 94 BNSS Legal Freeze Directive.
        </p>
      </div>

      {/* Hot wallet — subdued */}
      <div className="rounded-xl bg-white/30 border border-[color-mix(in_oklab,var(--border)_40%,transparent)] p-3 space-y-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
          <Layers className="size-3.5" />
          Exchange Hot Wallet
          <span className="ml-1 text-[9px] font-normal">(shared pool — do not freeze)</span>
        </span>
        <p className="font-mono text-xs text-[var(--muted-foreground)] break-all">
          {attribution.hot_wallet_address}
        </p>
      </div>

      {/* Nodal officer contacts */}
      <div className="rounded-xl bg-white/40 border border-[color-mix(in_oklab,var(--border)_40%,transparent)] p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Nodal Officer Contacts</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="size-4 text-[var(--primary)] shrink-0" />
            <span className="text-[var(--foreground)] font-medium text-xs">{attribution.nodal_officer_email}</span>
          </div>
          {attribution.nodal_officer_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-[var(--primary)] shrink-0" />
              <span className="font-mono text-xs text-[var(--foreground)]">{attribution.nodal_officer_phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/case/${caseId}/notice`}
        className="flex items-center justify-center gap-2 w-full rounded-full bg-[var(--primary)] py-2.5 text-sm font-bold text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
      >
        <FileText className="size-4" />
        Generate Legal Freeze Notice
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
