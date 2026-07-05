"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Download } from "lucide-react";
import { ingestCostsAction } from "@/app/actions/costs";
import type { IngestReport } from "@/lib/costs";

export default function ProfitControls({ month }: { month: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [report, setReport] = useState<IngestReport | null>(null);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <input
        type="month"
        defaultValue={month}
        onChange={(e) => {
          if (e.target.value) router.push(`/profit?month=${e.target.value}`);
        }}
        className="bg-[#1b2230] border border-card-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50"
      />
      <button
        onClick={() =>
          start(async () => {
            const r = await ingestCostsAction(month);
            setReport(r);
            router.refresh();
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-2 text-sm font-medium bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Ingesting…" : "Ingest this month"}
      </button>
      <a
        href={`/api/profit/export?month=${month}`}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground border border-card-border rounded-xl px-3 py-2"
      >
        <Download className="w-4 h-4" /> CSV
      </a>
      {report && (
        <span className="text-xs text-muted">
          {report.costEvents} cost · {report.incomeEvents} income ·{" "}
          {report.systems.filter((s) => s.ok).length}/{report.systems.length} systems
        </span>
      )}
    </div>
  );
}
