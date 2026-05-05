use axum::Json;

use crate::web_server::model::HealthStatusResponse;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub async fn health_status() -> Json<HealthStatusResponse> {
    Json(HealthStatusResponse {
        status: "ok".to_string(),
        service: "xbp-monitoring".to_string(),
        version: APP_VERSION.to_string(),
    })
}
