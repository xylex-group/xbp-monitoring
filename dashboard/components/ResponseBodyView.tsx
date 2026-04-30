"use client";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

interface Props {
  body: string;
}

function tryParseJson(body: string): JsonValue | null {
  try {
    return JSON.parse(body) as JsonValue;
  } catch {
    return null;
  }
}

function PrimitiveValue({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="text-default-400">null</span>;
  if (typeof value === "boolean") {
    return <span className={value ? "text-success" : "text-danger"}>{String(value)}</span>;
  }
  if (typeof value === "number") return <span className="text-secondary">{value}</span>;
  return <span className="break-words text-default-700 dark:text-default-300">{value}</span>;
}

function JsonNode({ value, depth = 0 }: { value: JsonValue; depth?: number }) {
  const maxDepth = 6;
  if (depth > maxDepth) {
    return <span className="text-default-400">…</span>;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return <PrimitiveValue value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-default-400">[]</span>;

    return (
      <div className="space-y-1">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border border-default-100 px-2 py-1">
            <p className="mb-1 text-[11px] font-semibold uppercase text-default-400">Item {index + 1}</p>
            <JsonNode value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return <span className="text-default-400">{"{}"}</span>;

  return (
    <div className="space-y-1.5">
      {entries.map(([key, child]) => (
        <div key={key} className="rounded-md border border-default-100 p-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-default-500">{key}</p>
          <div className="text-xs">
            <JsonNode value={child} depth={depth + 1} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResponseBodyView({ body }: Props) {
  const parsed = tryParseJson(body);

  if (!parsed) {
    return (
      <pre className="max-h-64 overflow-auto rounded-lg bg-default-50 p-3 text-xs whitespace-pre-wrap dark:bg-default-100/10">
        {body}
      </pre>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-default-50 p-3 text-xs dark:bg-default-100/10">
        <JsonNode value={parsed} />
      </div>
      <details className="rounded-md border border-default-100 px-2 py-1">
        <summary className="cursor-pointer text-[11px] text-default-500">View raw JSON</summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-default-50 p-2 text-[11px] whitespace-pre-wrap dark:bg-default-100/10">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </details>
    </div>
  );
}
