"use client";

import React, { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NoticePreview } from "@/components/legal/NoticePreview";
import { NoticeGeneratorButton } from "@/components/legal/NoticeGeneratorButton";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function NoticeGeneratorPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);

  return (
    <AppShell>
      <div className="workspace-in space-y-6">
        <div className="glass-panel flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/case/${caseId}`}
              className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              title="Back to Graph Workbench"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
                <FileText className="size-5 text-[var(--primary)]" />
                Legal Freeze Notice
              </h1>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Section 94 BNSS · Section 63 BSA Digital Evidence Certificate · {caseId}
              </p>
            </div>
          </div>
          <NoticeGeneratorButton />
        </div>

        <div className="flex justify-center">
          <NoticePreview caseId={caseId} />
        </div>
      </div>
    </AppShell>
  );
}
