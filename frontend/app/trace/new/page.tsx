"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TraceForm } from "@/components/intake/TraceForm";
import { Plus } from "lucide-react";

export default function NewTracePage() {
  return (
    <AppShell>
      <div className="workspace-in space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Plus className="size-6 text-[var(--primary)]" />
            New Investigation
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Initiate multi-hop blockchain asset tracing from a suspect wallet address or raw FIR complaint narrative
          </p>
        </div>
        <div className="flex justify-center">
          <TraceForm />
        </div>
      </div>
    </AppShell>
  );
}
