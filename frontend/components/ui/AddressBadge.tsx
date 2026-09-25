"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface AddressBadgeProps {
  address: string;
  className?: string;
  truncateLength?: number;
}

export function AddressBadge({
  address,
  className = "",
  truncateLength = 4,
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const truncated =
    address.length > truncateLength * 2 + 4
      ? `${address.slice(0, truncateLength)}...${address.slice(-truncateLength)}`
      : address;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-slate-300 hover:border-slate-700 transition-colors select-none group ${className}`}
      title={address}
    >
      <span className="font-semibold text-slate-200">{truncated}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 rounded relative cursor-pointer"
        aria-label="Copy full address"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-200" />
        )}
        {copied && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[9px] rounded whitespace-nowrap shadow-lg">
            Copied!
          </span>
        )}
      </button>
    </span>
  );
}
