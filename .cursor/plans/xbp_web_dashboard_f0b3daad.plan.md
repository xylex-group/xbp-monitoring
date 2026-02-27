---
name: XBP Web Dashboard
overview: "Add a small web dashboard to XBP-Monitoring that: (1) queries probes/stories and their results via existing API endpoints, (2) provides a config editor with save-to-file and validation, and (3) supports rebooting the monitoring server via a configurable restart command."
todos: []
isProject: false
---

# XBP Monitoring Web Dashboard

## Current State

- **API**: Axum server on port 3000 with routes: `/`, `/probes`, `/probes/:name/results`, `/probes/:name/trigger`, `/stories`, `/stories/:name/results`, `/stories/:name/trigger`, `/metrics` (Prometheus)
- **Config**: Loaded at startup from `xbp.yml` (or `--file`), stored in `AppState.config`, not writable at runtime
- **Probes/stories lists**: Built from `probe_results` / `story_results` maps, so only items that have run at least once appear (configured-but-never-run probes/stories are invisible)

## Architecture

```mermaid
flowchart TB
    subgraph Dashboard [Dashboard UI]
        Overview[Overview: probes + stories]
        ProbeDetail[Probe Detail: results, trigger]
        StoryDetail[Story Detail: results, trigger]
        ConfigEditor[Config Editor: YAML edit, save]
        RebootBtn[Reboot button]
    end

    subgraph API [New + Existing API]
        GET_probes[GET /probes]
        GET_stories[GET /stories]
        GET_results[GET /probes|stories/:name/results]
        POST_trigger[GET /probes|stories/:name/trigger]
        GET_config[GET /api/config]
        PUT_config[PUT /api/config]
        POST_restart[POST /api/restart]
    end

    subgraph Backend [Rust Backend]
        AppState[AppState]
        ConfigFile[xbp.yml]
        RestartCmd[Restart command]
    end

    Overview --> GET_probes
    Overview --> GET_stories
    ProbeDetail --> GET_results
    ProbeDetail --> POST_trigger
    StoryDetail --> GET_results
    StoryDetail --> POST_trigger
    ConfigEditor --> GET_config
    ConfigEditor --> PUT_config
    RebootBtn --> POST_restart

    GET_probes --> AppState
    GET_stories --> AppState
    PUT_config --> ConfigFile
    POST_restart --> RestartCmd
```



## Implementation Plan

### 1. Extend AppState and Config Path Handling

- Add `config_path: PathBuf` to `AppState` so we know where to write the config (passed from `main.rs` args)
- Update [src/app_state.rs](src/app_state.rs): add `config_path` field and update `AppState::new`
- Update [src/main.rs](src/main.rs): pass `args.file` into `AppState`

### 2. New API Endpoints

Add under `src/web_server/`:


| Method | Path           | Purpose                                                              |
| ------ | -------------- | -------------------------------------------------------------------- |
| GET    | `/api/config`  | Return current config as raw YAML string                             |
| PUT    | `/api/config`  | Accept YAML body, validate with `serde_yaml`, write to `config_path` |
| POST   | `/api/restart` | Execute restart command (from env, e.g. `XBP_RESTART_CMD`)           |


**Config endpoint details:**

- GET: read `AppState.config`, serialize to YAML via `serde_yaml::to_string`, return as `text/yaml`
- PUT: parse body, validate structure (Config), write to `config_path`, return success/error. Consider: in-memory config is not reloaded until restart, so we either document that or implement reload (see below)

**Restart endpoint details:**

- Read `XBP_RESTART_CMD` env var (e.g. `systemctl restart xbp-monitoring` or a custom script)
- If unset: return 501 with message that restart is not configured
- If set: spawn `tokio::process::Command` to run the command; return 202 while it runs in background. The command is responsible for stopping the current process (e.g. systemctl sends SIGTERM)

### 3. Optional: Config Reload Without Full Restart

If we want edits to take effect without a full process restart:

- Add `config: RwLock<Config>` to `AppState` instead of `config: Config`
- On PUT config: write file, parse new config, replace `AppState.config` via write lock
- Reschedule probes/stories: we would need to cancel existing tokio tasks and spawn new ones. This requires refactoring the schedule module to use `AbortHandle` and exposing a “reload monitoring” function. This is more involved; recommend starting with “save + restart” and optionally add reload later.

### 4. Fix Probes/Stories List to Include All Configured Items

Current `/probes` and `/stories` only return items present in `probe_results` / `story_results`. To match the OpenAPI description (“all configured probes”), merge with `config.probes` and `config.stories`:

- For each configured probe: look up last result; if none, return status `"PENDING"` and `last_probed` as null or epoch
- Same for stories

Update [src/web_server/probes.rs](src/web_server/probes.rs) and [src/web_server/stories.rs](src/web_server/stories.rs) accordingly. The `ProbeResponse` model may need `last_probed: Option<DateTime<Utc>>` for pending items.

### 5. Dashboard UI

**Approach**: Single-page dashboard served as static HTML + vanilla JS. No build step, minimal dependencies.

**Option A (recommended): Embedded HTML**

- Create `src/web_server/dashboard.rs` with a handler that returns HTML (or use `include_str!` for a template)
- Route: `GET /dashboard` or `GET /` (replace current root) or mount at `/`
- HTML includes inline or linked CSS/JS; JS fetches `/probes`, `/stories`, `/api/config`, etc.

**Option B: Static files**

- Add `tower-http` with `fs` feature
- Create `static/` or `dashboard/` directory with `index.html`, `app.js`, `styles.css`
- Serve via `ServeDir` at `/dashboard` or `/`

**Dashboard sections:**

- **Overview**: Cards/table for probes and stories (name, status, last_probed), links to detail pages
- **Probe detail**: List of results from `GET /probes/:name/results?show_response=true`, “Trigger” button calling `GET /probes/:name/trigger`
- **Story detail**: Same pattern for stories
- **Config editor**: Textarea with YAML from `GET /api/config`, “Save” button calling `PUT /api/config`, display validation errors
- **Reboot**: Button calling `POST /api/restart` with confirmation dialog

**Styling**: Use a minimal CSS framework (e.g. Pico CSS or similar) via CDN, or simple custom CSS for a clean, readable layout.

### 6. Security Considerations

- Config edit and restart are privileged actions. Consider:
  - Optional API key or basic auth for `/api/config` and `/api/restart` (future enhancement)
  - Or document that the dashboard should be behind a reverse proxy with auth
- For now, keep it open to match the existing “no authentication” API design; add a note in README

### 7. Documentation Updates

- [README.md](README.md): Add “Web Dashboard” section describing `/dashboard`, config editing, restart, and `XBP_RESTART_CMD`
- [.env.example](.env.example): Add `XBP_RESTART_CMD` with example (`systemctl restart xbp-monitoring` or similar)

## File Changes Summary


| File                                 | Change                                                      |
| ------------------------------------ | ----------------------------------------------------------- |
| `src/app_state.rs`                   | Add `config_path: PathBuf`                                  |
| `src/main.rs`                        | Pass config path to AppState; ensure dashboard is reachable |
| `src/web_server/mod.rs`              | Add routes for dashboard and `/api/config`, `/api/restart`  |
| `src/web_server/dashboard.rs` (new)  | Dashboard HTML handler or static route setup                |
| `src/web_server/config_api.rs` (new) | GET/PUT config handlers                                     |
| `src/web_server/restart.rs` (new)    | POST restart handler                                        |
| `src/web_server/probes.rs`           | Merge config with results for full probe list               |
| `src/web_server/stories.rs`          | Merge config with results for full story list               |
| `src/web_server/model.rs`            | `last_probed: Option<DateTime<Utc>>` if needed              |
| `Cargo.toml`                         | Add `tower-http` with `fs` if using static files            |
| `README.md`, `.env.example`          | Document dashboard and `XBP_RESTART_CMD`                    |


## Implementation Order

1. AppState + config path
2. GET/PUT `/api/config` and POST `/api/restart`
3. Fix probes/stories list to include all configured items
4. Dashboard UI (HTML + JS)
5. README and env example updates

