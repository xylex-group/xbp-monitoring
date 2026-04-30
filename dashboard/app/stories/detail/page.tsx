"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chip, Spinner } from "@heroui/react";
import { getFullConfig, getStoryResults, listStories, triggerStory } from "@/lib/api";
import type { Story, StoryResult, StoryStatus } from "@/lib/types";
import { EntityDetailHeader } from "@/components/EntityDetailHeader";
import { RunSummaryGrid } from "@/components/RunSummaryGrid";
import { useToast } from "@/components/ToastProvider";

function StoryDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const storyName = searchParams.get("name") ?? "";

  const [story, setStory] = useState<Story | null>(null);
  const [status, setStatus] = useState<StoryStatus | null>(null);
  const [results, setResults] = useState<StoryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    if (!storyName) {
      setStory(null);
      setStatus(null);
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [config, storyStatuses, storyResults] = await Promise.all([
        getFullConfig(),
        listStories(),
        getStoryResults(storyName),
      ]);
      setStory((config.stories ?? []).find((item) => item.name === storyName) ?? null);
      setStatus(storyStatuses.find((item) => item.name === storyName) ?? null);
      setResults(storyResults);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [storyName, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = results.length;
    const failed = results.filter((item) => !item.success).length;
    return { total, failed, success: total - failed };
  }, [results]);

  async function handleTrigger() {
    if (!storyName) return;
    setTriggering(true);
    try {
      await triggerStory(storyName);
      toast(`"${storyName}" triggered`, { variant: "success" });
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
        backLabel="Stories"
        title={storyName || "Story detail"}
        subtitle={story ? `${story.steps.length} configured steps` : "No story metadata available"}
        loading={loading}
        triggering={triggering}
        onBack={() => router.push("/stories")}
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
          No run history found for this story.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((result, idx) => (
            <div key={`${result.timestamp_started}-${idx}`} className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <Chip size="sm" variant="soft" color={result.success ? "success" : "danger"}>
                  {result.success ? "Success" : "Failure"}
                </Chip>
                <span className="text-xs text-default-500">{new Date(result.timestamp_started).toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                {result.step_results.map((step, stepIdx) => (
                  <div key={`${step.step_name}-${stepIdx}`} className="rounded-lg border border-default-100 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-default-900">{step.step_name}</p>
                      <Chip size="sm" variant="soft" color={step.success ? "success" : "danger"}>
                        {step.success ? "OK" : "Failed"}
                      </Chip>
                    </div>

                    {step.error_message && (
                      <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{step.error_message}</p>
                    )}

                    {step.response && (
                      <div className="text-xs text-default-600">
                        HTTP {step.response.status_code}
                        {step.response.sensitive ? (
                          <span className="ml-2 italic text-default-500">[Response redacted]</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StoryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center rounded-2xl border border-default-200 bg-content1 py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <StoryDetailContent />
    </Suspense>
  );
}
