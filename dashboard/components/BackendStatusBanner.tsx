"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { listProbeStatuses } from "@/lib/api";

export function BackendStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkBackend = useCallback(async () => {
    setChecking(true);
    try {
      await listProbeStatuses();
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 20_000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  if (!offline) return null;

  return (
    <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon icon="gravity-ui:triangle-exclamation-fill" className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Backend connection lost</p>
            <p className="text-xs text-danger/80">
              The dashboard cannot reach the monitoring API. Ensure Rust backend is running on port 3000.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="border border-danger/30"
          onPress={checkBackend}
          isPending={checking}
        >
          <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}