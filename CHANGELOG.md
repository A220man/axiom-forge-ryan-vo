# Changelog

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

### Planned
- Real LLM provider adapters (OpenAI, Anthropic, Gemini, Ollama)
- Policy Lab: harmful sequence detection and permission repair
- Fixture editor with live YAML/JSON validation
- Advanced results visualization (charts, trends)
- Multi-judge ensemble evaluation
- SAML identity broker documentation
- Backup/restore CLI utilities