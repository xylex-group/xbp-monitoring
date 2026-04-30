import type { MonitorStatus } from "@/lib/types";

interface RunSummaryGridProps {
  currentStatus?: MonitorStatus | null;
  total: number;
  success: number;
  failed: number;
}

export function RunSummaryGrid({ currentStatus, total, success, failed }: RunSummaryGridProps) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 md:max-w-2xl md:grid-cols-4">
      <div className="rounded-xl border border-default-200 bg-default-50 p-3">
        <p className="text-xs text-default-500">Current status</p>
        <p className="text-lg font-bold text-default-900">{currentStatus ?? "PENDING"}</p>
      </div>
      <div className="rounded-xl border border-default-200 bg-default-50 p-3">
        <p className="text-xs text-default-500">Runs loaded</p>
        <p className="text-lg font-bold text-default-900">{total}</p>
      </div>
      <div className="rounded-xl border border-default-200 bg-success/5 p-3">
        <p className="text-xs text-default-500">Passed</p>
        <p className="text-lg font-bold text-success">{success}</p>
      </div>
      <div className="rounded-xl border border-default-200 bg-danger/5 p-3">
        <p className="text-xs text-default-500">Failed</p>
        <p className="text-lg font-bold text-danger">{failed}</p>
      </div>
    </div>
  );
}
