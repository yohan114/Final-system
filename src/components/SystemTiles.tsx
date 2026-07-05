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

export interface TileStatus {
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  fuel: Fuel,
  boxes: Boxes,
  wrench: Wrench,
  droplet: Droplet,
  box: Box,
};

function StatusDot({ status }: { status: TileStatus | undefined }) {
  if (!status) {
    return <span className="w-2.5 h-2.5 rounded-full bg-gray-500" title="Unknown" />;
  }
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full ${status.ok ? "bg-emerald-400" : "bg-red-400"}`}
      title={status.ok ? "Up" : status.detail || "Down"}
    />
  );
}

export default function SystemTiles({
  systems,
  initial,
}: {
  systems: TileSystem[];
  initial: Record<string, TileStatus>;
}) {
  const [statuses, setStatuses] = useState<Record<string, TileStatus>>(initial);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/systems/health", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const next: Record<string, TileStatus> = {};
      for (const s of data.systems as Array<{ key: string; ok: boolean; latencyMs: number | null; detail: string | null }>) {
        next[s.key] = { ok: s.ok, latencyMs: s.latencyMs, detail: s.detail };
      }
      setStatuses(next);
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
          <p className="text-sm text-muted">
            Each system keeps its own login. Open one to sign in there.
          </p>
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
          const status = statuses[sys.key];
          return (
            <div
              key={sys.key}
              className="bg-card border border-card-border rounded-2xl p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <div className="font-semibold leading-tight">{sys.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                      <StatusDot status={status} />
                      {status ? (
                        status.ok ? (
                          <span>Up{status.latencyMs != null ? ` · ${status.latencyMs} ms` : ""}</span>
                        ) : (
                          <span>Down{status.detail ? ` · ${status.detail}` : ""}</span>
                        )
                      ) : (
                        <span>Unknown</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted leading-relaxed flex-1">{sys.description}</p>

              <a
                href={sys.openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium bg-white/5 hover:bg-white/10 border border-card-border rounded-xl px-4 py-2.5 transition-colors"
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
