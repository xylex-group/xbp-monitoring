"use client";

import { useCallback, useEffect, useRef } from "react";

export interface UsePollingLoaderOptions {
  /** Polling interval in milliseconds. Defaults to 30 000. */
  intervalMs?: number;
  /** Minimum milliseconds between calls (guard against rapid re-invocations). */
  minIntervalMs?: number;
  /** Disable polling until external readiness is met. */
  enabled?: boolean;
}

/**
 * Calls `loader` immediately on mount and then on a fixed interval.
 * Concurrent calls are suppressed via a ref-based in-flight flag.
 * Returns a stable `reload` callback that bypasses the min-interval guard.
 */
export function usePollingLoader(
  loader: () => Promise<void>,
  { intervalMs = 30_000, minIntervalMs = 0, enabled = true }: UsePollingLoaderOptions = {},
): { reload: () => void } {
  const inFlightRef = useRef(false);
  const lastCalledAtRef = useRef(0);

  const run = useCallback(
    async (force: boolean) => {
      if (inFlightRef.current) return;
      const now = Date.now();
      if (!force && minIntervalMs > 0 && now - lastCalledAtRef.current < minIntervalMs) return;

      inFlightRef.current = true;
      lastCalledAtRef.current = now;
      try {
        await loader();
      } finally {
        inFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, minIntervalMs],
  );

  useEffect(() => {
    if (!enabled) return;
    void run(true);
    const id = setInterval(() => void run(false), intervalMs);
    return () => clearInterval(id);
  }, [enabled, run, intervalMs]);

  const reload = useCallback(() => void run(true), [run]);

  return { reload };
}
