import type {
  ApiConfig,
  Probe,
  ProbeResult,
  ProbeStatus,
  StoryResult,
  StoryStatus,
  TriggerResponse,
  BackendHealthStatus,
} from "./types";

import { getApiUrl } from "./useApiUrl";

/**
 * Base URL for API requests.
 * - Production (Rust serves dashboard + API on same origin): empty string
 * - Local Next dev: set via dashboard settings or dashboard runtime config
 * - Users can customize via Config page settings
 */
function getBASE(): string {
  return getApiUrl();
}

function isHtmlContent(contentType: string, body: string): boolean {
  return contentType.includes("text/html") || /^\s*<!DOCTYPE html/i.test(body);
}

function shorten(text: string, max = 240): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildEndpointWithBase(path: string, baseUrl: string): string {
  return `${baseUrl}${path}`;
}

function isCrossOriginBaseUrl(baseUrl: string): boolean {
  if (!baseUrl || typeof window === "undefined") {
    return false;
  }

  try {
    return new URL(baseUrl, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

type ApiMethod = "GET" | "POST" | "PUT";

type ApiContract = {
  "/probes": {
    GET: ProbeStatus[];
  };
  [path: `/probes/${string}/results?show_response=true`]: {
    GET: ProbeResult[];
  };
  [path: `/probes/${string}/trigger`]: {
    GET: TriggerResponse;
  };
  "/stories": {
    GET: StoryStatus[];
  };
  [path: `/stories/${string}/results?show_response=true`]: {
    GET: StoryResult[];
  };
  [path: `/stories/${string}/trigger`]: {
    GET: StoryResult;
  };
  "/api/config": {
    GET: string;
    PUT: string;
  };
  "/api/health": {
    GET: BackendHealthStatus;
  };
  "/api/restart": {
    POST: string;
  };
};

type ApiPath = keyof ApiContract;
type ApiMethodFor<Path extends ApiPath> = Extract<keyof ApiContract[Path], ApiMethod>;
type ApiResponse<Path extends ApiPath, Method extends ApiMethodFor<Path>> = ApiContract[Path][Method];

function isApiConfig(value: unknown): value is ApiConfig {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ApiConfig>;
  const probesOk = candidate.probes === undefined || Array.isArray(candidate.probes);
  const storiesOk = candidate.stories === undefined || Array.isArray(candidate.stories);
  return probesOk && storiesOk;
}

function normalizeApiConfig(value: unknown): ApiConfig | null {
  if (!isApiConfig(value)) {
    return null;
  }

  const candidate = value as Partial<ApiConfig>;
  return {
    probes: candidate.probes ?? [],
    stories: candidate.stories ?? [],
  };
}

async function request<Path extends ApiPath, Method extends ApiMethodFor<Path>>(
  path: Path,
  method: Method,
  init?: Omit<RequestInit, "method">
): Promise<ApiResponse<Path, Method>> {
  const BASE = getBASE();
  const endpoint = buildEndpointWithBase(path, BASE);
  let res: Response;

  try {
    res = await fetch(endpoint, { ...init, method });
  } catch (err) {
    // If an explicit base URL fails (often due to CORS), retry once with same-origin.
    // This helps local dev setups that rely on Next rewrites/proxy.
    if (BASE) {
      try {
        res = await fetch(buildEndpointWithBase(path, ""), { ...init, method });
      } catch {
        if (isCrossOriginBaseUrl(BASE)) {
          throw new Error(
            `Request failed for ${path}. Current API Base URL (${BASE}) is cross-origin and CORS may be disabled. ` +
              `Clear the API Base URL in Config to use same-origin/proxy, or enable backend CORS.`
          );
        }

        throw err instanceof Error ? err : new Error(String(err));
      }
    } else {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

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
    return JSON.parse(text) as ApiResponse<Path, Method>;
  }

  return text as ApiResponse<Path, Method>;
}

// ── Probes status overview ────────────────────────────────────────────────────

export function listProbeStatuses(): Promise<ProbeStatus[]> {
  return request("/probes", "GET");
}

export function getProbeResults(name: string): Promise<ProbeResult[]> {
  const path = `/probes/${encodeURIComponent(name)}/results?show_response=true` as const;
  return request(path, "GET");
}

export function triggerProbe(name: string): Promise<TriggerResponse> {
  const path = `/probes/${encodeURIComponent(name)}/trigger` as const;
  return request(path, "GET");
}

// ── Stories status overview ──────────────────────────────────────────────────

export function listStories(): Promise<StoryStatus[]> {
  return request("/stories", "GET");
}

export function getStoryResults(name: string): Promise<StoryResult[]> {
  const path = `/stories/${encodeURIComponent(name)}/results?show_response=true` as const;
  return request(path, "GET");
}

export function triggerStory(name: string): Promise<StoryResult> {
  const path = `/stories/${encodeURIComponent(name)}/trigger` as const;
  return request(path, "GET");
}

// ── Config (YAML read/write) ─────────────────────────────────────────────────

export async function getFullConfig(): Promise<ApiConfig> {
  const yaml = await getRawConfig();
  // Parse client-side via import — we dynamically import js-yaml
  const { load } = await import("js-yaml");
  const parsed = normalizeApiConfig(load(yaml));

  if (!parsed) {
    throw new Error("The configuration returned by /api/config is not shaped like an XBP config.");
  }

  return parsed;
}

export async function saveFullConfig(config: ApiConfig): Promise<void> {
  const { dump } = await import("js-yaml");
  const yaml = dump(config, { lineWidth: 120 });
  await request("/api/config", "PUT", {
    headers: { "Content-Type": "text/yaml" },
    body: yaml,
  });
}

export function getRawConfig(): Promise<string> {
  return request("/api/config", "GET");
}

export function getBackendHealthStatus(): Promise<BackendHealthStatus> {
  return request("/api/health", "GET");
}

export function saveRawConfig(yaml: string): Promise<string> {
  return request("/api/config", "PUT", {
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
  await request("/api/restart", "POST");
}
