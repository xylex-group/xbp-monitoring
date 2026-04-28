"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getProbeResults } from "@/lib/api";
import type { ProbeResult } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";

function EventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const probeName = searchParams.get("probe") ?? "";

  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!probeName) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getProbeResults(probeName);
      setResults(data);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [probeName, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = results.length;
    const success = results.filter((item) => item.success).length;
    const failed = total - success;
    return { total, success, failed };
  }, [results]);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-default-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-default-500">
              <button
                type="button"
                className="hover:text-default-700"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </button>
              <span>/</span>
              <span className="font-semibold text-default-700">Events</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-default-900">
              {probeName ? `${probeName} — Event Drilldown` : "Event Drilldown"}
            </h1>
            <p className="mt-1 text-sm text-default-500">All recorded requests and responses for this probe.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onPress={() => router.push("/dashboard")}>
              <Icon icon="gravity-ui:arrow-left" className="size-4" />
              Back
            </Button>
            <Button variant="primary" onPress={load}>
              <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 md:max-w-xl">
          <div className="rounded-xl border border-default-200 bg-default-50 p-3">
            <p className="text-xs text-default-500">Total events</p>
            <p className="text-xl font-bold text-default-900">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-default-200 bg-success/5 p-3">
            <p className="text-xs text-default-500">Successful</p>
            <p className="text-xl font-bold text-success">{summary.success}</p>
          </div>
          <div className="rounded-xl border border-default-200 bg-danger/5 p-3">
            <p className="text-xs text-default-500">Failed</p>
            <p className="text-xl font-bold text-danger">{summary.failed}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-default-200 bg-white py-24">
          <Spinner size="lg" />
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-default-200 bg-white p-8 text-center text-default-500 shadow-sm">
          No events found for this probe.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((result, idx) => (
            <div key={`${result.timestamp_started}-${idx}`} className="rounded-xl border border-default-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="soft" color={result.success ? "success" : "danger"}>
                    {result.success ? "Success" : "Failure"}
                  </Chip>
                  {result.response && (
                    <span className="text-xs text-default-500">HTTP {result.response.status_code}</span>
                  )}
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
                  <pre className="max-h-52 overflow-auto rounded-lg bg-default-50 p-3 text-xs whitespace-pre-wrap">
                    {result.response.body}
                  </pre>
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

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center rounded-2xl border border-default-200 bg-white py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <EventsPageContent />
    </Suspense>
  );
}
