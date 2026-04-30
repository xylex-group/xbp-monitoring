# Changelog

All notable changes to this project should be documented in this file.

The format is inspired by Keep a Changelog and versioning should follow the repository's release conventions.

## [Unreleased]

### Added

- Contributor guide in `CONTRIBUTING.md`
- Security policy in `SECURITY.md`
- MIT `LICENSE` file
- Root helper scripts for Docker and validation workflows
- Docker production and development container files
- GitHub issue templates and pull request template
- Architecture documentation in `docs/architecture.md`
- Hardened GitHub Actions workflows for Rust, dashboard, Docker, and release automation

### Changed

- README rewritten into a fuller operator and contributor guide
- Dashboard development proxy now supports configurable backend base URL for Docker development
- CI now validates Rust quality checks, Rust tests, dashboard typechecking, and dashboard builds
- Docker publishing now targets the actual backend and dashboard images instead of assuming a default root Dockerfile

### Notes

- Populate released versions below this section when publishing tags or release notes.
