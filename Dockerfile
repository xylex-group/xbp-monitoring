# syntax=docker/dockerfile:1

ARG RUST_IMAGE=rust:1.85-bookworm
FROM ${RUST_IMAGE} AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY xbp.yaml ./xbp.yaml
COPY src ./src

RUN cargo build --release --locked


FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0

COPY --from=builder /app/target/release/xbp-monitoring /usr/local/bin/xbp-monitoring

EXPOSE 3000
EXPOSE 9464

ENTRYPOINT ["xbp-monitoring"]
