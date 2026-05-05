mod config_api;
mod model;
mod probes;
mod prometheus_metrics;
mod restart;
mod stories;
mod telemetry;

use crate::web_server::{
    config_api::{get_config, put_config},
    probes::{get_probe_results, probe_trigger, probes},
    restart::restart,
    stories::{get_story_results, stories, story_trigger},
    telemetry::telemetry_status,
};
use axum::{
    http::Method,
    middleware,
    response::Response,
    routing::{get, post},
    Extension, Router,
};
use std::{
    env,
    io::{ErrorKind, Result as IoResult},
    sync::Arc,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing::{debug, error, info, warn};

use crate::app_state::AppState;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

fn ansi(code: &str, text: &str) -> String {
    format!("\x1b[{code}m{text}\x1b[0m")
}

pub async fn start_axum_server(app_state: Arc<AppState>) -> IoResult<()> {
    let app = Router::new()
        .route("/", get(root))
        .nest_service(
            "/dashboard",
            ServeDir::new("dashboard/out").append_index_html_on_directories(true),
        )
        .route("/probes", get(probes))
        .route("/probes/:name/results", get(get_probe_results))
        .route("/probes/:name/trigger", get(probe_trigger))
        .route("/stories", get(stories))
        .route("/stories/:name/results", get(get_story_results))
        .route("/stories/:name/trigger", get(story_trigger))
        .route(
            "/metrics",
            get(prometheus_metrics::metrics_from_app_state_handler),
        )
        .route("/api/telemetry", get(telemetry_status))
        .route("/api/config", get(get_config).put(put_config))
        .route("/api/restart", post(restart))
        .layer(middleware::map_response(attach_version_headers))
        .layer(Extension(app_state.clone()));

    let app = app.layer(build_cors_layer());

    let listener = match tokio::net::TcpListener::bind("0.0.0.0:3000").await {
        Ok(listener) => listener,
        Err(err) if err.kind() == ErrorKind::AddrInUse => {
            error!("API port 3000 already in use: {}", err);
            eprintln!(
                "{} Could not bind API server to 0.0.0.0:3000 (address already in use).\n  Hint: stop the old process OR run only one backend instance.\n  Dashboard dev should run on :3001 and proxy to backend on :3000.",
                ansi("1;31", "[XBP startup error]"),
            );
            return Err(err);
        }
        Err(err) => {
            error!("Failed to bind API server: {}", err);
            return Err(err);
        }
    };

    info!("listening on {}", listener.local_addr().unwrap());

    axum::serve(listener, app).await
}

pub async fn start_prometheus_server(registry: Arc<prometheus::Registry>) {
    let host: String = match env::var("OTEL_EXPORTER_PROMETHEUS_HOST") {
        Ok(host) => host,
        Err(_) => "localhost".to_owned(),
    };
    let port = match env::var("OTEL_EXPORTER_PROMETHEUS_PORT") {
        Ok(port) => port,
        Err(_) => "9464".to_owned(),
    };
    let app: Router = Router::new()
        .route("/metrics", get(prometheus_metrics::metrics_handler))
        .layer(Extension(registry));

    let listener = match tokio::net::TcpListener::bind(format!("{}:{}", host, port)).await {
        Ok(listener) => listener,
        Err(err) if err.kind() == ErrorKind::AddrInUse => {
            warn!("Prometheus listener address already in use: {}", err);
            eprintln!(
                "{} Prometheus dedicated listener could not start (address in use).\n  Main API /metrics endpoint remains available when OTEL_METRICS_EXPORTER=prometheus.",
                ansi("1;33", "[XBP warning]"),
            );
            return;
        }
        Err(err) => {
            warn!("Failed to start Prometheus listener: {}", err);
            return;
        }
    };

    info!(
        "Serving Prometheus metrics on {}/metrics",
        listener.local_addr().unwrap()
    );

    if let Err(err) = axum::serve(listener, app).await {
        warn!("Prometheus server stopped with error: {}", err);
    }
}

async fn root() -> &'static str {
    debug!("Application root called");
    "Roar!"
}

fn build_cors_layer() -> CorsLayer {
    info!("CORS support forced to allow all origins");
    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers(Any)
        .allow_origin(Any)
}

async fn attach_version_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert(
        "x-xpp-version",
        axum::http::HeaderValue::from_static(APP_VERSION),
    );
    headers.insert(
        "x-xbp-version",
        axum::http::HeaderValue::from_static(APP_VERSION),
    );
    response
}
