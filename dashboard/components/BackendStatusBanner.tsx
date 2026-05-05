"use client";

import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useSharedBackendReadiness } from "@/components/BackendReadinessProvider";

export function BackendStatusBanner() {
  const { ready, hasChecked, checking, error, reload } = useSharedBackendReadiness();
  if (ready && hasChecked) return null;

  return (
    <div className="mb-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-warning-700 text-sm shadow-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="gravity-ui:triangle-exclamation-fill" className="size-3.5 shrink-0" />
          <span className="font-medium">
            {!hasChecked ? "Checking backend readiness" : "Backend still starting"}
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 min-w-fit"
          onPress={reload}
          isPending={checking}
        >
          <Icon icon="gravity-ui:arrow-rotate-right" className="size-3" />
          Retry
        </Button>
      </div>
      <p className="mt-1 text-xs text-warning-700/90">
        Waiting for <code>/api/health</code>. In Docker dev this usually means the Rust backend is still compiling.
      </p>
      {error && (
        <p className="mt-1 truncate font-mono text-[11px] text-warning-700/80">{error}</p>
      )}
    </div>
  );
}
