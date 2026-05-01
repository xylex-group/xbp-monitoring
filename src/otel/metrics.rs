use opentelemetry::{
    global,
    metrics::{Counter, Gauge, Histogram},
};
use opentelemetry_otlp::{MetricExporter, WithExportConfig};
use opentelemetry_sdk::metrics::{
    reader::MetricReader, MeterProviderBuilder, PeriodicReader, SdkMeterProvider,
};

use std::{env, sync::Arc};
use tracing::debug;

use crate::otel::create_otlp_export_config;

use super::resource;

fn build_meter_provider<T>(reader: T) -> SdkMeterProvider
where
    T: MetricReader,
{
    MeterProviderBuilder::default()
        .with_resource(resource())
        .with_reader(reader)
        .build()
}

pub struct MetricsState {
    pub meter: Option<SdkMeterProvider>,
    pub registry: Option<Arc<prometheus::Registry>>,
}

pub fn initialize() -> MetricsState {
    let exporter_env: Option<String> = env::var("OTEL_METRICS_EXPORTER").ok();

    let (meter_provider, prometheus_registry) = match exporter_env.as_deref() {
        Some("otlp") => {
            debug!("Using OTLP metrics exporter");
            let export_config = create_otlp_export_config();
            let exporter = match export_config.protocol {
                opentelemetry_otlp::Protocol::Grpc => {
                    debug!("Using OTLP gRPC exporter");
                    MetricExporter::builder()
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
                    MetricExporter::builder()
                        .with_http()
                        .with_export_config(export_config)
                        .with_endpoint(format!(
                            "{}/v1/metrics",
                            base_endpoint.trim_end_matches('/')
                        ))
                        .build()
                        .unwrap()
                }
            };
            let reader: PeriodicReader<MetricExporter> = PeriodicReader::builder(exporter).build();
            (build_meter_provider(reader), None)
        }
        Some("stdout") => {
            debug!("Using stdout metrics exporter");
            let exporter: opentelemetry_stdout::MetricExporter = opentelemetry_stdout::MetricExporter::default();
            let reader: PeriodicReader<opentelemetry_stdout::MetricExporter> = PeriodicReader::builder(exporter).build();
            (build_meter_provider(reader), None)
        }
        Some("prometheus") => {
            debug!("Using Prometheus metrics exporter");
            let registry: prometheus::Registry = prometheus::Registry::new();
            let reader: opentelemetry_prometheus::PrometheusExporter = opentelemetry_prometheus::exporter()
                .with_registry(registry.clone())
                .build()
                .unwrap();
            (build_meter_provider(reader), Some(Arc::new(registry)))
        }
        _ => {
            debug!("No metrics exporter configured");
            return MetricsState {
                meter: None,
                registry: None,
            };
        }
    };

    global::set_meter_provider(meter_provider.clone());

    MetricsState {
        meter: Some(meter_provider),
        registry: prometheus_registry,
    }
}

pub struct Metrics {
    pub duration: Histogram<u64>,
    pub runs: Counter<u64>,
    pub errors: Counter<u64>,
    pub status: Gauge<u64>,
    pub http_status_code: Gauge<u64>,
}

#[derive(Debug, Clone, Copy)]
pub enum MonitorStatus {
    Ok = 0,
    Error = 1,
}

impl MonitorStatus {
    pub fn as_u64(&self) -> u64 {
        *self as u64
    }
}

impl Metrics {
    pub fn new() -> Metrics {
        let meter: opentelemetry::metrics::Meter = opentelemetry::global::meter("xbp");
        Metrics {
            duration: meter
                .u64_histogram("duration")
                .with_unit("ms")
                .with_description("request duration histogram in milliseconds")
                .build(),
            runs: meter
                .u64_counter("runs")
                .with_description("the total count of runs by monitor")
                .build(),
            errors: meter
                .u64_counter("errors")
                .with_description("the total number of errors by monitor")
                .build(),
            status: meter
                .u64_gauge("status")
                .with_description("the current status of each monitor OK = 0 Error = 1")
                .build(),
            http_status_code: meter
                .u64_gauge("http_status_code")
                .with_description(
                    "the current HTTP status code of the step, 0 if the HTTP call fails",
                )
                .build(),
        }
    }
}
