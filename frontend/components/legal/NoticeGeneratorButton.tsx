"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { Send, CheckCircle2 } from "lucide-react";

interface NoticeGeneratorButtonProps {
  onGenerate?: () => void;
}

export function NoticeGeneratorButton({ onGenerate }: NoticeGeneratorButtonProps) {
  const { role } = useAppStore();

  if (role === "supervisory_officer") {
    return (
      <button
        type="button"
        onClick={onGenerate}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
      >
        <CheckCircle2 className="size-4" />
        Approve &amp; Sign Notice
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onGenerate}
      className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] transition-colors cursor-pointer"
    >
      <Send className="size-4" />
      Send for Approval
    </button>
  );
}
