"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label, TextField, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useApiUrl } from "@/lib/useApiUrl";
import { useToast } from "@/components/ToastProvider";
import { restartServer } from "@/lib/api";

export default function ConfigPage() {
  const { toast } = useToast();
  const { url: apiUrl, setUrl: setApiUrl, mounted } = useApiUrl();
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(await res.text());
      setYaml(await res.text());
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (mounted) setTempApiUrl(apiUrl);
  }, [apiUrl, mounted]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "text/yaml" },
        body: yaml,
      });
      if (!res.ok) throw new Error(await res.text());
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
            <div className="flex gap-2">
              <Button size="sm" onPress={handleSaveApiUrl}>Save URL</Button>
              <Button size="sm" variant="ghost" onPress={resetApiUrl}>Discard</Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
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
