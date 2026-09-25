"use client";

import React from "react";

interface RiskBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ score, size = "md" }: RiskBadgeProps) {
  const bg = score >= 75
    ? "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-[var(--destructive)] border-[color-mix(in_oklab,var(--destructive)_35%,transparent)]"
    : score >= 50
    ? "bg-[color-mix(in_oklab,var(--amber)_12%,transparent)] text-[var(--amber)] border-[color-mix(in_oklab,var(--amber)_35%,transparent)]"
    : "bg-[color-mix(in_oklab,var(--primary)_12%,transparent)] text-[var(--primary)] border-[color-mix(in_oklab,var(--primary)_35%,transparent)]";

  const sz = size === "sm"
    ? "px-2 py-0.5 text-xs"
    : size === "lg"
    ? "px-3.5 py-1 text-sm font-bold"
    : "px-2.5 py-1 text-xs font-semibold";

  return (
    <span className={`inline-flex items-center gap-1 font-mono rounded-full border uppercase tracking-wider ${bg} ${sz}`}>
      RISK {score}/100
    </span>
  );
}
