"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Chip,
  Modal,
  Spinner,
  Table,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { deleteProbe, listProbes, listProbeStatuses, triggerProbe } from "@/lib/api";
import type { Probe, ProbeStatus } from "@/lib/types";
import { MonitorForm } from "@/components/MonitorForm";
import { ResultsDrawer } from "@/components/ResultsDrawer";
import { useToast } from "@/components/ToastProvider";

const STATUS_COLOR = {
  OK: "success",
  FAILING: "danger",
  PENDING: "warning",
} as const;

export default function MonitorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [probes, setProbes] = useState<Probe[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProbeStatus>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProbe, setEditProbe] = useState<Probe | null>(null);
  const [resultsProbe, setResultsProbe] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [probeList, statusList] = await Promise.all([
        listProbes(),
        listProbeStatuses(),
      ]);
      setProbes(probeList);
      const statusMap: Record<string, ProbeStatus> = {};
      for (const s of statusList) statusMap[s.name] = s;
      setStatuses(statusMap);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleDelete(name: string) {
    if (!confirm(`Delete monitor "${name}"?`)) return;
    try {
      await deleteProbe(name);
      toast(`Deleted "${name}"`, { variant: "success" });
      load();
    } catch (err) {
      toast(String(err), { variant: "danger" });
    }
  }

  async function handleTrigger(name: string) {
    setTriggering(name);
    try {
      await triggerProbe(name);
      toast(`"${name}" triggered`, { variant: "success" });
      setTimeout(load, 2000);
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setTriggering(null);
    }
  }

  const stats = useMemo(() => {
    const values = Object.values(statuses);
    return {
      ok: values.filter((s) => s.status === "OK").length,
      failing: values.filter((s) => s.status === "FAILING").length,
      pending: values.filter((s) => s.status === "PENDING").length,
    };
  }, [statuses]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-sm text-muted mt-0.5">
            HTTP probes running on schedule
          </p>
        </div>
        <Button onPress={() => setCreateOpen(true)}>
          <Icon icon="gravity-ui:plus" className="size-4" />
          Add Monitor
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Healthy", value: stats.ok, color: "success" },
          { label: "Failing", value: stats.failing, color: "danger" },
          { label: "Pending", value: stats.pending, color: "warning" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-surface rounded-xl p-4 border border-border flex items-center gap-4"
          >
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-sm font-medium text-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Monitors" className="min-w-[800px]">
              <Table.Header>
                <Table.Column isRowHeader>Name</Table.Column>
                <Table.Column>URL</Table.Column>
                <Table.Column>Method</Table.Column>
                <Table.Column>Interval</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Last Probed</Table.Column>
                <Table.Column className="text-end">Actions</Table.Column>
              </Table.Header>
              <Table.Body>
                {probes.map((probe) => {
                  const status = statuses[probe.name];
                  return (
                    <Table.Row key={probe.name} id={probe.name}>
                      <Table.Cell className="font-medium">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() =>
                            router.push(`/monitors/detail?name=${encodeURIComponent(probe.name)}`)
                          }
                        >
                          {probe.name}
                        </button>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-muted font-mono truncate max-w-48 block">
                          {probe.url}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="secondary">
                          {probe.http_method}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-xs text-muted">
                        {probe.schedule.interval}s
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={STATUS_COLOR[status?.status ?? "PENDING"]}
                        >
                          {status?.status ?? "PENDING"}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-xs text-muted">
                        {status?.last_probed
                          ? new Date(status.last_probed).toLocaleString()
                          : "Never"}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={() =>
                              router.push(`/monitors/detail?name=${encodeURIComponent(probe.name)}`)
                            }
                          >
                            <Icon icon="gravity-ui:eye" className="size-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            isPending={triggering === probe.name}
                            onPress={() => handleTrigger(probe.name)}
                          >
                            <Icon icon="gravity-ui:play" className="size-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={() => setEditProbe(probe)}
                          >
                            <Icon icon="gravity-ui:pencil" className="size-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="danger"
                            onPress={() => handleDelete(probe.name)}
                          >
                            <Icon icon="gravity-ui:trash-bin" className="size-4" />
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
                {probes.length === 0 && (
                  <Table.Row id="empty">
                    <Table.Cell colSpan={7}>
                      <div className="py-12 text-center text-muted text-sm">
                        No monitors yet.{" "}
                        <button
                          className="text-primary underline"
                          onClick={() => setCreateOpen(true)}
                        >
                          Add one
                        </button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {/* Create Monitor Modal */}
      <Modal.Backdrop isOpen={createOpen} onOpenChange={setCreateOpen}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Add Monitor</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <MonitorForm
                onSuccess={() => {
                  setCreateOpen(false);
                  load();
                  toast("Monitor created. Restart to activate.", { variant: "success" });
                }}
                onCancel={() => setCreateOpen(false)}
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Edit Monitor Modal */}
      <Modal.Backdrop isOpen={!!editProbe} onOpenChange={(open) => !open && setEditProbe(null)}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Edit Monitor</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {editProbe && (
                <MonitorForm
                  probe={editProbe}
                  onSuccess={() => {
                    setEditProbe(null);
                    load();
                    toast("Monitor updated. Restart to apply.", { variant: "success" });
                  }}
                  onCancel={() => setEditProbe(null)}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Results Drawer */}
      <ResultsDrawer
        probeName={resultsProbe}
        onClose={() => setResultsProbe(null)}
      />
    </div>
  );
}
