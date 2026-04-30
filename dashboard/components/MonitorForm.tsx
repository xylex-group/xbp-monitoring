"use client";

import { useState } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { createProbe, updateProbe } from "@/lib/api";
import type {
  ExpectField,
  ExpectOperation,
  HttpMethod,
  Probe,
  ProbeExpectation,
} from "@/lib/types";
import { EXPECT_FIELDS, EXPECT_OPERATIONS, HTTP_METHODS } from "@/lib/types";
import { useToast } from "./ToastProvider";

type SelectionValue = string | number | null;

function isOneOf<const Values extends readonly string[]>(
  values: Values,
  candidate: string
): candidate is Values[number] {
  return (values as readonly string[]).includes(candidate);
}

interface Props {
  probe?: Probe;
  onSuccess: () => void;
  onCancel: () => void;
}

function defaultProbe(): Probe {
  return {
    name: "",
    url: "",
    http_method: "GET",
    schedule: { initial_delay: 0, interval: 60 },
    expectations: [{ field: "StatusCode", operation: "Equals", value: "200" }],
    alerts: [],
    tags: {},
    sensitive: false,
  };
}

export function MonitorForm({ probe: initial, onSuccess, onCancel }: Props) {
  const { toast } = useToast();
  const [probe, setProbe] = useState<Probe>(initial ?? defaultProbe());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [tagsRaw, setTagsRaw] = useState<string>(
    Object.entries(initial?.tags ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")
  );

  const [headersRaw, setHeadersRaw] = useState<string>(
    Object.entries(initial?.with?.headers ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")
  );

  function set<K extends keyof Probe>(key: K, value: Probe[K]) {
    setProbe((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  function parseSelection(selection: SelectionValue): string | null {
    return selection == null ? null : String(selection);
  }

  function setHttpMethod(selection: SelectionValue) {
    const candidate = parseSelection(selection);
    if (candidate && isOneOf(HTTP_METHODS, candidate)) {
      set("http_method", candidate as HttpMethod);
    }
  }

  function setExpectationField(idx: number, selection: SelectionValue) {
    const candidate = parseSelection(selection);
    if (candidate && isOneOf(EXPECT_FIELDS, candidate)) {
      updateExpectation(idx, { field: candidate as ExpectField });
    }
  }

  function setExpectationOperation(idx: number, selection: SelectionValue) {
    const candidate = parseSelection(selection);
    if (candidate && isOneOf(EXPECT_OPERATIONS, candidate)) {
      updateExpectation(idx, { operation: candidate as ExpectOperation });
    }
  }

  function setSchedule(key: "initial_delay" | "interval", value: number) {
    setProbe((prev) => ({ ...prev, schedule: { ...prev.schedule, [key]: value } }));
  }

  function addExpectation() {
    setProbe((prev) => ({
      ...prev,
      expectations: [
        ...(prev.expectations ?? []),
        { field: "StatusCode", operation: "Equals", value: "" },
      ],
    }));
  }

  function updateExpectation(idx: number, patch: Partial<ProbeExpectation>) {
    setProbe((prev) => {
      const expectations = [...(prev.expectations ?? [])];
      expectations[idx] = { ...expectations[idx], ...patch };
      return { ...prev, expectations };
    });
  }

  function removeExpectation(idx: number) {
    setProbe((prev) => ({
      ...prev,
      expectations: (prev.expectations ?? []).filter((_, i) => i !== idx),
    }));
  }

  function addAlert() {
    setProbe((prev) => ({
      ...prev,
      alerts: [...(prev.alerts ?? []), { url: "" }],
    }));
  }

  function updateAlert(idx: number, value: string) {
    setProbe((prev) => {
      const alerts = [...(prev.alerts ?? [])];
      alerts[idx] = { url: value };
      return { ...prev, alerts };
    });
  }

  function removeAlert(idx: number) {
    setProbe((prev) => ({
      ...prev,
      alerts: (prev.alerts ?? []).filter((_, i) => i !== idx),
    }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!probe.name.trim()) errs.name = "Name is required";
    if (!probe.url.trim()) errs.url = "URL is required";
    else {
      try { new URL(probe.url); } catch { errs.url = "Must be a valid URL"; }
    }
    if (probe.schedule.interval < 1) errs.interval = "Interval must be >= 1 second";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function parseHeadersRaw(raw: string): Record<string, string> {
    return Object.fromEntries(
      raw.split("\n")
        .map((line) => line.split(":").map((p) => p.trim()))
        .filter(([k]) => k)
        .map(([k, ...rest]) => [k, rest.join(":").trim()])
    );
  }

  function parseTagsRaw(raw: string): Record<string, string> {
    return Object.fromEntries(
      raw.split("\n")
        .map((line) => line.split("=").map((p) => p.trim()))
        .filter(([k]) => k)
        .map(([k, ...rest]) => [k, rest.join("=").trim()])
    );
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const tags = parseTagsRaw(tagsRaw);
      const headers = parseHeadersRaw(headersRaw);
      const withBlock = Object.keys(headers).length > 0 || probe.with?.body
        ? { headers: Object.keys(headers).length > 0 ? headers : undefined, body: probe.with?.body }
        : undefined;

      const finalProbe: Probe = {
        ...probe,
        tags: Object.keys(tags).length > 0 ? tags : undefined,
        with: withBlock,
        alerts: (probe.alerts ?? []).filter((a) => a.url.trim()),
        expectations: probe.expectations?.filter((e) => e.value.trim()),
      };

      if (initial) {
        await updateProbe(initial.name, finalProbe);
      } else {
        await createProbe(finalProbe);
      }
      onSuccess();
    } catch (err) {
      toast(String(err), { variant: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Basic */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Basic</h3>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            isDisabled={!!initial}
            isInvalid={!!errors.name}
            value={probe.name}
            onChange={(v) => set("name", v)}
          >
            <Label>Name</Label>
            <Input placeholder="my-service" />
            {errors.name && <FieldError>{errors.name}</FieldError>}
          </TextField>

          <Select
            selectedKey={probe.http_method}
            onSelectionChange={setHttpMethod}
          >
            <Label>HTTP Method</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {HTTP_METHODS.map((m) => (
                  <ListBox.Item key={m} id={m} textValue={m}>{m}</ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <TextField
          isInvalid={!!errors.url}
          value={probe.url}
          onChange={(v) => set("url", v)}
        >
          <Label>URL</Label>
          <Input placeholder="https://example.com/health" />
          {errors.url && <FieldError>{errors.url}</FieldError>}
        </TextField>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="number"
            isInvalid={!!errors.interval}
            value={String(probe.schedule.interval)}
            onChange={(v) => setSchedule("interval", Number(v))}
          >
            <Label>Interval (seconds)</Label>
            <Input min={1} />
            {errors.interval && <FieldError>{errors.interval}</FieldError>}
          </TextField>

          <TextField
            type="number"
            value={String(probe.schedule.initial_delay)}
            onChange={(v) => setSchedule("initial_delay", Number(v))}
          >
            <Label>Initial Delay (seconds)</Label>
            <Input min={0} />
          </TextField>
        </div>

        <Switch
          isSelected={probe.sensitive}
          onChange={(v) => set("sensitive", v)}
          size="sm"
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <Label className="text-sm">Sensitive (redact response body)</Label>
          </Switch.Content>
        </Switch>
      </section>

      <Separator />

      {/* Expectations */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Expectations</h3>
          <Button size="sm" variant="ghost" onPress={addExpectation}>
            <Icon icon="gravity-ui:plus" className="size-3" />
            Add
          </Button>
        </div>
        {(probe.expectations ?? []).map((exp, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Select
              selectedKey={exp.field}
              onSelectionChange={(key) => setExpectationField(idx, key)}
            >
              <Label className="sr-only">Field</Label>
              <Select.Trigger className="w-36">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {EXPECT_FIELDS.map((f) => (
                    <ListBox.Item key={f} id={f} textValue={f}>{f}</ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              selectedKey={exp.operation}
              onSelectionChange={(key) => setExpectationOperation(idx, key)}
            >
              <Label className="sr-only">Operation</Label>
              <Select.Trigger className="w-40">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {EXPECT_OPERATIONS.map((op) => (
                    <ListBox.Item key={op} id={op} textValue={op}>{op}</ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Input
              aria-label="Expected value"
              className="flex-1"
              placeholder="Value"
              value={exp.value}
              onChange={(e) => updateExpectation(idx, { value: e.target.value })}
            />

            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => removeExpectation(idx)}
            >
              <Icon icon="gravity-ui:trash-bin" className="size-3 text-danger" />
            </Button>
          </div>
        ))}
        {(probe.expectations ?? []).length === 0 && (
          <p className="text-xs text-muted">No expectations - any response will be success.</p>
        )}
      </section>

      <Separator />

      {/* Headers & Body */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Request Headers</h3>
        <div className="flex flex-col gap-1">
          <Label htmlFor="headers-raw">Headers (one per line: Key: Value)</Label>
          <TextArea
            id="headers-raw"
            placeholder={"user-agent: MyProbe/1.0\nAuthorization: Bearer token"}
            value={headersRaw}
            onChange={(e) => setHeadersRaw(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="body-raw">Request Body (optional)</Label>
          <TextArea
            id="body-raw"
            placeholder='{"key": "value"}'
            value={probe.with?.body ?? ""}
            onChange={(e) =>
              setProbe((prev) => ({ ...prev, with: { ...prev.with, body: e.target.value || undefined } }))
            }
            rows={3}
          />
        </div>
      </section>

      <Separator />

      {/* Alerts */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Alert Webhooks</h3>
          <Button size="sm" variant="ghost" onPress={addAlert}>
            <Icon icon="gravity-ui:plus" className="size-3" />
            Add
          </Button>
        </div>
        {(probe.alerts ?? []).map((alert, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              aria-label={`Webhook URL #${idx + 1}`}
              className="flex-1"
              placeholder="https://webhook.site/..."
              value={alert.url}
              onChange={(e) => updateAlert(idx, e.target.value)}
            />
            <Button isIconOnly size="sm" variant="ghost" onPress={() => removeAlert(idx)}>
              <Icon icon="gravity-ui:trash-bin" className="size-3 text-danger" />
            </Button>
          </div>
        ))}
        {(probe.alerts ?? []).length === 0 && (
          <p className="text-xs text-muted">No alert webhooks configured.</p>
        )}
      </section>

      <Separator />

      {/* Tags */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Tags</h3>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tags-raw">Tags (one per line: key=value)</Label>
          <TextArea
            id="tags-raw"
            placeholder={"system=backend\ncomponent=api\nowner=you@example.com"}
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onPress={onCancel} isDisabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onPress={handleSubmit} isPending={saving}>
          {initial ? "Save Changes" : "Create Monitor"}
        </Button>
      </div>
    </div>
  );
}
