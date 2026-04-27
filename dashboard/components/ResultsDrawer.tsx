"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Drawer, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getProbeResults } from "@/lib/api";
import type { ProbeResult } from "@/lib/types";

interface Props {
  probeName: string | null;
  onClose: () => void;
}

export function ResultsDrawer({ probeName, onClose }: Props) {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!probeName) {
      setResults([]);
      return;
    }
    setLoading(true);
    getProbeResults(probeName)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [probeName]);

  return (
    <Drawer.Backdrop isOpen={!!probeName} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content placement="right" className="w-[480px] max-w-full">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>{probeName} — Results</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted text-center py-12">No results yet.</p>
            ) : (
              results.map((result, idx) => (
                <div
                  key={idx}
                  className="bg-surface rounded-xl p-4 border border-border flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <Chip
                      size="sm"
                      variant="soft"
                      color={result.success ? "success" : "danger"}
                    >
                      {result.success ? "Success" : "Failure"}
                    </Chip>
                    <span className="text-xs text-muted">
                      {new Date(result.timestamp_started).toLocaleString()}
                    </span>
                  </div>
                  {result.error_message && (
                    <p className="text-xs text-danger">{result.error_message}</p>
                  )}
                  {result.response && (
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted">
                        HTTP {result.response.status_code}
                      </span>
                      {!result.response.sensitive && result.response.body && (
                        <pre className="text-xs bg-surface-secondary rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                          {result.response.body.substring(0, 500)}
                          {result.response.body.length > 500 && "…"}
                        </pre>
                      )}
                      {result.response.sensitive && (
                        <span className="text-xs text-muted italic">
                          [Response body redacted — sensitive]
                        </span>
                      )}
                    </div>
                  )}
                  {result.trace_id && (
                    <div className="flex items-center gap-2">
                      <Icon icon="gravity-ui:link" className="size-3 text-muted" />
                      <span className="text-xs text-muted font-mono">{result.trace_id}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onPress={onClose}>
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
