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

For a deeper technical overview, see `docs/architecture.md`.

## Quick start

### Prerequisites

- Rust stable toolchain
- Node.js 20+
- `pnpm` (or Corepack-enabled Node)

### Local development

1. Copy environment defaults:
   - `copy .env.example .env` on Windows, or the equivalent for your shell
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

Optional dashboard env overrides:

- `BACKEND_BASE_URL=http://127.0.0.1:3000` controls the Next dev proxy target
- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3000` sets the dashboard's default direct API URL

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

The dashboard container is static-only and does not reverse proxy API traffic through nginx. In local Compose, `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:3000`; in hosted environments, point it at your public backend URL.

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

The dashboard container also reads `NEXT_PUBLIC_API_BASE_URL` at startup and writes it into a small runtime config file, so you can point the UI at a separate backend origin without rebuilding the image.

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
- `XBP_CORS_ENABLED`
- `XBP_CORS_ALLOW_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `BACKEND_BASE_URL`

Cross-origin dashboard access:

- Set `XBP_CORS_ENABLED=true` on the backend to emit CORS headers.
- Set `XBP_CORS_ALLOW_ORIGINS=https://monitoring-v2.xbp.app` (or `*`) to control which origins may call the API.
- Set `NEXT_PUBLIC_API_BASE_URL=https://xbp-monitoring-production-8e98.up.railway.app` on the dashboard when it is hosted on a different origin from the backend.

The dashboard stores a user-selected API URL in browser local storage, so operators can still override the env default from the Config page when needed.

If you deploy the dashboard without a sibling `backend` container, this direct API URL configuration is required; the nginx image intentionally avoids container-name upstream dependencies so it can boot cleanly in standalone platforms such as Railway.

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

When the dashboard is hosted on a different origin, it calls `/probes`, `/stories`, and `/api/*` directly against the configured backend base URL.

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

- `pnpm run verify`
- `pnpm run docker:up`
- `pnpm run docker:down`
- `pnpm run docker:config`

## CI and releases

GitHub Actions workflows are included for:

- Rust formatting and clippy validation
- dashboard TypeScript validation
- backend build and test verification
- dashboard production build verification
- GitHub release creation for version tags
- Docker image publishing for both backend and dashboard images

Current workflow files live under `.github/workflows/`.

Release notes and unreleased changes can be tracked in `CHANGELOG.md`.

Published container targets are designed around the two shipped deployables:

- backend image: `ghcr.io/<owner>/<repo>-backend`
- dashboard image: `ghcr.io/<owner>/<repo>-dashboard`

## Docs and project conventions

- `README.md` — operator and contributor quickstart
- `docs/architecture.md` — system structure and runtime model
- `CONTRIBUTING.md` — contribution workflow
- `SECURITY.md` — vulnerability reporting and deployment guidance
- `CHANGELOG.md` — release history and unreleased changes
- `TODO.md` — roadmap themes and backlog

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
