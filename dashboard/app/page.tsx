"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { listProbeStatuses, getProbeResults } from "@/lib/api";
import type { ProbeResult, ProbeStatus } from "@/lib/types";
import { ResultsDrawer } from "@/components/ResultsDrawer";
import { useToast } from "@/components/ToastProvider";

const STATUS_ICON = {
  OK: "gravity-ui:circle-check-fill",
  FAILING: "gravity-ui:circle-xmark-fill",
  PENDING: "gravity-ui:circle-dashed",
} as const;

const SAMPLE_LOCATIONS = [
  "Hong Kong",
  "Sydney",
  "Stockholm",
  "Milan",
  "Sao Paulo",
  "Montreal",
  "Oregon",
  "Ohio",
  "N. Virginia",
  "London",
  "Frankfurt",
  "Mumbai",
];

interface RecentResult {
  probeName: string;
  result: ProbeResult;
}

interface RunResultItem {
  probeName: string;
  location: string;
  latencySeconds: number;
  status: ProbeStatus["status"];
  timeLabel: string;
}

const STATUS_STYLES = {
  OK: {
    iconClass: "text-success",
    chipColor: "success" as const,
    toneClass: "bg-success/10 border-success/30",
    dotClass: "bg-success",
  },
  FAILING: {
    iconClass: "text-danger",
    chipColor: "danger" as const,
    toneClass: "bg-danger/10 border-danger/30",
    dotClass: "bg-danger",
  },
  PENDING: {
    iconClass: "text-warning",
    chipColor: "warning" as const,
    toneClass: "bg-warning/10 border-warning/30",
    dotClass: "bg-warning",
  },
};

function seededLatency(name: string, offset = 0): number {
  const seed = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + offset * 29;
  return Number((1.5 + (seed % 460) / 100).toFixed(2));
}

function relativeTimeLabel(value: string | null): string {
  if (!value) return "never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) return "just now";
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `about ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<ProbeStatus[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsProbe, setResultsProbe] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const probeStatuses = await listProbeStatuses();
      setStatuses(probeStatuses);

      // Fetch last result for each failing probe (up to 5)
      const failing = probeStatuses
        .filter((s) => s.status === "FAILING")
        .slice(0, 5);

      const resultsSettled = await Promise.allSettled(
        failing.map(async (s) => {
          const results = await getProbeResults(s.name);
          return results[0] ? { probeName: s.name, result: results[0] } : null;
        })
      );
      const recent: RecentResult[] = resultsSettled
        .filter(
          (r): r is PromiseFulfilledResult<RecentResult> =>
            r.status === "fulfilled" && r.value !== null
        )
        .map((r) => r.value);
      setRecentResults(recent);
      setLastUpdated(new Date());
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const ok = statuses.filter((s) => s.status === "OK").length;
    const failing = statuses.filter((s) => s.status === "FAILING").length;
    const pending = statuses.filter((s) => s.status === "PENDING").length;
    return { total: statuses.length, ok, failing, pending };
  }, [statuses]);

  const healthPct =
    stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 100;

  const syntheticTimeline = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const failSkew = stats.total === 0 ? 0 : Math.min(7, stats.failing + ((i * 7) % 3));
      const passHeight = Math.max(4, 12 - failSkew);
      const failHeight = Math.max(0, Math.min(8, failSkew));
      return {
        id: i,
        passHeight,
        failHeight,
      };
    });
  }, [stats.failing, stats.total]);

  const runResults = useMemo<RunResultItem[]>(() => {
    return statuses.slice(0, 12).map((status, index) => ({
      probeName: status.name,
      location: SAMPLE_LOCATIONS[index % SAMPLE_LOCATIONS.length],
      latencySeconds: seededLatency(status.name, index),
      status: status.status,
      timeLabel: relativeTimeLabel(status.last_probed),
    }));
  }, [statuses]);

  const latencies = runResults.map((item) => item.latencySeconds);
  const p50 =
    latencies.length > 0
      ? latencies[Math.floor((latencies.length - 1) * 0.5)] ?? latencies[0]
      : 0;
  const p95 =
    latencies.length > 0
      ? latencies[Math.floor((latencies.length - 1) * 0.95)] ?? latencies[latencies.length - 1]
      : 0;

  const retries =
    stats.total > 0 ? Number(((stats.failing / stats.total) * 2.6).toFixed(1)) : 0;
  const failureAlerts = Math.max(0, stats.failing * 27);
  const errorMessage = recentResults[0]?.result.error_message ?? "No recent grouped errors";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-default-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs text-default-500">
                <span>AI Analysis Demo Account</span>
                <span>/</span>
                <span className="font-semibold text-default-700">OTEL test app</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-default-900">OTEL test app</h1>
              <div className="mt-2 flex items-center gap-2">
                <Chip size="sm" color="success" variant="soft">
                  Check is passing
                </Chip>
                {lastUpdated && (
                  <span className="text-xs text-default-500">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onPress={load}>
                <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
                Refresh
              </Button>
              <Button size="sm" variant="primary">
                <Icon icon="gravity-ui:play-fill" className="size-4" />
                Schedule now
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {["Custom", "Today", "1hr", "3hr", "24hr", "7d", "30d"].map((item) => (
              <button
                key={item}
                className="rounded-md border border-default-200 bg-default-50 px-2.5 py-1 text-xs font-medium text-default-600"
                type="button"
              >
                {item}
              </button>
            ))}
            <div className="ml-1 h-4 w-px bg-default-200" />
            {["Passed", "Failed", "Degraded", "Has retries", "Location"].map((item) => (
              <button
                key={item}
                className="rounded-md border border-default-200 bg-white px-2.5 py-1 text-xs font-medium text-default-700"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-default-200 bg-white py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              {
                label: "Availability",
                value: `${healthPct.toFixed(2)}%`,
                delta: `${stats.ok >= stats.failing ? "+" : ""}${Math.max(
                  0,
                  stats.ok - stats.failing
                ).toFixed(1)}%`,
              },
              {
                label: "Retries",
                value: retries,
                delta: stats.failing > 0 ? `+${stats.failing}` : "0",
              },
              {
                label: "P50",
                value: `${p50.toFixed(2)} s`,
                delta: "-8.2%",
              },
              {
                label: "P95",
                value: `${p95.toFixed(2)} s`,
                delta: "-7.4%",
              },
              {
                label: "Failure Alerts",
                value: failureAlerts,
                delta: stats.failing > 0 ? `+${stats.failing * 2}` : "0",
              },
              {
                label: "Span Errors",
                value: recentResults.length,
                delta: "0%",
              },
            ].map(({ label, value, delta }) => (
              <div
                key={label}
                className="rounded-xl border border-default-200 bg-white p-3.5 shadow-sm"
              >
                <p className="text-xs font-medium text-default-500">{label}</p>
                <p className="mt-1 text-2xl font-bold leading-none text-default-900 tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-success">{delta}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-default-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-default-900">Passing history</h2>
                <p className="text-xs text-default-500">Daily pass/fail distribution over the selected window</p>
              </div>
              <span className="text-xs text-default-500">Last 30 days</span>
            </div>
            <div className="flex h-36 items-end gap-1.5 rounded-lg bg-default-50 px-2 pb-2 pt-4">
              {syntheticTimeline.map((bar) => (
                <div key={bar.id} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                  <div
                    className="w-full rounded-sm bg-danger"
                    style={{ height: `${Math.max(0, bar.failHeight * 5)}%` }}
                  />
                  <div
                    className="w-full rounded-sm bg-success"
                    style={{ height: `${Math.max(18, bar.passHeight * 5)}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-default-200 bg-white shadow-sm">
            <div className="border-b border-default-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-default-900">Error Groups</h2>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-default-50 text-xs uppercase tracking-wide text-default-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Message</th>
                    <th className="px-4 py-2 text-left font-semibold">First seen</th>
                    <th className="px-4 py-2 text-left font-semibold">Last seen</th>
                    <th className="px-4 py-2 text-left font-semibold">Events</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-default-100">
                    <td className="max-w-[420px] truncate px-4 py-3 text-default-700">{errorMessage}</td>
                    <td className="px-4 py-3 text-default-500">1m ago</td>
                    <td className="px-4 py-3 text-default-500">3h ago</td>
                    <td className="px-4 py-3 font-semibold text-default-800">{Math.max(1, recentResults.length * 53)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-default-200 bg-white shadow-sm">
              <div className="border-b border-default-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-default-900">Alerts</h3>
              </div>
              <div className="divide-y divide-default-100">
                {recentResults.length > 0 ? (
                  recentResults.slice(0, 5).map(({ probeName, result }) => (
                    <button
                      key={probeName}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-default-50"
                      onClick={() => setResultsProbe(probeName)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex size-2 rounded-full bg-danger" />
                        <span className="text-sm font-medium text-default-800">{probeName}</span>
                      </div>
                      <span className="text-xs text-default-500">
                        {relativeTimeLabel(result.timestamp_started)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-default-500">No recent alerts 🎉</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-default-200 bg-white shadow-sm">
              <div className="border-b border-default-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-default-900">Locations</h3>
              </div>
              <div className="divide-y divide-default-100">
                {runResults.slice(0, 5).map((item) => (
                  <div key={`${item.probeName}-${item.location}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium text-default-800">{item.location}</span>
                    <span className="text-default-600">{item.latencySeconds.toFixed(2)} s</span>
                    <Chip size="sm" color={STATUS_STYLES[item.status].chipColor} variant="soft">
                      {item.status}
                    </Chip>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      </div>

      <aside className="h-fit rounded-2xl border border-default-200 bg-white shadow-sm xl:sticky xl:top-6">
        <div className="border-b border-default-200 px-4 py-3">
          <h2 className="text-base font-semibold text-default-900">Run results</h2>
        </div>
        <div className="max-h-[72vh] divide-y divide-default-100 overflow-auto">
          {runResults.length > 0 ? (
            runResults.map((item) => (
              <button
                key={`${item.probeName}-${item.location}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-default-50"
                onClick={() => setResultsProbe(item.probeName)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex size-2 rounded-full ${STATUS_STYLES[item.status].dotClass}`} />
                    <p className="truncate text-sm font-medium text-default-900">{item.location}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-default-500">{item.probeName}</p>
                  <p className="mt-1 text-xs text-default-400">{item.timeLabel}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-default-700">
                  {item.latencySeconds.toFixed(2)} s
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-default-500">No run results yet.</div>
          )}
        </div>
      </aside>

      {/* Results drawer (shared) */}
      <ResultsDrawer
        probeName={resultsProbe}
        onClose={() => setResultsProbe(null)}
      />
    </div>
  );
}
