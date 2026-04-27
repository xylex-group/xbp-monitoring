"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Chip, Spinner, Table } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { listProbeStatuses, getProbeResults } from "@/lib/api";
import type { ProbeResult, ProbeStatus } from "@/lib/types";
import { ResultsDrawer } from "@/components/ResultsDrawer";
import { useToast } from "@/components/ToastProvider";

const STATUS_COLOR = {
  OK: "success",
  FAILING: "danger",
  PENDING: "warning",
} as const;

const STATUS_ICON = {
  OK: "gravity-ui:circle-check-fill",
  FAILING: "gravity-ui:circle-xmark-fill",
  PENDING: "gravity-ui:circle-dashed",
} as const;

interface RecentResult {
  probeName: string;
  result: ProbeResult;
}

const STATUS_STYLES = {
  OK: {
    iconClass: "text-success",
    chipColor: "success" as const,
    toneClass: "bg-success/10 border-success/30",
  },
  FAILING: {
    iconClass: "text-danger",
    chipColor: "danger" as const,
    toneClass: "bg-danger/10 border-danger/30",
  },
  PENDING: {
    iconClass: "text-warning",
    chipColor: "warning" as const,
    toneClass: "bg-warning/10 border-warning/30",
  },
};

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

  return (
    <div className="flex flex-col gap-8 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted mt-0.5">
            Real-time health of all HTTP probes
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button variant="ghost" onPress={load}>
          <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Total Monitors",
                value: stats.total,
                icon: "gravity-ui:pulse",
                color: "text-foreground",
                bg: "bg-default/10",
              },
              {
                label: "Healthy",
                value: stats.ok,
                icon: STATUS_ICON.OK,
                color: "text-success",
                bg: "bg-success/10",
              },
              {
                label: "Failing",
                value: stats.failing,
                icon: STATUS_ICON.FAILING,
                color: "text-danger",
                bg: "bg-danger/10",
              },
              {
                label: "Pending",
                value: stats.pending,
                icon: STATUS_ICON.PENDING,
                color: "text-warning",
                bg: "bg-warning/10",
              },
            ].map(({ label, value, icon, color, bg }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-surface p-5 flex items-center gap-4 shadow-sm"
              >
                <div className={`rounded-lg p-2.5 ${bg}`}>
                  <Icon icon={icon} className={`size-5 ${color}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold leading-none tabular-nums">{value}</p>
                  <p className="text-xs text-muted mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Health bar */}
          <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Health</span>
              <span
                className={`text-sm font-bold ${
                  healthPct === 100
                    ? "text-success"
                    : healthPct >= 80
                    ? "text-warning"
                    : "text-danger"
                }`}
              >
                {healthPct}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  healthPct === 100
                    ? "bg-success"
                    : healthPct >= 80
                    ? "bg-warning"
                    : "bg-danger"
                }`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
            {stats.failing > 0 && (
              <p className="text-xs text-danger">
                {stats.failing} monitor{stats.failing > 1 ? "s are" : " is"} currently failing
              </p>
            )}
          </div>

          {/* All monitors table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">All Monitors</h2>
              <Link href="/monitors">
                <Button size="sm" variant="ghost">
                  Manage
                  <Icon icon="gravity-ui:arrow-right" className="size-3" />
                </Button>
              </Link>
            </div>

            {statuses.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
                <Icon
                  icon="gravity-ui:pulse"
                  className="size-8 text-muted mx-auto mb-3"
                />
                <p className="text-sm text-muted">No monitors configured yet.</p>
                <Link href="/monitors">
                  <Button size="sm" className="mt-3">
                    Add Monitor
                  </Button>
                </Link>
              </div>
            ) : (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Monitor status" className="min-w-[560px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Monitor</Table.Column>
                      <Table.Column>Status</Table.Column>
                      <Table.Column>Last Probed</Table.Column>
                      <Table.Column className="text-end">Details</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {statuses.map((s) => (
                        <Table.Row key={s.name} id={s.name}>
                          <Table.Cell className="font-medium">{s.name}</Table.Cell>
                          <Table.Cell>
                            <div className="flex items-center gap-2">
                              <Icon
                                icon={STATUS_ICON[s.status]}
                                className={`size-4 ${STATUS_STYLES[s.status].iconClass}`}
                              />
                              <Chip
                                size="sm"
                                variant="soft"
                                color={STATUS_STYLES[s.status].chipColor}
                              >
                                {s.status}
                              </Chip>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="text-xs text-muted">
                            {s.last_probed
                              ? new Date(s.last_probed).toLocaleString()
                              : "Never"}
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex justify-end">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                onPress={() => setResultsProbe(s.name)}
                              >
                                <Icon icon="gravity-ui:eye" className="size-4" />
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </div>

          {/* Failing probes — last error */}
          {recentResults.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-semibold text-danger">Recent Failures</h2>
              <div className="flex flex-col gap-3">
                {recentResults.map(({ probeName, result }) => (
                  <div
                    key={probeName}
                    className={`rounded-2xl border p-4 flex flex-col gap-2 shadow-sm ${STATUS_STYLES.FAILING.toneClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon
                          icon={STATUS_ICON.FAILING}
                          className="size-4 text-danger"
                        />
                        <span className="font-medium text-sm">{probeName}</span>
                      </div>
                      <span className="text-xs text-muted">
                        {new Date(result.timestamp_started).toLocaleString()}
                      </span>
                    </div>
                    {result.error_message && (
                      <p className="text-xs text-danger font-mono bg-danger/10 rounded-lg px-3 py-2">
                        {result.error_message}
                      </p>
                    )}
                    {result.response && (
                      <p className="text-xs text-muted">
                        HTTP {result.response.status_code}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setResultsProbe(probeName)}
                      >
                        View all results
                        <Icon icon="gravity-ui:arrow-right" className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Results drawer (shared) */}
      <ResultsDrawer
        probeName={resultsProbe}
        onClose={() => setResultsProbe(null)}
      />
    </div>
  );
}
