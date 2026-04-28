"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xbp-api-base-url";

/**
 * Hook to manage and persist the API base URL.
 * Falls back to NEXT_PUBLIC_API_BASE_URL env var or empty string.
 */
export function useApiUrl() {
  const [url, setUrlState] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const envUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
    setUrlState(stored ?? envUrl);
    setMounted(true);
  }, []);

  const setUrl = useCallback((newUrl: string) => {
    const cleaned = newUrl.replace(/\/$/, "");
    setUrlState(cleaned);
    if (cleaned) {
      localStorage.setItem(STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { url, setUrl, mounted };
}

/**
 * Get the current API base URL (sync version for use outside components).
 * Returns the stored value or environment default.
 */
export function getApiUrl(): string {
  if (typeof window === "undefined") {
    return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  const envUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return stored ?? envUrl;
}
