"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label, TextField, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useApiUrl } from "@/lib/useApiUrl";
import { useToast } from "@/components/ToastProvider";
import { getRawConfig, restartServer, saveRawConfig } from "@/lib/api";
import { useSharedBackendReadiness } from "@/components/BackendReadinessProvider";

function isCrossOriginApiUrl(url: string): boolean {
  const cleaned = url.trim();

  if (!cleaned || typeof window === "undefined") {
    return false;
  }

  try {
    return new URL(cleaned, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export default function ConfigPage() {
  const { toast } = useToast();
  const { url: apiUrl, setUrl: setApiUrl, mounted } = useApiUrl();
  const { ready: backendReady, hasChecked: backendHasChecked } = useSharedBackendReadiness();
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      setYaml(await getRawConfig());
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!backendReady) {
      setLoading(true);
      return;
    }
    void loadConfig();
  }, [backendReady, loadConfig]);

  useEffect(() => {
    if (mounted) setTempApiUrl(apiUrl);
  }, [apiUrl, mounted]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveRawConfig(yaml);
      toast("Config saved. Restart to apply changes.", { variant: "success" });
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestart() {
    if (!confirm("Restart the monitoring service?")) return;
    setRestarting(true);
    try {
      await restartServer();
      toast("Restart signal sent.", { variant: "success" });
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setRestarting(false);
    }
  }

  function handleSaveApiUrl() {
    setApiUrl(tempApiUrl);
    toast("API base URL saved.", { variant: "success" });
  }

  function resetApiUrl() {
    setTempApiUrl(apiUrl);
    toast("Changes discarded.", { variant: "warning" });
  }

  function switchToSameOriginApi() {
    setTempApiUrl("");
    setApiUrl("");
    toast("Switched to same-origin API URL.", { variant: "success" });
  }

  const hasCrossOriginApiUrl = mounted && isCrossOriginApiUrl(tempApiUrl);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Config</h1>
          <p className="text-sm text-muted mt-0.5">
            Raw YAML configuration — edits here require a restart
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onPress={loadConfig}
            isPending={loading}
          >
            <Icon icon="gravity-ui:arrow-rotate-right" className="size-4" />
            Reload
          </Button>
          <Button
            variant="primary"
            onPress={handleSave}
            isPending={saving}
          >
            <Icon icon="gravity-ui:floppy-disk" className="size-4" />
            Save
          </Button>
          <Button
            variant="danger"
            onPress={handleRestart}
            isPending={restarting}
          >
            <Icon icon="gravity-ui:power-switch" className="size-4" />
            Restart
          </Button>
        </div>
      </div>

      {mounted && (
        <div className="rounded-xl border border-default-200 bg-content1 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-default-900">API Settings</h2>
            <p className="text-xs text-default-500 mt-1">
              Configure where the dashboard sends API requests. Leave empty to use the same origin (production).
            </p>
          </div>
          <div className="space-y-3">
            <TextField className="max-w-md" name="api-base-url">
              <Label>API Base URL</Label>
              <Input
                placeholder="http://127.0.0.1:3000"
                value={tempApiUrl}
                onChange={(e) => setTempApiUrl(e.target.value)}
              />
              <div className="text-xs text-default-500 mt-1">
                e.g., http://127.0.0.1:3000 for local dev, empty for production
              </div>
            </TextField>

            {hasCrossOriginApiUrl && (
              <div className="max-w-3xl rounded-lg border border-warning-300 bg-warning-50 p-3 text-warning-900 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-200">
                <div className="flex items-start gap-2">
                  <Icon icon="gravity-ui:triangle-exclamation" className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cross-origin API URL detected</p>
                    <p className="text-xs">
                      This dashboard is configured to call a different origin. If backend CORS is disabled, requests like
                      <span className="font-mono"> /probes</span> will fail in the browser.
                    </p>
                    <Button size="sm" variant="secondary" onPress={switchToSameOriginApi}>
                      Use same-origin URL
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onPress={handleSaveApiUrl}>Save URL</Button>
              <Button size="sm" variant="ghost" onPress={resetApiUrl}>Discard</Button>
            </div>
          </div>
        </div>
      )}

      {loading || !backendReady ? (
        <div className="flex justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-xs text-muted">
              {!backendHasChecked
                ? "Checking backend readiness..."
                : "Waiting for backend startup (Docker compile in progress)."}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-content1 border border-divider rounded-xl overflow-hidden">
          <div className="bg-content2 px-4 py-2 flex items-center gap-2 border-b border-divider">
            <Icon icon="gravity-ui:code" className="size-4 text-muted" />
            <span className="text-xs text-muted font-mono">xbp.yml</span>
          </div>
          <textarea
            className="w-full min-h-[60vh] bg-transparent p-4 font-mono text-sm resize-y outline-none text-foreground"
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
