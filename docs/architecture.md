# Architecture

## Overview

XBP Monitoring is a lightweight synthetic monitoring service built around a Rust backend and a dashboard frontend.

At a high level, the system:

1. loads monitor definitions from `xbp.yml`,
2. schedules probes and stories in memory,
3. executes outbound HTTP requests using shared clients,
4. stores recent results in application state,
5. exposes status and history through HTTP APIs,
6. publishes telemetry for operators.

## Main components

### Backend (`src/`)

The backend is organized into a few main areas:

- `src/main.rs`
  - startup entrypoint
  - loads config
  - initializes OpenTelemetry
  - starts background scheduling and HTTP servers

- `src/config.rs`
  - YAML loading
  - variable substitution
  - config parsing into runtime structures

- `src/app_state.rs`
  - shared in-memory application state
  - runtime config and recent result storage

- `src/probe/`
  - probe and story execution logic
  - expectations
  - HTTP request execution
  - scheduling
  - variable interpolation for multi-step workflows

- `src/web_server/`
  - HTTP routes for probes, stories, config editing, telemetry, restart, and metrics

- `src/otel/`
  - OpenTelemetry setup
  - metrics registry and exporter wiring
  - tracing setup

- `src/alerts/`
  - outbound alert integrations
  - webhook delivery and integration-specific behavior

## Dashboard (`dashboard/`)

The dashboard is a Next.js application.

### Production mode

- built as a static export
- served by the Rust backend at `/dashboard`
- API calls are same-origin in production

### Development mode

- runs on port `3001`
- proxies `/api/*`, `/probes/*`, and `/stories/*` to the Rust backend on port `3000`
- in Docker development mode, the proxy target is configurable with `BACKEND_BASE_URL`

## Execution model

### Probes

A probe is a single HTTP request with expectations.

Typical flow:

1. schedule fires
2. request is executed with shared `reqwest` client
3. expectations are evaluated
4. result is stored
5. metrics and traces are emitted
6. alerts may be triggered on failure

### Stories

A story is a sequence of steps executed in order.

Typical flow:

1. story starts with one trace
2. each step runs sequentially
3. later steps can reference earlier step outputs
4. failure in a step marks the story as failed
5. per-step and per-story telemetry is recorded

## State model

The system currently uses in-memory runtime state guarded by `RwLock`s inside `AppState`.

Implications:

- recent execution history is process-local
- no external persistence is required
- restart behavior is simple but state is ephemeral
- horizontal scaling requires careful design if shared history becomes necessary

## Telemetry model

### Metrics

Metrics include counters, histograms, and gauges for:

- total runs
- durations
- errors
- status
- HTTP status codes

Labels include `name`, `type`, and for story steps also `story_name`.

### Tracing

Outbound HTTP calls propagate OpenTelemetry context and enrich spans with request metadata.

Sensitive responses are deliberately not attached to spans.

## Deployment modes

### Native

- run backend directly with Cargo or a compiled binary
- build dashboard separately before serving static assets

### Containerized

- backend and dashboard can run as separate containers
- production setup uses `docker-compose.yml`
- local development setup uses `docker-compose.override.yml`

## Current design trade-offs

### Strengths

- simple operational footprint
- easy local development
- clear separation between backend execution and frontend dashboard
- good observability hooks for a compact service

### Constraints

- config is YAML file based and currently process-local
- history storage is in-memory rather than persistent
- management and metrics endpoints assume a trusted deployment environment
- multi-tenancy and authentication are not yet first-class features

## Near-term evolution areas

The existing roadmap suggests likely architectural growth in:

- endpoint protection and authentication
- persistent storage for config and results
- richer probe types beyond HTTP
- stronger management APIs
- optional multi-tenant isolation
