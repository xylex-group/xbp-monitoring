export const EXPECT_FIELDS = ["Body", "StatusCode"] as const;
export type ExpectField = (typeof EXPECT_FIELDS)[number];

export const EXPECT_OPERATIONS = [
  "Equals",
  "NotEquals",
  "IsOneOf",
  "Contains",
  "NotContains",
  "Matches",
] as const;
export type ExpectOperation = (typeof EXPECT_OPERATIONS)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const MONITOR_STATUSES = ["OK", "FAILING", "PENDING"] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export type StringMap = Record<string, string>;
export type NamedEntity = { name: string };
export type NamedEntityMap<T extends NamedEntity> = Partial<Record<T["name"], T>>;

export interface ProbeExpectation {
  field: ExpectField;
  operation: ExpectOperation;
  value: string;
}

export interface ProbeSchedule {
  initial_delay: number;
  interval: number;
}

export interface ProbeAlert {
  url: string;
}

export interface ProbeInputParameters {
  headers?: StringMap;
  body?: string;
  timeout_seconds?: number;
}

export interface HttpRequestDefinition {
  url: string;
  http_method: HttpMethod;
  with?: ProbeInputParameters;
  expectations?: ProbeExpectation[];
  sensitive?: boolean;
}

export interface SchedulableMonitor {
  schedule: ProbeSchedule;
  alerts?: ProbeAlert[];
  tags?: StringMap;
}

export interface Probe extends NamedEntity, HttpRequestDefinition, SchedulableMonitor {}

export interface ProbeStatus extends NamedEntity {
  status: MonitorStatus;
  last_probed: string | null;
}

export interface HttpResponseDetails {
  timestamp_received: string;
  status_code: number;
  body: string;
  sensitive: boolean;
}

export interface TraceContext {
  trace_id?: string;
}

export interface StepTraceContext extends TraceContext {
  span_id?: string;
}

export interface ProbeResult extends TraceContext {
  probe_name: string;
  timestamp_started: string;
  success: boolean;
  error_message?: string;
  response?: HttpResponseDetails;
}

export interface TriggerResponse {
  timestamp_started?: string;
}

export interface StoryStep extends NamedEntity, HttpRequestDefinition {}

export interface Story extends NamedEntity, SchedulableMonitor {
  steps: StoryStep[];
}

export interface StoryStatus extends NamedEntity {
  status: MonitorStatus;
  last_probed: string | null;
}

export interface StoryStepResult extends StepTraceContext {
  step_name: string;
  timestamp_started: string;
  success: boolean;
  error_message?: string;
  response?: HttpResponseDetails;
}

export interface StoryResult {
  story_name: string;
  timestamp_started: string;
  success: boolean;
  step_results: StoryStepResult[];
}

export interface ApiConfig {
  probes: Probe[];
  stories: Story[];
}

export type ConfigCollectionKey = keyof Pick<ApiConfig, "probes" | "stories">;
export type ConfigEntity<K extends ConfigCollectionKey> = ApiConfig[K][number];
