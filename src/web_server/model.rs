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
    pub last_probed: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorsResponse {
    pub probes: Vec<String>,
    pub stories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReloadResponse {
    pub reloaded: bool,
    pub probes: Vec<String>,
    pub stories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}
