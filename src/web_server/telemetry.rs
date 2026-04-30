use std::{env, sync::Arc};

use axum::{extract::Extension, Json};

use crate::app_state::AppState;

use super::model::TelemetryStatusResponse;

fn is_true_like(value: &str) -> bool {
    value.eq_ignore_ascii_case("1") || value.eq_ignore_ascii_case("true")
}

pub async fn telemetry_status(
    Extension(state): Extension<Arc<AppState>>,
) -> Json<TelemetryStatusResponse> {
    let metrics_exporter = env::var("OTEL_METRICS_EXPORTER").unwrap_or_else(|_| "unset".into());
    let traces_exporter = env::var("OTEL_TRACES_EXPORTER").unwrap_or_else(|_| "unset".into());

    let prometheus_enabled = state.prometheus_registry.is_some();
    let prometheus_main_endpoint = prometheus_enabled.then_some("/metrics".to_string());

    let prometheus_host =
        env::var("OTEL_EXPORTER_PROMETHEUS_HOST").unwrap_or_else(|_| "localhost".into());
    let prometheus_port =
        env::var("OTEL_EXPORTER_PROMETHEUS_PORT").unwrap_or_else(|_| "9464".into());
    let prometheus_dedicated_endpoint = prometheus_enabled.then_some(format!(
        "http://{}:{}/metrics",
        prometheus_host, prometheus_port
    ));

    let loki_enabled = env::var("XBP_LOKI_ENABLED")
        .map(|value| is_true_like(&value))
        .unwrap_or(false);

    let loki_url = env::var("XBP_LOKI_URL").ok();
    let loki_job = env::var("XBP_LOKI_JOB").ok();
    let loki_env = env::var("XBP_LOKI_ENV").ok();

    Json(TelemetryStatusResponse {
        metrics_exporter,
        prometheus_enabled,
        prometheus_main_endpoint,
        prometheus_dedicated_endpoint,
        traces_exporter,
        loki_enabled,
        loki_url,
        loki_job,
        loki_env,
    })
}
