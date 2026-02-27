use axum::{extract::Extension, http::StatusCode, response::IntoResponse};
use std::{env, sync::Arc};
use tokio::process::Command;
use tracing::{debug, error, info};

use crate::app_state::AppState;

pub async fn restart(Extension(_state): Extension<Arc<AppState>>) -> impl IntoResponse {
    debug!("Restart endpoint called");

    let restart_cmd = match env::var("XBP_RESTART_CMD") {
        Ok(cmd) if !cmd.is_empty() => cmd,
        _ => {
            return (
                StatusCode::NOT_IMPLEMENTED,
                "Restart command not configured. Set XBP_RESTART_CMD.",
            )
                .into_response()
        }
    };

    #[cfg(target_os = "windows")]
    let (shell, shell_arg) = ("cmd", "/C");
    #[cfg(not(target_os = "windows"))]
    let (shell, shell_arg) = ("sh", "-c");

    let mut command = Command::new(shell);
    command.arg(shell_arg).arg(&restart_cmd);

    match command.spawn() {
        Ok(mut child) => {
            info!("Spawned restart command: {}", restart_cmd);
            tokio::spawn(async move {
                let _ = child.wait().await;
            });

            (
                StatusCode::ACCEPTED,
                "Restart command dispatched. The service should restart shortly.",
            )
                .into_response()
        }
        Err(err) => {
            error!("Failed to spawn restart command: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to run restart command: {}", err),
            )
                .into_response()
        }
    }
}
