"use client";

import React from "react";

interface RiskBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ score, size = "md" }: RiskBadgeProps) {
  let colorClasses = "bg-slate-900 text-slate-400 border-slate-800";
  if (score >= 75) {
    colorClasses = "bg-red-950/60 text-red-400 border-red-800/80";
  } else if (score >= 50) {
    colorClasses = "bg-amber-950/60 text-amber-400 border-amber-800/80";
  } else if (score > 0) {
    colorClasses = "bg-teal-950/60 text-teal-400 border-teal-800/80";
  }

  const sizeClasses =
    size === "sm"
      ? "text-xs px-1.5 py-0.5"
      : size === "lg"
      ? "text-base px-3 py-1 font-bold"
      : "text-xs px-2.5 py-1 font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono rounded border uppercase tracking-wider ${colorClasses} ${sizeClasses}`}
    >
      <span>RISK {score}/100</span>
    </span>
  );
}
