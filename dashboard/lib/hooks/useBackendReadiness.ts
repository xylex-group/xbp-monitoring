"use client";

import { useCallback, useEffect, useState } from "react";
import { getBackendHealthStatus } from "@/lib/api";

export interface BackendReadinessState {
  ready: boolean;
  hasChecked: boolean;
  checking: boolean;
  error: string | null;
  reload: () => void;
}

export function useBackendReadiness(
  intervalMs = 3_000,
): BackendReadinessState {
  const [ready, setReady] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);

    try {
      await getBackendHealthStatus();
      setReady(true);
      setError(null);
    } catch (err) {
      setReady(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
      setHasChecked(true);
    }
  }, []);

  useEffect(() => {
    void check();
    const id = setInterval(() => void check(), intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  const reload = useCallback(() => void check(), [check]);

  return { ready, hasChecked, checking, error, reload };
}
