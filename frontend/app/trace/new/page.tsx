"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TraceForm } from "@/components/intake/TraceForm";
import { ShieldAlert } from "lucide-react";

export default function NewTracePage() {
  return (
    <AppShell>
      <div className="space-y-4 font-mono text-xs select-none">
        <div className="border-b border-slate-800 pb-3">
          <h1 className="text-base font-bold font-sans text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-teal-400" />
            New Trace Intake
          </h1>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            Initiate multi-hop asset investigation from suspect address or raw FIR complaint narrative
          </p>
        </div>

        <div className="flex justify-center pt-2">
          <TraceForm />
        </div>
      </div>
    </AppShell>
  );
}
