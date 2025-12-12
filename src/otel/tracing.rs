use std::env;

use opentelemetry::global;
use opentelemetry_otlp::{SpanExporter, WithExportConfig};
use opentelemetry_sdk::propagation::TraceContextPropagator;

use chrono::Utc;
use opentelemetry_sdk::trace::{BatchSpanProcessor, SdkTracerProvider};
use std::fs::OpenOptions;
use std::io::Write;
use tracing::debug;

use super::{create_otlp_export_config, resource};

// #region agent log
fn agent_log(hypothesis_id: &str, location: &str, message: &str, data: serde_json::Value) {
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open("c:\\Users\\floris\\Documents\\GitHub\\xbp-monitoring\\.cursor\\debug.log")
    {
        if let Ok(line) = serde_json::to_string(&serde_json::json!({
            "sessionId": "debug-session",
            "runId": "pre-fix",
            "hypothesisId": hypothesis_id,
            "location": location,
            "message": message,
            "data": data,
            "timestamp": Utc::now().timestamp_millis(),
        })) {
            let _ = writeln!(file, "{}", line);
        }
    }
}
// #endregion

pub fn create_tracer() {
    let provider = match env::var("OTEL_TRACES_EXPORTER").ok().as_deref() {
        Some("otlp") => {
            let export_config = create_otlp_export_config();
            let span_exporter = match export_config.protocol {
                opentelemetry_otlp::Protocol::Grpc => {
                    debug!("Using OTLP gRPC exporter");
                    SpanExporter::builder()
                        .with_tonic()
                        .with_export_config(export_config)
                        .build()
                        .unwrap()
                }
                _ => {
                    debug!("Using OTLP HTTP exporter");
                    let base_endpoint = export_config
                        .endpoint
                        .clone()
                        .unwrap_or_else(|| "http://localhost:4318".to_string());
                    SpanExporter::builder()
                        .with_http()
                        .with_export_config(export_config)
                        .with_endpoint(format!("{}/v1/traces", base_endpoint.trim_end_matches('/')))
                        .build()
                        .unwrap()
                }
            };
            let processor = BatchSpanProcessor::builder(span_exporter).build();
            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .with_resource(resource())
                .build()
        }
        Some("stdout") => {
            let processor =
                BatchSpanProcessor::builder(opentelemetry_stdout::SpanExporter::default()).build();
            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .build()
        }
        _ => SdkTracerProvider::default(),
    };
    global::set_tracer_provider(provider.clone());
    global::set_text_map_propagator(TraceContextPropagator::new());
    // #region agent log
    agent_log(
        "D",
        "tracing.rs:create_tracer",
        "tracer initialized",
        serde_json::json!({ "has_traces": true }),
    );
    // #endregion
}
