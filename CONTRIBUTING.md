# Contributing to XBP Monitoring

Thanks for contributing to XBP Monitoring.

## Development setup

### Backend

- Install Rust stable
- Run the service with:
  - `cargo run -- --file xbp.yml`

### Dashboard

- Install Node.js 20+
- Enable Corepack if needed
- Install dependencies:
  - `pnpm install`
- Start dashboard dev server:
  - `pnpm run dev`

## Before opening a pull request

Please run the following where applicable:

- `cargo fmt --all`
- `cargo clippy --all-targets --all-features`
- `cargo test`
- `pnpm run typecheck`
- `pnpm run build`

## Coding guidelines

- Prefer descriptive names over abbreviations
- Avoid introducing new global HTTP clients
- Reuse existing tracing and metrics patterns
- Do not block the async runtime
- Keep functions small and readable with early returns where possible

## Documentation expectations

If you change public behavior, also update the relevant docs:

- `README.md`
- `openapi.yaml`
- `.env.example` or `.env.example.github`
- configuration examples such as `xbp.yml`

## Pull requests

A good pull request usually includes:

- a concise problem statement
- a summary of the chosen approach
- validation notes (tests, typechecks, manual verification)
- screenshots for dashboard changes when relevant

## Security

Please do not open public issues for sensitive vulnerabilities. See `SECURITY.md` instead.
