use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use std::sync::Arc;
use tracing::debug;

use crate::{
    app_state::AppState,
    probe::{model::ProbeResult, probe_logic::Monitorable},
};

use super::model::{ProbeQueryParams, ProbeResponse};

pub async fn get_probe_results(
    Path(name): Path<String>,
    Query(params): Query<ProbeQueryParams>,
    Extension(state): Extension<Arc<AppState>>,
) -> Json<Vec<ProbeResult>> {
    debug!("Get probe results called");

    let show_response = params.show_response.unwrap_or(false);
    let read_lock = state.probe_results.read().unwrap();
    let mut cloned_results: Vec<ProbeResult> = read_lock.get(&name).cloned().unwrap_or_default();
    cloned_results.reverse();

    if !show_response {
        for result in &mut cloned_results {
            result.response = None;
        }
    }

    Json(cloned_results)
}

pub async fn probes(Extension(state): Extension<Arc<AppState>>) -> Json<Vec<ProbeResponse>> {
    debug!("Get probes called");

    let read_lock = state.probe_results.read().unwrap();
    let mut response = Vec::with_capacity(state.config.probes.len());

    for probe in &state.config.probes {
        let last_result = read_lock
            .get(&probe.name)
            .and_then(|results| results.last());
        let status = match last_result {
            Some(last) => {
                if last.success {
                    "OK"
                } else {
                    "FAILING"
                }
            }
            None => "PENDING",
        };
        response.push(ProbeResponse {
            name: probe.name.clone(),
            status: status.to_owned(),
            last_probed: last_result.map(|last| last.timestamp_started),
        });
    }

    Json(response)
}

pub async fn probe_trigger(
    Path(name): Path<String>,
    Extension(state): Extension<Arc<AppState>>,
) -> impl IntoResponse {
    debug!("Probe trigger called");

    let Some(probe) = state.config.probes.iter().find(|x| x.name == name) else {
        return (
            StatusCode::NOT_FOUND,
            format!("Probe '{}' not found", name),
        )
            .into_response();
    };

    probe.probe_and_store_result(state.clone()).await;

    let lock = state.probe_results.read().unwrap();
    let Some(probe_results) = lock.get(&name) else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Probe '{}' did not store a result", name),
        )
            .into_response();
    };

    let Some(last_result) = probe_results.last() else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Probe '{}' has no stored results", name),
        )
            .into_response();
    };

    Json(last_result.clone()).into_response()
}
