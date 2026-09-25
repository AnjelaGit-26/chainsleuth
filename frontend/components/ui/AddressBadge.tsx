"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface AddressBadgeProps {
  address: string;
  className?: string;
  truncateLength?: number;
}

export function AddressBadge({ address, className = "", truncateLength = 4 }: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;

  const truncated =
    address.length > truncateLength * 2 + 4
      ? `${address.slice(0, truncateLength)}…${address.slice(-truncateLength)}`
      : address;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 font-mono text-xs rounded-full border border-[color-mix(in_oklab,var(--border)_60%,transparent)] bg-white/60 px-2.5 py-0.5 text-[var(--foreground)] group select-none ${className}`}
      title={address}
    >
      <span className="font-semibold">{truncated}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors p-0.5 rounded cursor-pointer"
        aria-label="Copy full address"
      >
        {copied ? (
          <Check className="size-3 text-[var(--primary)]" />
        ) : (
          <Copy className="size-3 group-hover:text-[var(--primary)]" />
        )}
      </button>
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--foreground)] px-2 py-0.5 text-[9px] text-white shadow-lg">
          Copied!
        </span>
      )}
    </span>
  );
}
