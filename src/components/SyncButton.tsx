"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncSpineAction } from "@/app/actions/spine";
import type { SyncReport } from "@/lib/spine";

export default function SyncButton() {
  const [pending, start] = useTransition();
  const [report, setReport] = useState<SyncReport | null>(null);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={() => start(async () => setReport(await syncSpineAction()))}
        disabled={pending}
        className="inline-flex items-center gap-2 text-sm font-medium bg-accent/20 hover:bg-accent/30 border border-accent/30 text-foreground rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Syncing…" : "Sync from systems"}
      </button>
      {report && (
        <span className="text-xs text-muted">
          {report.canonicalMachines} machines · {report.canonicalSites} sites ·{" "}
          {report.machinesUnmatched} unmapped ·{" "}
          {report.systems.filter((s) => s.ok).length}/{report.systems.length} systems reached
        </span>
      )}
    </div>
  );
}
