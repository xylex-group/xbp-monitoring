import type {
  ApiConfig,
  Probe,
  ProbeResult,
  ProbeStatus,
  TriggerResponse,
} from "./types";

/** Base URL — empty string means same origin (Rust serves both API and static files) */
const BASE = "";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as unknown as T;
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
  await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "text/yaml" },
    body: yaml,
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
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
  await fetch("/api/restart", { method: "POST" }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
  });
}
