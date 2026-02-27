mod alerts;
mod app_state;
mod config;
mod errors;
mod otel;
mod probe;
mod web_server;

use clap::Parser;
use probe::schedule::schedule_probes;
use probe::schedule::schedule_stories;
use std::{path::PathBuf, sync::Arc};
use web_server::start_axum_server;
use web_server::start_prometheus_server;

use crate::{app_state::AppState, config::load_config};

const XBP_YAML: &str = "xbp.yml";

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    // Test definition file to execute
    #[arg(short, long, default_value = XBP_YAML)]
    file: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Args = Args::parse();
    let otel_state: otel::OtelGuard = otel::init();
    if let Some(registry) = &otel_state.metrics.registry {
        tokio::spawn(start_prometheus_server(registry.clone()));
    }

    let config_path = PathBuf::from(&args.file);
    let config: config::Config = load_config(config_path.clone()).await?;

    let app_state: Arc<AppState> = Arc::new(AppState::new(config, config_path));

    start_monitoring(app_state.clone()).await?;

    start_axum_server(app_state.clone()).await;

    Ok(())
}

async fn start_monitoring(app_state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error>> {
    schedule_probes(&app_state.config.probes, app_state.clone());
    schedule_stories(&app_state.config.stories, app_state.clone());
    Ok(())
}

#[cfg(test)]
mod test_utils;
