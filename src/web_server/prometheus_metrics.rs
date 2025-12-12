use axum::{http::StatusCode, response::IntoResponse, Extension};
use prometheus::{Encoder, Registry, TextEncoder};
use std::sync::Arc;

pub async fn metrics_handler(Extension(registry): Extension<Arc<Registry>>) -> impl IntoResponse {
    let encoder = TextEncoder::new();
    let metric_families = registry.gather();
    let mut buffer = vec![];

    match encoder.encode(&metric_families, &mut buffer) {
        Ok(_) => (
            StatusCode::OK,
            [("content-type", encoder.format_type())],
            buffer,
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to encode metrics: {}", e),
        )
            .into_response(),
    }
}
