"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useToast } from "@/components/ToastProvider";
import { restartServer } from "@/lib/api";

export default function ConfigPage() {
  const { toast } = useToast();
  const [yaml, setYaml] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);

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
