export type ExpectField = "Body" | "StatusCode";
export type ExpectOperation =
  | "Equals"
  | "NotEquals"
  | "IsOneOf"
  | "Contains"
  | "NotContains"
  | "Matches";

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
  headers?: Record<string, string>;
  body?: string;
  timeout_seconds?: number;
}

export interface Probe {
  name: string;
  url: string;
  http_method: string;
  with?: ProbeInputParameters;
  expectations?: ProbeExpectation[];
  schedule: ProbeSchedule;
  alerts?: ProbeAlert[];
  sensitive?: boolean;
  tags?: Record<string, string>;
}

export interface ProbeStatus {
  name: string;
  status: "OK" | "FAILING" | "PENDING";
  last_probed: string | null;
}

export interface ProbeResult {
  probe_name: string;
  timestamp_started: string;
  success: boolean;
  error_message?: string;
  trace_id?: string;
  response?: {
    timestamp_received: string;
    status_code: number;
    body: string;
    sensitive: boolean;
  };
}

export interface TriggerResponse {
  timestamp_started?: string;
}

export interface ApiConfig {
  probes: Probe[];
  stories: Story[];
}

export interface Story {
  name: string;
  steps: Array<{
    name: string;
    url: string;
    http_method: string;
    with?: ProbeInputParameters;
    expectations?: ProbeExpectation[];
    sensitive?: boolean;
  }>;
  schedule: ProbeSchedule;
  alerts?: ProbeAlert[];
  tags?: Record<string, string>;
}

export interface StoryStatus {
  name: string;
  status: "OK" | "FAILING" | "PENDING";
  last_probed: string | null;
}

export interface StoryStepResult {
  step_name: string;
  timestamp_started: string;
  success: boolean;
  error_message?: string;
  trace_id?: string;
  span_id?: string;
  response?: {
    timestamp_received: string;
    status_code: number;
    body: string;
    sensitive: boolean;
  };
}

export interface StoryResult {
  story_name: string;
  timestamp_started: string;
  success: boolean;
  step_results: StoryStepResult[];
}
