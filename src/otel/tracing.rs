use std::env;

use opentelemetry::global;
use opentelemetry_otlp::{SpanExporter, WithExportConfig};
use opentelemetry_sdk::propagation::TraceContextPropagator;
use tracing_loki::Layer as LokiLayer;
use url::Url;

use opentelemetry_sdk::trace::{BatchSpanProcessor, SdkTracerProvider};
use tracing::debug;

use super::{create_otlp_export_config, resource};

pub fn create_tracer() {
    let provider: SdkTracerProvider = match env::var("OTEL_TRACES_EXPORTER").ok().as_deref() {
        Some("otlp") => {
            let export_config: opentelemetry_otlp::ExportConfig = create_otlp_export_config();
            let span_exporter: SpanExporter = match export_config.protocol {
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
                    let base_endpoint: String = export_config
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
            let processor: BatchSpanProcessor = BatchSpanProcessor::builder(span_exporter).build();
            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .with_resource(resource())
                .build()
        }
        Some("stdout") => {
            let processor: BatchSpanProcessor =
                BatchSpanProcessor::builder(opentelemetry_stdout::SpanExporter::default()).build();
            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .build()
        }
        _ => SdkTracerProvider::default(),
    };
    global::set_tracer_provider(provider.clone());
    global::set_text_map_propagator(TraceContextPropagator::new());
}

pub fn loki_from_env() -> Option<(LokiLayer, tracing_loki::BackgroundTask)> {
    let enabled: bool = env::var("XBP_LOKI_ENABLED")
        .ok()
        .map(|v| v.eq_ignore_ascii_case("1") || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !enabled {
        return None;
    }

    let loki_url: String = env::var("XBP_LOKI_URL").unwrap_or_else(|_| "http://localhost:3100".into());
    let parsed_url: Url = match Url::parse(&loki_url) {
        Ok(url) => url,
        Err(err) => {
            eprintln!("Invalid XBP_LOKI_URL '{}': {}", loki_url, err);
            return None;
        }
    };

    let mut builder: tracing_loki::Builder = tracing_loki::builder()
        .label("service", "xbp-monitoring")
        .expect("static service label should be valid");

    if let Ok(job) = env::var("XBP_LOKI_JOB") {
        builder = match builder.label("job", job) {
            Ok(next) => next,
            Err(err) => {
                eprintln!("Failed to add Loki job label: {}", err);
                return None;
            }
        };
    }

    if let Ok(environment) = env::var("XBP_LOKI_ENV") {
        builder = match builder.label("env", environment) {
            Ok(next) => next,
            Err(err) => {
                eprintln!("Failed to add Loki env label: {}", err);
                return None;
            }
        };
    }

    match builder.build_url(parsed_url) {
        Ok((layer, task)) => Some((layer, task)),
        Err(err) => {
            eprintln!("Failed to initialize Loki layer: {}", err);
            None
        }
    }
}
