"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { FirGenerationForm } from "@/components/fir/FirGenerationForm";
import { getCase } from "@/lib/api";
import { TraceResult } from "@/lib/types";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export default function FirGenerationPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.caseId;

  const [traceData, setTraceData] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCase(caseId)
      .then((data) => {
        setTraceData(data);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load investigation case data.");
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  return (
    <AppShell>
      <div className="flex flex-col space-y-4 font-mono text-xs select-none max-w-4xl mx-auto pb-10">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <Link
            href={`/case/${caseId}`}
            className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 font-sans text-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Case Workbench ({caseId})
          </Link>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-slate-950 border border-slate-800 rounded">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <div className="text-slate-400">Loading case metadata...</div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/80 border border-red-800 rounded text-red-200 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
            <div>{error}</div>
          </div>
        ) : (
          <div className="flex justify-center">
            <FirGenerationForm
              initialCaseId={caseId}
              initialSuspectAddress={traceData?.suspect_address || ""}
              chain={traceData?.chain || "tron"}
              onSuccess={() => {
                getCase(caseId).then((data) => setTraceData(data)).catch(() => {});
              }}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
