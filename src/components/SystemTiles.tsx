"use client";

import { useEffect, useState, useCallback } from "react";
import { Fuel, Boxes, Wrench, Droplet, Box, ExternalLink, RefreshCw } from "lucide-react";

export interface TileSystem {
  key: string;
  name: string;
  description: string;
  icon: string;
  openUrl: string;
}

export interface Kpi {
  label: string;
  value: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
}

export interface TileState {
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
  kpis: Kpi[] | null;
  kpisAt: string | null;
  kpisStale?: boolean;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  fuel: Fuel,
  boxes: Boxes,
  wrench: Wrench,
  droplet: Droplet,
  box: Box,
};

const TONE: Record<string, string> = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
  neutral: "text-foreground",
};

function StatusDot({ state }: { state: TileState | undefined }) {
  if (!state) return <span className="w-2.5 h-2.5 rounded-full bg-gray-500" title="Unknown" />;
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full ${state.ok ? "bg-emerald-400" : "bg-red-400"}`}
      title={state.ok ? "Up" : state.detail || "Down"}
    />
  );
}

function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {kpis.map((k, i) => (
        <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5">
          <div className={`text-lg font-semibold leading-tight ${TONE[k.tone || "neutral"]}`}>
            {k.value}
          </div>
          <div className="text-[11px] text-muted mt-0.5 leading-tight">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function SystemTiles({
  systems,
  initial,
}: {
  systems: TileSystem[];
  initial: Record<string, TileState>;
}) {
  const [states, setStates] = useState<Record<string, TileState>>(initial);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/systems/health", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const next: Record<string, TileState> = {};
      for (const s of data.systems as Array<TileState & { key: string }>) {
        next[s.key] = {
          ok: s.ok,
          latencyMs: s.latencyMs,
          detail: s.detail,
          kpis: s.kpis ?? null,
          kpisAt: s.kpisAt,
          kpisStale: s.kpisStale,
        };
      }
      setStates(next);
      setCheckedAt(data.checkedAt);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold">Systems</h1>
          <p className="text-sm text-muted">Each system keeps its own login. Open one to sign in there.</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-sm text-muted hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString()}` : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {systems.map((sys) => {
          const Icon = ICONS[sys.icon] || Box;
          const state = states[sys.key];
          return (
            <div key={sys.key} className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <div className="font-semibold leading-tight">{sys.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                    <StatusDot state={state} />
                    {state ? (
                      state.ok ? (
                        <span>Up{state.latencyMs != null ? ` · ${state.latencyMs} ms` : ""}</span>
                      ) : (
                        <span>Down{state.detail ? ` · ${state.detail}` : ""}</span>
                      )
                    ) : (
                      <span>Unknown</span>
                    )}
                  </div>
                </div>
              </div>

              {state?.kpis && state.kpis.length > 0 ? (
                <>
                  <KpiGrid kpis={state.kpis} />
                  {state.kpisStale && (
                    <div className="text-[11px] text-amber-400/80 -mt-1">
                      Last known good{state.kpisAt ? ` · ${new Date(state.kpisAt).toLocaleTimeString()}` : ""}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted leading-relaxed flex-1">{sys.description}</p>
              )}

              <a
                href={sys.openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium bg-white/5 hover:bg-white/10 border border-card-border rounded-xl px-4 py-2.5 transition-colors mt-auto"
              >
                Open system <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
