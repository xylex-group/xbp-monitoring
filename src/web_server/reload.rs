use axum::{
    http::{HeaderMap, StatusCode},
    Extension, Json,
};
use std::sync::Arc;

use crate::app_state::AppState;

use super::model::{ErrorResponse, MonitorsResponse, ReloadResponse};

const RELOAD_TOKEN_ENV: &str = "XBP_RELOAD_TOKEN";
const RELOAD_TOKEN_HEADER: &str = "x-xbp-reload-token";

pub async fn monitors(Extension(state): Extension<Arc<AppState>>) -> Json<MonitorsResponse> {
    let config = state.config.read().unwrap().clone();
    Json(MonitorsResponse {
        probes: config.probes.into_iter().map(|p| p.name).collect(),
        stories: config.stories.into_iter().map(|s| s.name).collect(),
    })
}

pub async fn reload(
    headers: HeaderMap,
    Extension(state): Extension<Arc<AppState>>,
) -> Result<Json<ReloadResponse>, (StatusCode, Json<ErrorResponse>)> {
    let expected_token = std::env::var(RELOAD_TOKEN_ENV).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("{} is not set", RELOAD_TOKEN_ENV),
            }),
        )
    })?;

    let provided = headers
        .get(RELOAD_TOKEN_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if provided != expected_token {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "forbidden".to_owned(),
            }),
        ));
    }

    let new_config = state.reload().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        )
    })?;

    Ok(Json(ReloadResponse {
        reloaded: true,
        probes: new_config.probes.into_iter().map(|p| p.name).collect(),
        stories: new_config.stories.into_iter().map(|s| s.name).collect(),
    }))
}

#[cfg(test)]
mod reload_tests {
    use super::*;
    use crate::config::Config;
    use crate::web_server::app_router;
    use axum::body::Body;
    use http::Request;
    use std::sync::{Mutex, OnceLock};
    use tower::util::ServiceExt;

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn env_lock() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.get_or_init(|| Mutex::new(())).lock().unwrap()
    }

    #[tokio::test]
    async fn test_reload_requires_token_header_and_env() {
        let _lock = env_lock();
        std::env::set_var("XBP_RELOAD_TOKEN", "token123");
        std::env::remove_var("XBP_REMOTE_CONFIG_URL");

        let temp_dir = std::env::temp_dir().join(format!("xbp-monitoring-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await.unwrap();
        let config_path = temp_dir.join("xbp.yaml");
        tokio::fs::write(&config_path, "probes: []\nstories: []\n")
            .await
            .unwrap();

        let state = std::sync::Arc::new(AppState::new(
            Config {
                probes: vec![],
                stories: vec![],
            },
            config_path.clone(),
        ));
        let app = app_router(state);

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/-/reload")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(StatusCode::FORBIDDEN, resp.status());

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/-/reload")
                    .header("x-xbp-reload-token", "wrong")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(StatusCode::FORBIDDEN, resp.status());
    }

    #[tokio::test]
    async fn test_reload_updates_monitors_from_file() {
        let _lock = env_lock();
        std::env::set_var("XBP_RELOAD_TOKEN", "token123");
        std::env::remove_var("XBP_REMOTE_CONFIG_URL");

        let temp_dir = std::env::temp_dir().join(format!("xbp-monitoring-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&temp_dir).await.unwrap();
        let config_path = temp_dir.join("xbp.yaml");
        tokio::fs::write(&config_path, "probes: []\nstories: []\n")
            .await
            .unwrap();

        let state = std::sync::Arc::new(AppState::new(
            Config {
                probes: vec![],
                stories: vec![],
            },
            config_path.clone(),
        ));
        let app = app_router(state.clone());

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/-/monitors")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(StatusCode::OK, resp.status());

        tokio::fs::write(
            &config_path,
            r#"
probes:
  - name: reloaded_probe
    url: https://example.com/health
    http_method: GET
    with:
    expectations:
    schedule:
      initial_delay: 3600
      interval: 3600
    alerts:
    sensitive: false
    tags:
stories: []
"#,
        )
        .await
        .unwrap();

        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/-/reload")
                    .header("x-xbp-reload-token", "token123")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(StatusCode::OK, resp.status());

        let resp = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/-/monitors")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(StatusCode::OK, resp.status());

        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: MonitorsResponse = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(vec!["reloaded_probe".to_owned()], parsed.probes);
    }
}

