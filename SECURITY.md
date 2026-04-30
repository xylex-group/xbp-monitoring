# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in XBP Monitoring, please report it privately to the maintainers instead of opening a public issue.

Include as much detail as possible:

- affected version or commit
- impact and severity
- reproduction steps or proof of concept
- suggested remediation, if known

## Scope

Areas with elevated security sensitivity include:

- environment variable handling
- dashboard config editing and restart endpoints
- outbound request execution
- metrics and management endpoints
- sensitive response handling and redaction

## Supported versions

At the moment, security fixes should be assumed to target the latest maintained branch and current release line.

## Operational guidance

When deploying XBP Monitoring:

- run management endpoints behind trusted network boundaries
- avoid exposing restart or config mutation endpoints publicly
- store secrets in environment variables, not committed YAML
- review whether Prometheus and telemetry endpoints should be restricted at the network layer
