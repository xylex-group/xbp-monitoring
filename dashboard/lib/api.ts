import type {
  ApiConfig,
  Probe,
  ProbeResult,
  ProbeStatus,
  TriggerResponse,
} from "./types";

/**
 * Base URL for API requests.
 * - Production (Rust serves dashboard + API on same origin): empty string
 * - Local Next dev: optionally set NEXT_PUBLIC_API_BASE_URL, e.g. http://127.0.0.1:3000
 */
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

function isHtmlContent(contentType: string, body: string): boolean {
  return contentType.includes("text/html") || /^\s*<!DOCTYPE html/i.test(body);
}

function shorten(text: string, max = 240): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildEndpoint(path: string): string {
  return `${BASE}${path}`;
}

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const endpoint = buildEndpoint(path);
  const res = await fetch(endpoint, init);

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);

    if (isHtmlContent(contentType, text)) {
      throw new Error(
        `API request failed for ${path} (HTTP ${res.status}). Received HTML instead of API data. ` +
          `If you are running Next dev, start Rust backend on :3000 and dashboard on :3001.`
      );
    }

    throw new Error(text || `HTTP ${res.status}`);
  }

  const text = await res.text();

  if (isHtmlContent(contentType, text)) {
    throw new Error(
      `Unexpected HTML response for ${path}. Check API base URL and backend availability. ` +
        `Received: ${shorten(text)}`
    );
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as T;
  }

  return text as unknown as T;
}

// ── Probes status overview ────────────────────────────────────────────────────

export function listProbeStatuses(): Promise<ProbeStatus[]> {
  return request<ProbeStatus[]>("/probes");
}

export function getProbeResults(name: string): Promise<ProbeResult[]> {
  return request<ProbeResult[]>(
    `/probes/${encodeURIComponent(name)}/results?show_response=true`
  );
}

export function triggerProbe(name: string): Promise<TriggerResponse> {
  return request<TriggerResponse>(
    `/probes/${encodeURIComponent(name)}/trigger`
  );
}

// ── Config (YAML read/write) ─────────────────────────────────────────────────

export async function getFullConfig(): Promise<ApiConfig> {
  const yaml = await request<string>("/api/config");
  // Parse client-side via import — we dynamically import js-yaml
  const { load } = await import("js-yaml");
  return load(yaml) as ApiConfig;
}

export async function saveFullConfig(config: ApiConfig): Promise<void> {
  const { dump } = await import("js-yaml");
  const yaml = dump(config, { lineWidth: 120 });
  await request<string>("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "text/yaml" },
    body: yaml,
  });
}

// ── Monitor CRUD (client-side, backed by YAML) ───────────────────────────────

export async function listProbes(): Promise<Probe[]> {
  const config = await getFullConfig();
  return config.probes ?? [];
}

export async function createProbe(probe: Probe): Promise<void> {
  const config = await getFullConfig();
  const exists = config.probes.some((p) => p.name === probe.name);
  if (exists) throw new Error(`A monitor named "${probe.name}" already exists.`);
  config.probes.push(probe);
  await saveFullConfig(config);
}

export async function updateProbe(
  originalName: string,
  probe: Probe
): Promise<void> {
  const config = await getFullConfig();
  const idx = config.probes.findIndex((p) => p.name === originalName);
  if (idx === -1) throw new Error(`Monitor "${originalName}" not found.`);
  // If name changed, make sure new name doesn't conflict
  if (probe.name !== originalName && config.probes.some((p) => p.name === probe.name)) {
    throw new Error(`A monitor named "${probe.name}" already exists.`);
  }
  config.probes[idx] = probe;
  await saveFullConfig(config);
}

export async function deleteProbe(name: string): Promise<void> {
  const config = await getFullConfig();
  config.probes = config.probes.filter((p) => p.name !== name);
  await saveFullConfig(config);
}

export async function restartServer(): Promise<void> {
  await request<string>("/api/restart", { method: "POST" });
}
