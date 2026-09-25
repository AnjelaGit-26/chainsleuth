"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { Send, CheckCircle2, Lock } from "lucide-react";

interface NoticeGeneratorButtonProps {
  onGenerate?: () => void;
  loading?: boolean;
}

export function NoticeGeneratorButton({
  onGenerate,
  loading = false,
}: NoticeGeneratorButtonProps) {
  const { currentRole } = useAppStore();

  if (currentRole === "vasp_nodal_officer") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono rounded select-none">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        <span>VASP Nodal (Read-Only View)</span>
      </div>
    );
  }

  if (currentRole === "supervisory_officer") {
    return (
      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 text-slate-950 font-sans font-bold text-xs rounded transition-colors shadow-lg cursor-pointer"
      >
        <CheckCircle2 className="w-4 h-4" />
        {loading ? "Generating..." : "Approve & Sign Notice"}
      </button>
    );
  }

  // Default: Investigating Officer
  return (
    <button
      type="button"
      onClick={onGenerate}
      disabled={loading}
      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-200 font-sans font-semibold text-xs rounded border border-slate-700 transition-colors shadow-lg cursor-pointer"
    >
      <Send className="w-4 h-4 text-teal-400" />
      {loading ? "Processing..." : "Send for Approval"}
    </button>
  );
}
