use axum::{
    extract::{Path, Query},
    Extension, Json,
};
use std::sync::Arc;
use tracing::debug;

use crate::{
    app_state::AppState,
    probe::{model::StoryResult, probe_logic::Monitorable},
};

use super::model::{ProbeQueryParams, ProbeResponse};

// TODO: Error handling for all of the endpoints

pub async fn get_story_results(
    Path(name): Path<String>,
    Query(params): Query<ProbeQueryParams>,
    Extension(state): Extension<Arc<AppState>>,
) -> Json<Vec<StoryResult>> {
    debug!("Get story results called");

    let show_response = params.show_response.unwrap_or(false);
    let read_lock = state.story_results.read().unwrap();
    let mut cloned_results: Vec<StoryResult> = read_lock
        .get(&name)
        .map(|results| results.clone())
        .unwrap_or_default();
    cloned_results.reverse();

    if !show_response {
        for result in &mut cloned_results {
            for step_result in &mut result.step_results {
                step_result.response = None;
            }
        }
    }

    Json(cloned_results)
}

pub async fn stories(Extension(state): Extension<Arc<AppState>>) -> Json<Vec<ProbeResponse>> {
    debug!("Get stories called");

    let read_lock = state.story_results.read().unwrap();
    let mut response = Vec::with_capacity(state.config.stories.len());

    for story in &state.config.stories {
        let last_result = read_lock
            .get(&story.name)
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
            name: story.name.clone(),
            status: status.to_owned(),
            last_probed: last_result.map(|last| last.timestamp_started),
        });
    }

    Json(response)
}

pub async fn story_trigger(
    Path(name): Path<String>,
    Extension(state): Extension<Arc<AppState>>,
) -> Json<StoryResult> {
    debug!("Story trigger called");

    let story = &state
        .config
        .stories
        .iter()
        .find(|x| x.name == name)
        .unwrap();

    story.probe_and_store_result(state.clone()).await;

    let lock = state.story_results.read().unwrap();
    let story_results = lock.get(&name).unwrap();

    Json(story_results.last().unwrap().clone())
}
