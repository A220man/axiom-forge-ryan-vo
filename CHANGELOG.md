# Changelog

## 1.5.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.4.0 — work-in-progress checkpoint

### Added
- Audit results export as JSON and Markdown via new API endpoints:
  - `GET /api/v1/audit-runs/{run_id}/results/export/json`
  - `GET /api/v1/audit-runs/{run_id}/results/export/markdown`
- Frontend export buttons in AuditRunDetail: Export JSON, Export Markdown, Copy JSON
- Synchronous audit execution mode for testing (`SYNC_AUDIT_EXECUTION` env var)
- Comprehensive Markdown report generation with run metadata, summary, pillar scores, mandatory minimums, and inspection details

### Changed
- Modified `execute_audit_run_endpoint` to support synchronous execution when `SYNC_AUDIT_EXECUTION=true`

### Fixed
- Test suite now passes with in-memory SQLite database for background audit execution

## 1.3.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.2.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.1.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

## 1.0.0 — work-in-progress checkpoint

Partial code published for continued development. Known issues: STATUS.md.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-15

### Added
- FastAPI backend with SQLite persistence and SQLAlchemy ORM
- React + TypeScript + Vite frontend with responsive dashboard
- Audit run CRUD and execution with background tasks
- Fixture management with versioning and JSON validation
- Provider configuration for mock, OpenAI-compatible, Anthropic, Gemini, Ollama
- Deterministic mock audit engine with 32 inspections across 5 pillars
- Five-pillar scoring: Fabrication, Manipulation, Deception, Unpredictability, Opacity
- Mandatory minimums (B01, B08, P01) with grade capping at 60%
- Grade calculation (A-F) with weighted averages
- OIDC/Keycloak authentication with viewer/operator/admin roles
- Keycloak realm export with pre-configured clients and users
- Docker Compose with backend, frontend, Keycloak, persistent volumes
- Health checks for all services
- Comprehensive test suite (15+ backend tests)
- API documentation via OpenAPI/Swagger
- Export audit results as JSON
- Responsive professional UI with dark mode support
- Pagination, filtering, sorting on all list views

### Security
- Server-side API key storage (never exposed to frontend)
- HttpOnly SameSite cookies with CSRF protection (when OIDC enabled)
- PKCE + state + nonce for authorization code flow
- Demo mode explicitly localhost-only, refused in production
- No hardcoded secrets or credentials

### Infrastructure
- Non-root Docker users
- .dockerignore for both services
- Persistent volumes for SQLite and Keycloak data
- Bind development ports to 127.0.0.1
- CI/CD workflow with pytest, npm build/test, Docker builds

## [Unreleased]

### Added
- Suite validation in audit engine: `get_inspections_for_suite()` now raises `ValueError` for unknown suites with helpful message listing valid options
- Test coverage for invalid suite validation (`test_invalid_suite_raises_error`)
- Fixed fixture version increment: version now increments on any field update (name, description, content, schema_version), not just content changes
- Fixed test `test_update_fixture` to pass with corrected version increment logic
- Corrected README test suite counts: `extended` suite has 23 inspections (not 28), `all` suite has 33 inspections (not 60)

### Planned
- Real LLM provider adapters (OpenAI, Anthropic, Gemini, Ollama)
- Policy Lab: harmful sequence detection and permission repair
- Fixture editor with live YAML/JSON validation
- Advanced results visualization (charts, trends)
- Multi-judge ensemble evaluation
- SAML identity broker documentation
- Backup/restore CLI utilities
