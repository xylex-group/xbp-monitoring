mod alerts;
mod app_state;
mod config;
mod errors;
mod otel;
mod probe;
mod web_server;

use clap::Parser;
use std::sync::Arc;
use web_server::start_axum_server;
use web_server::start_prometheus_server;

use crate::{app_state::AppState, config::load_config_from_sources};

const XBP_YAML: &str = "xbp.yaml";

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    // Test definition file to execute
    #[arg(short, long, default_value = XBP_YAML)]
    file: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let otel_state = otel::init();
    if let Some(registry) = &otel_state.metrics.registry {
        tokio::spawn(start_prometheus_server(registry.clone()));
    }

    let config = load_config_from_sources(args.file.clone()).await?;

    let app_state = Arc::new(AppState::new(config, args.file));

    app_state.start_monitoring();

    start_axum_server(app_state.clone()).await;

    Ok(())
}

#[cfg(test)]
mod test_utils;
