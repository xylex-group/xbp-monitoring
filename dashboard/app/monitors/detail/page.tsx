"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chip, Spinner } from "@heroui/react";
import { getProbeResults, listProbes, listProbeStatuses, triggerProbe } from "@/lib/api";
import type { Probe, ProbeResult, ProbeStatus } from "@/lib/types";
import { EntityDetailHeader } from "@/components/EntityDetailHeader";
import { RunSummaryGrid } from "@/components/RunSummaryGrid";
import { useToast } from "@/components/ToastProvider";
import { ResponseBodyView } from "@/components/ResponseBodyView";

function MonitorDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const monitorName = searchParams.get("name") ?? "";

  const [probe, setProbe] = useState<Probe | null>(null);
  const [status, setStatus] = useState<ProbeStatus | null>(null);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    if (!monitorName) {
      setProbe(null);
      setStatus(null);
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [allProbes, allStatuses, recentResults] = await Promise.all([
        listProbes(),
        listProbeStatuses(),
        getProbeResults(monitorName),
      ]);
      setProbe(allProbes.find((item) => item.name === monitorName) ?? null);
      setStatus(allStatuses.find((item) => item.name === monitorName) ?? null);
      setResults(recentResults);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [monitorName, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = results.length;
    const failed = results.filter((item) => !item.success).length;
    const success = total - failed;
    return { total, failed, success };
  }, [results]);

  async function handleTrigger() {
    if (!monitorName) return;
    setTriggering(true);
    try {
      await triggerProbe(monitorName);
      toast(`"${monitorName}" triggered`, { variant: "success" });
      setTimeout(() => void load(), 1200);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <EntityDetailHeader
        backLabel="Monitors"
        title={monitorName || "Monitor detail"}
        subtitle={probe?.url}
        loading={loading}
        triggering={triggering}
        onBack={() => router.push("/monitors")}
        onRefresh={() => void load()}
        onTrigger={() => void handleTrigger()}
      />

      <RunSummaryGrid
        currentStatus={status?.status}
        total={summary.total}
        success={summary.success}
        failed={summary.failed}
      />

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-default-200 bg-content1 py-24">
          <Spinner size="lg" />
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-content1 p-8 text-center text-default-500 shadow-sm">
          No run history found for this monitor.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((result, idx) => (
            <div key={`${result.timestamp_started}-${idx}`} className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="soft" color={result.success ? "success" : "danger"}>
                    {result.success ? "Success" : "Failure"}
                  </Chip>
                  {result.response && <span className="text-xs text-default-500">HTTP {result.response.status_code}</span>}
                </div>
                <span className="text-xs text-default-500">{new Date(result.timestamp_started).toLocaleString()}</span>
              </div>

              {result.error_message && (
                <p className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{result.error_message}</p>
              )}

              {result.response ? (
                result.response.sensitive ? (
                  <p className="text-xs italic text-default-500">[Response body redacted — sensitive]</p>
                ) : result.response.body ? (
                  <ResponseBodyView body={result.response.body} />
                ) : (
                  <p className="text-xs text-default-500">No response body</p>
                )
              ) : (
                <p className="text-xs text-default-500">No response captured</p>
              )}

              {result.trace_id && (
                <p className="mt-2 font-mono text-[11px] text-default-400">trace_id: {result.trace_id}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MonitorDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center rounded-2xl border border-default-200 bg-content1 py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <MonitorDetailContent />
    </Suspense>
  );
}
