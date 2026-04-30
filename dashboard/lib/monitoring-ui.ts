import type { MonitorStatus, NamedEntity, ProbeStatus, StoryStatus } from "./types";

export const STATUS_COLOR = {
  OK: "success",
  FAILING: "danger",
  PENDING: "warning",
} as const;

export const STATUS_ICON = {
  OK: "gravity-ui:circle-check-fill",
  FAILING: "gravity-ui:circle-xmark-fill",
  PENDING: "gravity-ui:circle-dashed",
} as const;

export const STATUS_STYLES = {
  OK: {
    iconClass: "text-success",
    chipColor: "success" as const,
    toneClass: "bg-success/10 border-success/30",
    dotClass: "bg-success",
  },
  FAILING: {
    iconClass: "text-danger",
    chipColor: "danger" as const,
    toneClass: "bg-danger/10 border-danger/30",
    dotClass: "bg-danger",
  },
  PENDING: {
    iconClass: "text-warning",
    chipColor: "warning" as const,
    toneClass: "bg-warning/10 border-warning/30",
    dotClass: "bg-warning",
  },
} as const;

export type NamedStatus = ProbeStatus | StoryStatus;
export type NamedStatusMap<T extends NamedStatus> = Record<string, T>;

export function relativeTimeLabel(value: string | null): string {
  if (!value) return "never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs < 60_000) return "just now";
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `about ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function buildNamedEntityMap<T extends NamedEntity>(entities: T[]): Record<string, T> {
  return Object.fromEntries(entities.map((entity) => [entity.name, entity]));
}

export function buildStatusMap<T extends NamedStatus>(statuses: T[]): NamedStatusMap<T> {
  return buildNamedEntityMap(statuses);
}

export function countMonitorStatuses<T extends { status: MonitorStatus }>(statuses: T[]) {
  return statuses.reduce(
    (summary, item) => {
      summary[item.status.toLowerCase() as Lowercase<MonitorStatus>] += 1;
      summary.total += 1;
      return summary;
    },
    { ok: 0, failing: 0, pending: 0, total: 0 },
  );
}
