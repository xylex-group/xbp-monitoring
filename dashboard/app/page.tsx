"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Button,
  Chip,
  Label,
  Meter,
  ProgressBar,
  ProgressCircle,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { listProbeStatuses, getProbeResults, listProbes } from "@/lib/api";
import type { Probe, ProbeResult, ProbeStatus } from "@/lib/types";
import { ResultsDrawer } from "@/components/ResultsDrawer";
import { useToast } from "@/components/ToastProvider";
import { usePollingLoader } from "@/lib/hooks/usePollingLoader";
import { useSharedBackendReadiness } from "@/components/BackendReadinessProvider";
import {
  STATUS_STYLES,
  buildNamedEntityMap,
  countMonitorStatuses,
  relativeTimeLabel,
} from "@/lib/monitoring-ui";

interface RecentResult {
  probeName: string;
  result: ProbeResult;
}

interface RunResultItem {
  probeName: string;
  endpoint: string;
  status: ProbeStatus["status"];
  timeLabel: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<ProbeStatus[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsProbe, setResultsProbe] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadingRef = useRef(false);
  const { ready: backendReady, hasChecked: backendHasChecked } = useSharedBackendReadiness();

  const load = useCallback(
    async () => {
      if (loadingRef.current) return;

      loadingRef.current = true;

      try {
        const [probeStatuses, probeList] = await Promise.all([
          listProbeStatuses(),
          listProbes(),
        ]);
        setStatuses(probeStatuses);
        setProbes(probeList);

        // Fetch last result for each failing probe (up to 5)
        const failing = probeStatuses
          .filter((s) => s.status === "FAILING")
          .slice(0, 5);

        const recent: RecentResult[] = [];
        for (const s of failing) {
          try {
            const results = await getProbeResults(s.name);
            if (results[0]) {
              recent.push({ probeName: s.name, result: results[0] });
            }
          } catch {
            // Keep dashboard responsive even when one probe result request fails.
          }
        }

        setRecentResults(recent);
        setLastUpdated(new Date());
      } catch (err) {
        toast(String(err), { variant: "danger" });
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [toast],
  );

  const { reload } = usePollingLoader(load, {
    minIntervalMs: 2_500,
    enabled: backendReady,
  });

  const stats = useMemo(() => countMonitorStatuses(statuses), [statuses]);

  const healthPct =
    stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 100;

  const distribution = useMemo(() => {
    if (stats.total === 0) {
      return { ok: 0, failing: 0, pending: 0 };
    }

    return {
      ok: Math.round((stats.ok / stats.total) * 100),
      failing: Math.round((stats.failing / stats.total) * 100),
      pending: Math.round((stats.pending / stats.total) * 100),
    };
  }, [stats.total, stats.ok, stats.failing, stats.pending]);

  const probeByName = useMemo(() => buildNamedEntityMap(probes), [probes]);

  const runResults = useMemo<RunResultItem[]>(() => {
    return statuses.slice(0, 12).map((status) => ({
      probeName: status.name,
      endpoint: probeByName[status.name]?.url ?? "Unknown endpoint",
      status: status.status,
      timeLabel: relativeTimeLabel(status.last_probed),
    }));
  }, [statuses, probeByName]);

  const errorMessage =
    recentResults[0]?.result.error_message ?? "No recent grouped errors";
  const primaryErrorProbe = recentResults[0]?.probeName ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-default-900">
                Synthetic monitoring
              </h1>
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
              <Button variant="ghost" size="sm" onPress={reload}>
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
            {["Custom", "Today", "1hr", "3hr", "24hr", "7d", "30d"].map(
              (item) => (
                <button
                  key={item}
                  className="rounded-md border border-default-200 bg-default-50 px-2.5 py-1 text-xs font-medium text-default-600"
                  type="button"
                >
                  {item}
                </button>
              ),
            )}
            <div className="ml-1 h-4 w-px bg-default-200" />
            {["Passed", "Failed", "Degraded", "Has retries", "Location"].map(
              (item) => (
                <button
                  key={item}
                  className="rounded-md border border-default-200 bg-content1 px-2.5 py-1 text-xs font-medium text-default-700"
                  type="button"
                >
                  {item}
                </button>
              ),
            )}
          </div>
        </div>

        {loading || !backendReady ? (
          <div className="flex justify-center rounded-2xl border border-default-200 bg-content1 py-24">
            <div className="flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-xs text-default-500">
                {!backendHasChecked
                  ? "Checking backend readiness..."
                  : "Waiting for backend startup (Docker compile in progress)."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: "Availability",
                  value: `${healthPct.toFixed(2)}%`,
                  delta: `${stats.ok}/${Math.max(1, stats.total)} healthy`,
                },
                {
                  label: "Monitors",
                  value: stats.total,
                  delta: "Configured",
                },
                {
                  label: "Healthy",
                  value: stats.ok,
                  delta: "Passing",
                },
                {
                  label: "Failing",
                  value: stats.failing,
                  delta: "Needs attention",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  delta: "Waiting first run",
                },
                {
                  label: "Recent Alerts",
                  value: recentResults.length,
                  delta: "Last polling window",
                },
              ].map(({ label, value, delta }) => (
                <div
                  key={label}
                  className="rounded-xl border border-default-200 bg-content1 p-3.5 shadow-sm"
                >
                  <p className="text-xs font-medium text-default-500">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-bold leading-none text-default-900 tabular-nums">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-default-500">{delta}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-default-900">Health ring</h2>
                <p className="mt-1 text-xs text-default-500">Overall uptime across monitors</p>

                <div className="mt-4 flex items-center justify-center">
                  <div className="relative">
                    <ProgressCircle
                      aria-label="Overall health"
                      value={healthPct}
                      color={healthPct >= 90 ? "success" : healthPct >= 70 ? "warning" : "danger"}
                      size="lg"
                    >
                      <ProgressCircle.Track>
                        <ProgressCircle.TrackCircle />
                        <ProgressCircle.FillCircle />
                      </ProgressCircle.Track>
                    </ProgressCircle>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="text-base font-semibold text-default-900 tabular-nums">
                        {healthPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm lg:col-span-2">
                <h2 className="text-sm font-semibold text-default-900">Status distribution</h2>
                <p className="mt-1 text-xs text-default-500">Healthy vs failing vs pending monitors</p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <ProgressBar aria-label="Healthy" className="w-full" color="success" value={distribution.ok}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <Label>Healthy</Label>
                      <ProgressBar.Output />
                    </div>
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>

                  <ProgressBar aria-label="Failing" className="w-full" color="danger" value={distribution.failing}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <Label>Failing</Label>
                      <ProgressBar.Output />
                    </div>
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>

                  <Meter aria-label="Pending" className="w-full" color="warning" value={distribution.pending}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <Label>Pending</Label>
                      <Meter.Output />
                    </div>
                    <Meter.Track>
                      <Meter.Fill />
                    </Meter.Track>
                  </Meter>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-default-200 bg-content1 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-default-900">
                    Current monitor status
                  </h2>
                  <p className="text-xs text-default-500">
                    Live endpoint status from configured probes
                  </p>
                </div>
                <span className="text-xs text-default-500">
                  {runResults.length} showing
                </span>
              </div>
              <div className="space-y-2">
                {runResults.slice(0, 8).map((item) => (
                  <div
                    key={`${item.probeName}-${item.endpoint}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-default-100 px-3 py-2"
                  >
                    <span
                      className={`inline-flex size-2 rounded-full ${STATUS_STYLES[item.status].dotClass}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-default-900">
                        {item.probeName}
                      </p>
                      <p className="truncate text-xs text-default-500">
                        {item.endpoint}
                      </p>
                    </div>
                    <Chip
                      size="sm"
                      color={STATUS_STYLES[item.status].chipColor}
                      variant="soft"
                    >
                      {item.status}
                    </Chip>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-default-200 bg-content1 shadow-sm">
              <div className="border-b border-default-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-default-900">
                  Error Groups
                </h2>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-default-50 text-xs uppercase tracking-wide text-default-500">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">
                        Message
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        First seen
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        Last seen
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        Events
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      className={`border-t border-default-100 ${primaryErrorProbe ? "cursor-pointer hover:bg-default-50" : ""}`}
                      onClick={() => {
                        if (!primaryErrorProbe) return;
                        router.push(
                          `/dashboard/events?probe=${encodeURIComponent(primaryErrorProbe)}`,
                        );
                      }}
                    >
                      <td className="max-w-[420px] truncate px-4 py-3 text-default-700">
                        {errorMessage}
                      </td>
                      <td className="px-4 py-3 text-default-500">1m ago</td>
                      <td className="px-4 py-3 text-default-500">3h ago</td>
                      <td className="px-4 py-3 font-semibold text-default-800">
                        {Math.max(1, recentResults.length * 53)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-default-200 bg-content1 shadow-sm">
                <div className="border-b border-default-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-default-900">
                    Alerts
                  </h3>
                </div>
                <div className="divide-y divide-default-100">
                  {recentResults.length > 0 ? (
                    recentResults.slice(0, 5).map(({ probeName, result }) => (
                      <button
                        key={probeName}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-default-50"
                        onClick={() =>
                          router.push(
                            `/dashboard/events?probe=${encodeURIComponent(probeName)}`,
                          )
                        }
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex size-2 rounded-full bg-danger" />
                          <span className="text-sm font-medium text-default-800">
                            {probeName}
                          </span>
                        </div>
                        <span className="text-xs text-default-500">
                          {relativeTimeLabel(result.timestamp_started)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-default-500">
                      No recent alerts 🎉
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-default-200 bg-content1 shadow-sm">
                <div className="border-b border-default-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-default-900">
                    Endpoints
                  </h3>
                </div>
                <div className="divide-y divide-default-100">
                  {runResults.slice(0, 5).map((item) => (
                    <div
                      key={`${item.probeName}-${item.endpoint}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-default-800">
                          {item.probeName}
                        </p>
                        <p className="truncate text-xs text-default-500">
                          {item.endpoint}
                        </p>
                      </div>
                      <Chip
                        size="sm"
                        color={STATUS_STYLES[item.status].chipColor}
                        variant="soft"
                      >
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

      <aside className="h-fit rounded-2xl border border-default-200 bg-content1 shadow-sm xl:sticky xl:top-6">
        <div className="border-b border-default-200 px-4 py-3">
          <h2 className="text-base font-semibold text-default-900">
            Run results
          </h2>
        </div>
        <div className="max-h-[72vh] divide-y divide-default-100 overflow-auto">
          {runResults.length > 0 ? (
            runResults.map((item) => (
              <button
                key={`${item.probeName}-${item.endpoint}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-default-50"
                onClick={() => setResultsProbe(item.probeName)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex size-2 rounded-full ${STATUS_STYLES[item.status].dotClass}`}
                    />
                    <p className="truncate text-sm font-medium text-default-900">
                      {item.probeName}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-default-500">
                    {item.endpoint}
                  </p>
                  <p className="mt-1 text-xs text-default-400">
                    {item.timeLabel}
                  </p>
                </div>
                <Chip
                  size="sm"
                  color={STATUS_STYLES[item.status].chipColor}
                  variant="soft"
                >
                  {item.status}
                </Chip>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-sm text-default-500">
              No run results yet.
            </div>
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
