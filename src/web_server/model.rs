use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ProbeQueryParams {
    pub show_response: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeResponse {
    pub name: String,
    pub status: String,
    pub last_probed: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryStatusResponse {
    pub metrics_exporter: String,
    pub prometheus_enabled: bool,
    pub prometheus_main_endpoint: Option<String>,
    pub prometheus_dedicated_endpoint: Option<String>,
    pub traces_exporter: String,
    pub loki_enabled: bool,
    pub loki_url: Option<String>,
    pub loki_job: Option<String>,
    pub loki_env: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatusResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}
