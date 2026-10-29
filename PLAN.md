# Product development plan

Each round completes one feature or repair. Future items are planned, not implemented claims.

## Current round

skeleton-audit-run

## Roadmap

### skeleton-audit-run — FastAPI/React skeleton with audit run creation and execution

Status: in_progress

Acceptance:
- FastAPI backend starts and serves health endpoint
- React frontend builds and loads
- SQLite database with audit_run, fixture, provider_config tables
- Create audit run via API with fixture and provider selection
- Execute audit run against mock provider (deterministic offline core)
- View audit run status and results via API and UI
- Docker Compose with backend, frontend, Keycloak, persistent volumes
- Backend and frontend tests pass

Implementation: `backend/app/api/routes_fixture.py`, `backend/app/api/routes_audit.py`, `backend/app/api/routes_provider.py`, `backend/app/services/audit_engine.py`, `backend/tests/test_audit_engine.py`

Tests: `backend/tests/test_audit_engine.py`

### fixture-management — Fixture CRUD and validation

Status: planned

Acceptance:
- Create, list, update, delete fixtures via API
- Fixture schema validation (YAML/JSON)
- Fixture versioning and import/export
- UI for fixture editor with validation feedback

### results-dashboard — Audit results dashboard with scoring breakdown

Status: planned

Acceptance:
- Pillar scores (Fabrication, Manipulation, Deception, Unpredictability, Opacity)
- Inspection-level detail with pass/fail/partial
- Mandatory minimum indicators (B01, B08, P01)
- Grade calculation (A-F) with weighted average
- Export results as JSON/Markdown

### auth-oidc — OIDC/Keycloak authentication with roles

Status: planned

Acceptance:
- Keycloak realm import with viewer/operator/admin roles
- Authorization code flow with PKCE
- HttpOnly cookies + CSRF protection
- Role-based access control on all data endpoints
- Demo mode for localhost only

### llm-providers — Multi-provider LLM adapter framework

Status: planned

Acceptance:
- OpenAI-compatible, Anthropic, Gemini, Ollama adapters
- Provider configuration CRUD
- Keys stored server-side only
- Bounded timeouts, redacted errors

### policy-lab — Policy Lab: harmful sequence detection

Status: planned

Acceptance:
- Define business policies as action graphs
- Find shortest harmful sequences of permitted actions
- Check permission repairs against completion goals
- Offline replay of trajectories

