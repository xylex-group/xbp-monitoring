pub mod discord;

use std::error::Error;

// crate imports
use crate::probe::model::ProbeAlert;

#[allow(dead_code)]
pub async fn alert_router(alert: &ProbeAlert) -> Result<String, Box<dyn Error + Send>> {
    if alert.url.starts_with("https://discord.com/api/webhooks") {
        Ok("discord".to_string())
    } else {
        Ok("any".to_string())
    }
}
