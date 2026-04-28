"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { listProbeStatuses } from "@/lib/api";

export function BackendStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
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
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    // Only check once on mount; don't continuously poll to avoid spam
  }, [checkBackend]);

  // Only show banner if initial check failed
  if (!offline || !hasChecked) return null;

  return (
    <div className="mb-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-warning-700 text-sm shadow-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="gravity-ui:triangle-exclamation-fill" className="size-3.5 shrink-0" />
          <span className="font-medium">Backend offline</span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 min-w-fit"
          onPress={checkBackend}
          isPending={checking}
        >
          <Icon icon="gravity-ui:arrow-rotate-right" className="size-3" />
          Retry
        </Button>
      </div>
    </div>
  );
}