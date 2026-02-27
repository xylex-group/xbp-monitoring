use axum::{
    body::Bytes,
    extract::Extension,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use serde_yaml;
use std::sync::Arc;
use tokio::fs;
use tracing::{debug, error, info};

use crate::{app_state::AppState, config::Config};

pub async fn get_config(Extension(state): Extension<Arc<AppState>>) -> impl IntoResponse {
    debug!("Config GET requested");

    match fs::read_to_string(&state.config_path).await {
        Ok(contents) => {
            let mut headers = HeaderMap::new();
            headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/yaml; charset=utf-8"),
            );

            (StatusCode::OK, headers, contents).into_response()
        }
        Err(err) => {
            error!("Failed to read config: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to read config file: {}", err),
            )
                .into_response()
        }
    }
}

pub async fn put_config(
    Extension(state): Extension<Arc<AppState>>,
    body: Bytes,
) -> impl IntoResponse {
    debug!("Config PUT requested");
    let body_str = match std::str::from_utf8(&body) {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                format!("Config must be valid UTF-8: {}", err),
            )
                .into_response()
        }
    };

    if let Err(err) = serde_yaml::from_str::<Config>(body_str) {
        return (
            StatusCode::BAD_REQUEST,
            format!("Config YAML invalid: {}", err),
        )
            .into_response();
    }

    let config_path = state.config_path.clone();
    if let Err(err) = fs::write(&config_path, body_str).await {
        error!("Failed to write config: {}", err);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write config file: {}", err),
        )
            .into_response();
    }

    info!(
        "Config written to {}; restart required to apply changes",
        config_path.display()
    );

    (
        StatusCode::OK,
        "Config saved. Restart the service to apply changes.",
    )
        .into_response()
}
