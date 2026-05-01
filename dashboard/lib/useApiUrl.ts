"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xbp-api-base-url";

declare global {
  interface Window {
    __XBP_RUNTIME_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

function normalizeUrl(url: string | null | undefined): string {
  return (url ?? "").trim().replace(/\/$/, "");
}

function getRuntimeApiUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeUrl(window.__XBP_RUNTIME_CONFIG__?.apiBaseUrl);
}

function getEnvApiUrl(): string {
  return normalizeUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}

function getDefaultApiUrl(): string {
  return getRuntimeApiUrl() || getEnvApiUrl();
}

/**
 * Hook to manage and persist the API base URL.
 * Falls back to runtime config, then NEXT_PUBLIC_API_BASE_URL, then empty string.
 */
export function useApiUrl() {
  const [url, setUrlState] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setUrlState(normalizeUrl(stored) || getDefaultApiUrl());
    setMounted(true);
  }, []);

  const setUrl = useCallback((newUrl: string) => {
    const cleaned = normalizeUrl(newUrl);
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
    return getEnvApiUrl();
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  return normalizeUrl(stored) || getDefaultApiUrl();
}
