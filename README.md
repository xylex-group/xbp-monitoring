[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/ocw6Rt?referralCode=mxPhG_&utm_medium=integration&utm_source=template&utm_campaign=generic)

# XBP Monitoring

XBP Monitoring is a Rust-based synthetic monitoring service for running scheduled HTTP probes and multi-step stories, exposing a lightweight management API, a web dashboard, and OpenTelemetry / Prometheus observability hooks.

It is designed for teams that want a simple monitor runner that can:

- check single endpoints on an interval,
- execute chained workflows with step-to-step variable passing,
- inspect recent runs through an API or dashboard,
- export metrics and traces for operational visibility.

## What it does

### Core capabilities

- **HTTP probes** for health checks and simple endpoint validation
- **Stories** for multi-step workflows with variable substitution between steps
- **Dashboard** for configuration editing, triggering runs, and browsing recent results
- **API** for reading probe/story status, results, config, restart hooks, and telemetry state
- **Telemetry** through OpenTelemetry traces and Prometheus-compatible metrics
- **Container support** with production and development Docker / Compose files

### Good fit for

- API uptime and regression checks
- smoke tests against internal services
- synthetic user journeys with chained HTTP requests
- low-overhead operational visibility for small to midsize teams

## Architecture at a glance

- **Backend**: Rust 2021, `axum`, `tokio`, `reqwest`, `tracing`
- **Dashboard**: Next.js app exported as static assets and served by the Rust backend in production
- **Config**: YAML via `xbp.yml`
- **Metrics**: Prometheus endpoint on the main API server and optionally a dedicated metrics listener
- **Tracing**: OpenTelemetry exporters for traces and metrics

## Quick start

### Prerequisites

- Rust stable toolchain
- Node.js 20+
- `pnpm` (or Corepack-enabled Node)

### Local development

1. Copy environment defaults:
  - copy `.env.example` to `.env`
2. Install dashboard dependencies:
  - `pnpm install`
3. Build the dashboard static bundle:
  - `pnpm run build`
4. Start the backend:
  - `cargo run -- --file xbp.yml`

Once started:

- API: `http://127.0.0.1:3000`
- Dashboard: `http://127.0.0.1:3000/dashboard`
- Metrics: `http://127.0.0.1:3000/metrics` when Prometheus export is enabled

### Dashboard development mode

For UI work, run the backend and dashboard separately:

- Backend: `cargo run -- --file xbp.yml`
- Dashboard dev: `pnpm run dev`

In this mode:

- Rust backend serves API on `http://127.0.0.1:3000`
- Next dev server runs on `http://127.0.0.1:3001/dashboard`
- API requests from the dashboard are proxied to the backend

If the UI starts returning HTML for API requests, it usually means the dashboard is running without the backend on port `3000`. Tiny bug, classic vibes.

## Docker

### Production-style compose

The repository includes:

- `Dockerfile.backend`
- `dashboard/Dockerfile`
- `docker-compose.yml`

Run both services:

- `docker compose up --build`

Services:

- Backend: `http://localhost:3000`
- Dashboard: `http://localhost:3001/dashboard`
- Dedicated metrics listener: `http://localhost:9464/metrics` when enabled

### Development compose

The repository also includes a development override:

- `Dockerfile.backend.dev`
- `dashboard/Dockerfile.dev`
- `docker-compose.override.yml`

This setup adds:

- source mounts,
- backend auto-reload with `cargo-watch`,
- dashboard dev server inside the container,
- container-aware dashboard API proxying.

Run development containers:

- `docker compose up --build`

Because Docker Compose automatically loads `docker-compose.override.yml`, the same command gives you the development experience locally.

## Configuration

XBP Monitoring loads configuration from `xbp.yml` by default.

Override the file path with:

- `cargo run -- --file path/to/config.yml`

### Example probe

```yaml
probes:
  - name: api-health-check
   url: https://example.com/health
   http_method: GET
   schedule:
    initial_delay: 0
    interval: 60
   expectations:
    - field: StatusCode
      operation: Equals
      value: "200"
   alerts: []
   sensitive: false
```

### Variable substitution

Supported substitutions include:

- `${{steps.<step-name>.response.body}}`
- `${{steps.<step-name>.response.body.<field>}}`
- `${{generate.uuid}}`
- `${{ env.VAR_NAME }}`

Environment variables referenced from YAML substitute to an empty string when missing, while also logging a warning.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed.

Important variables:

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL`
- `OTEL_EXPORTER_OTLP_TIMEOUT`
- `OTEL_METRICS_EXPORTER`
- `OTEL_TRACES_EXPORTER`
- `OTEL_EXPORTER_PROMETHEUS_HOST`
- `OTEL_EXPORTER_PROMETHEUS_PORT`
- `OTEL_RESOURCE_ATTRIBUTES`
- `XBP_LOKI_ENABLED`
- `XBP_LOKI_URL`
- `XBP_LOKI_JOB`
- `XBP_LOKI_ENV`
- `XBP_RESTART_CMD`

See also:

- `.env.example`
- `.env.example.github`

## API surface

The application currently exposes endpoints such as:

- `/`
- `/probes`
- `/probes/:name/results`
- `/probes/:name/trigger`
- `/stories`
- `/stories/:name/results`
- `/stories/:name/trigger`
- `/api/config`
- `/api/restart`
- `/api/telemetry`
- `/metrics`

OpenAPI definition:

- `openapi.yaml`

## Dashboard

The dashboard is available at `/dashboard` and supports:

- viewing probe and story status,
- triggering probes and stories,
- inspecting recent results,
- editing `xbp.yml` via the config API,
- restarting the service through `/api/restart` when `XBP_RESTART_CMD` is configured.

## Observability

### Metrics

When `OTEL_METRICS_EXPORTER=prometheus`:

- main server exposes `/metrics` on port `3000`
- dedicated listener can expose `/metrics` on `OTEL_EXPORTER_PROMETHEUS_HOST:OTEL_EXPORTER_PROMETHEUS_PORT`

Metrics include:

- runs counter
- duration histogram (milliseconds)
- errors counter
- status gauge
- HTTP status code gauge

### Tracing

When tracing is enabled, outbound requests propagate OpenTelemetry context and record attributes including:

- `http.method`
- `http.url`
- `http.status_code`

For sensitive probes and steps, response bodies are not attached to spans.

### Logging

Structured logging is implemented with `tracing`.

Optional Loki support is available through:

- `XBP_LOKI_ENABLED=true`
- `XBP_LOKI_URL=http://localhost:3100`

## Development workflow

### Useful commands

- `cargo run -- --file xbp.yml`
- `cargo fmt --all`
- `cargo clippy --all-targets --all-features`
- `cargo test`
- `pnpm run dev`
- `pnpm run build`
- `pnpm run typecheck`

### Repository scripts

The root `package.json` includes convenience commands for dashboard work. Additional Docker helper scripts are also available there.

## CI and releases

GitHub Actions workflows are included for:

- linting
- build verification
- release creation
- Docker image publishing

Current workflow files live under `.github/workflows/`.

## Security and privacy

- Sensitive probes and steps avoid exposing raw response bodies in logs and alerts.
- Secrets should be provided via environment variables rather than hardcoded in YAML.
- The metrics and management APIs are currently intended for trusted environments.

If you discover a security issue, please follow the process in `SECURITY.md`.

## Contributing

Contributions are welcome.

Before opening a PR:

- format with `cargo fmt --all`
- lint with `cargo clippy --all-targets --all-features`
- run `cargo test`
- typecheck the dashboard with `pnpm run typecheck`

See `CONTRIBUTING.md` for the recommended workflow.

## Roadmap

Planned and in-progress ideas are tracked in `TODO.md`. Current themes include:

- stronger Prometheus support,
- dashboard and config workflow improvements,
- authentication and multi-tenancy,
- richer monitor types,
- optional persistence and management APIs.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/ocw6Rt?referralCode=mxPhG_&utm_medium=integration&utm_source=template&utm_campaign=generic)

# Project overview

- XBP-Monitoring is a Rust 2021 synthetic monitoring service using `axum` for HTTP, `tokio` runtime, `reqwest` for outbound calls, `tracing` for logs, and OpenTelemetry for traces/metrics. It exposes a JSON API and optionally a Prometheus endpoint.

## Language, toolchain, formatting

- use rust edition 2021. prefer stable toolchain.
- Always run `cargo fmt` and `cargo clippy -D warnings` on edits.
- Keep code readable with descriptive names; avoid single-letter or abbreviated identifiers.

## Dependencies and architecture

- Web server: `axum` 0.7; return `axum::Json<T>` for JSON responses; inject shared state via `Extension<Arc<AppState>>`.
- Async runtime: `tokio` 1.x; never block the runtime (no std::thread::sleep).
- HTTP client: `reqwest` 0.11 with a single reused client via `lazy_static!`. Reuse the existing client(s) instead of creating new ones.
- Telemetry: OpenTelemetry via `opentelemetry`, `opentelemetry-otlp`, `opentelemetry-prometheus`, `tracing`, `tracing-subscriber`.

## Error handling

- Functions that cross async/task boundaries should return `Result<T, Box<dyn std::error::Error + Send>>` (or `Box<dyn Error + Send>` for errors) to preserve sendability.
- Prefer converting third-party errors with `MapToSendError` (see `errors.rs`) rather than `.unwrap()` or `.expect()`.
- Only use `.unwrap()` in tests or truly infallible contexts; otherwise bubble errors up.
- When implementing errors, implement `std::fmt::Display` and `std::error::Error`.

## Logging and tracing

- Use `tracing` macros (`trace!`, `debug!`, `info!`, `warn!`, `error!`), not `println!`.
- Instrument work with OpenTelemetry spans. For HTTP calls: propagate context using `opentelemetry_http::HeaderInjector`; attach attributes:
  - HTTP spans: `http.method`, `http.url`, `http.status_code`
  - Step/probe/story spans: `name`, `type` (probe|story|step), and `story_name` on step spans
- On errors or expectation failures: record error on the active span and set span status to error.
- Respect sensitive data: if an operation is marked `sensitive`, do not log or attach response body; use “Redacted”.

## Metrics

- Use the existing `Metrics` in `src/otel/metrics.rs`:
  - `runs` (Counter\<u64\>)
  - `duration` (Histogram\<u64\>, milliseconds)
  - `errors` (Counter\<u64\>)
  - `status` (Gauge\<u64\>, 0=OK, 1=Error)
  - `http_status_code` (Gauge\<u64\>, 0 if HTTP call failed)
- Always include attributes `name` and `type` (probe|story|step). Steps also include `story_name`.
- If you add new monitors or flows, ensure metrics update paths mirror existing patterns.

## Environment Variables

### Application Environment Variables

Copy `.env.example` to `.env` and configure as needed:

#### OpenTelemetry Configuration

- **`OTEL_EXPORTER_OTLP_ENDPOINT`** (default: `http://localhost:4317`)
  - Endpoint for OTLP exporter (traces and metrics)

- **`OTEL_EXPORTER_OTLP_PROTOCOL`** (default: `grpc`)
  - Protocol options: `grpc`, `http/protobuf`, `http/json`

- **`OTEL_EXPORTER_OTLP_TIMEOUT`** (default: `10`)
  - Timeout in seconds for OTLP exporter operations

- **`OTEL_METRICS_EXPORTER`** (optional)
  - Options: `otlp`, `stdout`, `prometheus`
  - Unset = metrics disabled
  - Set to `prometheus` to enable Prometheus metrics endpoint

- **`OTEL_TRACES_EXPORTER`** (optional)
  - Options: `otlp`, `stdout`
  - Unset = traces disabled
  - Set to `stdout` for local development to print spans to console

- **`OTEL_EXPORTER_PROMETHEUS_HOST`** (default: `localhost`)
  - Host for Prometheus metrics endpoint (only used when `OTEL_METRICS_EXPORTER=prometheus`)

- **`OTEL_EXPORTER_PROMETHEUS_PORT`** (default: `9464`)
  - Port for dedicated Prometheus metrics listener (only used when `OTEL_METRICS_EXPORTER=prometheus`)

- **`OTEL_RESOURCE_ATTRIBUTES`** (optional)
  - Standard OpenTelemetry resource attributes
  - Example: `service.name=xbp-monitoring,service.version=1.0.0`

- **`XBP_LOKI_ENABLED`** (optional, default: `false`)
  - Set to `true` or `1` to push logs to Loki via tracing subscriber.

- **`XBP_LOKI_URL`** (optional, default: `http://localhost:3100`)
  - Loki base URL used for log ingestion.

- **`XBP_LOKI_JOB`** (optional, default: unset)
  - Adds `job` label to Loki streams.

- **`XBP_LOKI_ENV`** (optional, default: unset)
  - Adds `env` label to Loki streams.

#### Custom Environment Variables

Any custom environment variables can be referenced in `xbp.yml` config files using:

```yaml
url: https://api.example.com/${{ env.API_KEY }}
```

#### Operational Environment Variables

- **`XBP_RESTART_CMD`** (optional) – Shell command that the dashboard calls when `/api/restart` is invoked. Examples: `systemctl restart xbp-monitoring` or a custom script that orchestrates the restart. Leave unset to keep the restart action disabled.

### GitHub Workflow Environment Variables

See `.env.example.github` for detailed documentation of all GitHub workflow environment variables and secrets.

#### Docker Build Workflow (`.github/workflows/docker.yaml`)

- **`REGISTRY`** (default: `ghcr.io`)
  - Container registry domain (set in workflow)

- **`IMAGE_NAME`** (default: `${{ github.repository }}`)
  - Docker image name (set in workflow)

- **`GITHUB_TOKEN`** (GitHub secret, auto-provided)
  - Used for authentication to GitHub Container Registry

#### Test Workflow (`.github/workflows/test.yaml`)

- **`CARGO_TERM_COLOR`** (set to `always`)
  - Enables colored output for cargo commands

#### Release Workflow (`.github/workflows/release.yaml`)

- **`GITHUB_TOKEN`** (GitHub secret, auto-provided)
  - Used for creating GitHub releases

#### Lint Workflow (`.github/workflows/lint.yaml`)

- No environment variables required

## HTTP clients and timeouts

- Use the module-level `reqwest::Client` singletons (via `lazy_static!`) with user-agent:
  - Probes: `XBP Probe/0.9.4`
  - Alerts: `XBP Alert/0.9.4`
- Apply request timeouts (default 10s for probes; alerts use 10s); make timeouts configurable via parameters where relevant.
- Propagate trace headers on outbound requests.

## State and concurrency

- Shared state is in `AppState` guarded by `RwLock`s. Do not hold locks across `.await` points.
- Clone `Arc<AppState>` when spawning tasks; ensure spawned tasks are `Send`.
- Scheduling:
  - Use `tokio::spawn` with the provided `probing_loop` pattern.
  - Never block the loop; sleep using `tokio::time`.

## Web API conventions

- Routes live under `src/web_server`. Follow existing route structure and response types.
- Prefer returning `Json<T>` with serializable DTOs from `src/web_server/model.rs`.
- Avoid panics in handlers. If you touch these, replace `.unwrap()` with graceful error responses and proper status codes.
- Honor `show_response` query param: if false, strip bodies before returning.

## Web Dashboard

- Visit `/dashboard` to open a lightweight cockpit for probes, stories, configuration, and restart controls.
- Trigger buttons call `/probes/:name/trigger` or `/stories/:name/trigger` and update the detail panes via the same history endpoints.
- The configuration editor reads and writes `xbp.yml` through `/api/config`; writes persist immediately but the service must restart before new settings take effect.
- Pressing the restart button sends a POST to `/api/restart` and executes the shell command in `XBP_RESTART_CMD`.
- **Building the dashboard**: before running `cargo run`, go to the `dashboard/` directory, install dependencies (`npm install`), and run `npm run build`. That produces the static files in `dashboard/out/`, which the Rust server serves at `/dashboard`.

### Dashboard local development (Next + Rust)

- Rust backend serves API endpoints on `http://127.0.0.1:3000`.
- Dashboard dev server runs on `http://127.0.0.1:3001/dashboard`.
- Next rewrites proxy `/api/*`, `/probes/*`, and `/stories/*` from port `3001` to Rust on port `3000`.
- Start backend first, then run dashboard dev in another terminal to avoid API 404 HTML responses.

## Config and YAML

- Deserialize config with `serde_yaml`; top-level shape is `Config { probes, stories }`.
- Preserve variable substitution semantics (leading and trailing whitespace is optional and trimmed):
  - `${{steps.<step-name>.response.body}}` → entire body
  - `${{steps.<step-name>.response.body.<field>}}` → JSON field
  - `${{generate.uuid}}` → new UUID
  - `${{ env.VAR_NAME }}` → environment variable (logs a warning if missing; substitutes empty string)
- Keep `#[serde(default)]` for optional vectors/fields and `#[serde(skip_serializing_if = "Option::is_none")]` for optional outputs.

## Expectations

- Supported fields: `StatusCode`, `Body`
- Supported ops: `Equals`, `NotEquals`, `Contains`, `NotContains`, `Matches` (regex), `IsOneOf` (pipe-separated)
- Maintain existing evaluation flow; add new ops in `probe::expectations` while keeping pure, testable functions.

## Testing

- Use `#[tokio::test]` with `wiremock` for HTTP mocking. Avoid real network calls.
- Keep tests deterministic and fast; prefer short delays in mocks where necessary.
- Include tracing setup in tests that validate header propagation.

## Security and privacy

- Respect `sensitive: bool` on probes/steps:
  - Do not log or include raw response bodies in alerts/metrics when sensitive.
  - Use truncated bodies (<=500 chars) only for non-sensitive responses.
- Never include secrets in logs; prefer environment variables for secret material.

## Style and structure

- Follow module structure: domain logic under `src/probe`, telemetry under `src/otel`, web under `src/web_server`, alerts under `src/alerts`.
- Keep functions small with early returns; avoid deep nesting.
- Prefer explicit types in public APIs; keep generics constrained.
- Minimize clones; where needed, clone only cheap types or use references.

## When making changes

- Do not introduce new global clients; reuse existing singletons and patterns.
- Add observability (tracing + metrics) to new flows that perform external IO or meaningful work.
- Update README and config examples only if you change the public behavior or configuration surface.
- If adding metrics or attributes, ensure they are consistently attached for probes, stories, and steps.

## Developer quickstart

- Build/run:
  - `cargo run -- --file xbp.yml`
- Format/lint:
  - `cargo fmt --all`
  - `cargo clippy -D warnings`
- Tests:
  - `cargo test`

## Local observability

- Traces:
  - Set `OTEL_TRACES_EXPORTER=stdout` to print spans to stdout locally.
- Metrics (Prometheus):
  - Set `OTEL_METRICS_EXPORTER=prometheus`.
  - Main API server exposes `/metrics` on port `3000`.
  - Dedicated listener also binds using `OTEL_EXPORTER_PROMETHEUS_HOST` (default `localhost`) and `OTEL_EXPORTER_PROMETHEUS_PORT` (default `9464`).
  - Scrape path is `/metrics` on both endpoints.

- Loki logs (optional):
  - Set `XBP_LOKI_ENABLED=true`.
  - Configure `XBP_LOKI_URL` (default `http://localhost:3100`).
  - Optionally add `XBP_LOKI_JOB` and `XBP_LOKI_ENV` labels.

## HTTP clients (reuse only)

- Probes HTTP client (singleton): `src/probe/http_probe.rs` (user-agent `XBP Probe/0.9.4`).
- Alerts HTTP client (singleton): `src/alerts/outbound_webhook.rs` (user-agent `XBP Alert/0.9.4`).
- These are created via `lazy_static!`; do not introduce new clients—reuse these.

## Timeouts

- Probes:
  - Default request timeout: 10s (`DEFAULT_REQUEST_TIMEOUT_SECS` in `src/probe/http_probe.rs`).
  - Override per-call with `with.timeout_seconds` (`ProbeInputParameters.timeout_seconds`).
- Alerts:
  - Webhook timeout: 10s (`REQUEST_TIMEOUT_SECS` in `src/alerts/outbound_webhook.rs`).

## Web API routes (for reference)

- `/`
- `/probes`
- `/probes/:name/results`
- `/probes/:name/trigger`
- `/stories`
- `/stories/:name/results`
- `/stories/:name/trigger`
- `/api/telemetry` (runtime telemetry status: OTEL exporters, Prometheus availability, Loki config)
- `/metrics` (on the main API server when `OTEL_METRICS_EXPORTER=prometheus`; otherwise returns 503)
- Dedicated `/metrics` listener on `OTEL_EXPORTER_PROMETHEUS_HOST:OTEL_EXPORTER_PROMETHEUS_PORT` when Prometheus is enabled

## Config entry points

- Default config file is `xbp.yml`. Override via CLI: `--file <path>`.
- YAML loading and variable substitution live in `src/config.rs`.

## Telemetry for outbound HTTP

- Create/enter a span and propagate context headers using `opentelemetry_http::HeaderInjector`.
- Set attributes for each call: `http.method`, `http.url`, and `http.status_code`.
- For `sensitive: true`, do not attach response bodies to spans; otherwise, truncate bodies to <= 500 chars.

## Testing tips

- Use `wiremock` for HTTP; avoid real network calls.
- Keep tests deterministic with short, bounded delays only where necessary.


## Non-goals

- Do not introduce a new web framework, DI container, or async runtime.
- Do not add database persistence without explicit instruction.
