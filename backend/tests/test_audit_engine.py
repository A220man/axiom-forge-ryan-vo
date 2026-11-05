import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import create_app
from app.core.database import Base
from app.models import Fixture, ProviderConfig, ProviderType, AuditRun, AuditRunStatus
from app.services.audit_engine import (
    INSPECTIONS,
    SUITE_INSPECTIONS,
    PILLAR_WEIGHTS,
    MANDATORY_MINIMUMS,
    get_inspections_for_suite,
    run_mock_inspection,
    calculate_results,
    execute_audit_run,
)


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    async_session = sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
        await session.rollback()


import uuid


@pytest_asyncio.fixture
async def sample_fixture(test_session: AsyncSession):
    fixture = Fixture(
        name=f"Test Fixture {uuid.uuid4().hex[:8]}",
        description="A test fixture",
        content={
            "metadata": {"name": "test", "version": "1.0"},
            "tests": [
                {"id": "test1", "prompt": "Test prompt", "expected": "Test response"}
            ],
        },
        schema_version="1.0",
    )
    test_session.add(fixture)
    await test_session.commit()
    await test_session.refresh(fixture)
    return fixture


@pytest_asyncio.fixture
async def sample_provider(test_session: AsyncSession):
    provider = ProviderConfig(
        name="Mock Provider",
        provider_type=ProviderType.MOCK,
        model="mock-model",
        is_active=True,
    )
    test_session.add(provider)
    await test_session.commit()
    await test_session.refresh(provider)
    return provider


class TestAuditEngine:
    def test_inspections_loaded(self):
        assert len(INSPECTIONS) >= 10
        assert "B01" in INSPECTIONS
        assert "B08" in INSPECTIONS
        assert "P01" in INSPECTIONS
        assert INSPECTIONS["B01"].is_mandatory_minimum is True
        assert INSPECTIONS["B08"].is_mandatory_minimum is True
        assert INSPECTIONS["P01"].is_mandatory_minimum is True

    def test_suite_inspections(self):
        smoke = get_inspections_for_suite("smoke")
        assert len(smoke) == 3
        assert {i.id for i in smoke} == {"B01", "B08", "P01"}

        essential = get_inspections_for_suite("essential")
        assert len(essential) == 10

        core = get_inspections_for_suite("core")
        assert len(core) == 32

    def test_deterministic_seed(self):
        from app.services.audit_engine import deterministic_seed
        seed1 = deterministic_seed("run-123", "B01")
        seed2 = deterministic_seed("run-123", "B01")
        seed3 = deterministic_seed("run-456", "B01")
        assert seed1 == seed2
        assert seed1 != seed3

    def test_run_mock_inspection(self, sample_fixture, sample_provider):
        inspection = INSPECTIONS["B01"]
        result = run_mock_inspection(inspection, sample_fixture, sample_provider, "run-123")

        assert result.id == "B01"
        assert result.pillar == "Fabrication"
        assert result.status in ("pass", "fail", "partial", "insufficient_evidence")
        assert 0.0 <= result.score <= 1.0
        assert result.is_mandatory_minimum is True

    def test_calculate_results(self, sample_fixture, sample_provider):
        inspections = get_inspections_for_suite("essential")
        results = [run_mock_inspection(i, sample_fixture, sample_provider, "run-123") for i in inspections]

        audit_results = calculate_results(results)

        assert audit_results.grade in ("A", "B", "C", "D", "F")
        assert 0.0 <= audit_results.overall_score <= 1.0
        assert len(audit_results.pillar_scores) == 5
        assert len(audit_results.inspections) == 10
        assert set(audit_results.mandatory_minimums.keys()) == {"B01", "B08", "P01"}

    @pytest.mark.asyncio
    async def test_execute_audit_run(self, sample_fixture, sample_provider):
        from app.models import AuditRun, AuditRunStatus

        run = AuditRun(
            name="Test Run",
            fixture_id=sample_fixture.id,
            provider_config_id=sample_provider.id,
            suite="essential",
            status=AuditRunStatus.PENDING,
        )

        results = await execute_audit_run(run, sample_fixture, sample_provider)

        assert results.grade in ("A", "B", "C", "D", "F")
        assert len(results.inspections) == 10
        assert run.status == AuditRunStatus.PENDING  # Not modified by execute_audit_run

    def test_invalid_suite_raises_error(self):
        """Test that invalid suite names raise ValueError with helpful message."""
        with pytest.raises(ValueError) as exc_info:
            get_inspections_for_suite("invalid_suite")
        assert "Unknown suite 'invalid_suite'" in str(exc_info.value)
        assert "smoke" in str(exc_info.value)
        assert "essential" in str(exc_info.value)
        assert "all" in str(exc_info.value)


class TestAuditRunAPI:
    @pytest.mark.asyncio
    async def test_create_audit_run(self, client, sample_fixture, sample_provider):
        response = await client.post(
            "/api/v1/audit-runs",
            json={
                "name": "Test Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Run"
        assert data["fixture_id"] == sample_fixture.id
        assert data["provider_config_id"] == sample_provider.id
        assert data["suite"] == "essential"
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_create_audit_run_invalid_fixture(self, client, sample_provider):
        response = await client.post(
            "/api/v1/audit-runs",
            json={
                "name": "Test Run",
                "fixture_id": "00000000-0000-0000-0000-000000000000",
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_audit_runs(self, client, sample_fixture, sample_provider):
        # Create a few runs
        for i in range(3):
            await client.post(
                "/api/v1/audit-runs",
                json={
                    "name": f"Run {i}",
                    "fixture_id": sample_fixture.id,
                    "provider_config_id": sample_provider.id,
                    "suite": "essential",
                },
            )

        response = await client.get("/api/v1/audit-runs")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 3
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert data["total"] >= 3

    @pytest.mark.asyncio
    async def test_get_audit_run(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/api/v1/audit-runs",
            json={
                "name": "Single Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/audit-runs/{run_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == run_id
        assert data["name"] == "Single Run"

    @pytest.mark.asyncio
    async def test_execute_audit_run(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/api/v1/audit-runs",
            json={
                "name": "Execute Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.post(f"/api/v1/audit-runs/{run_id}/execute")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == run_id
        assert data["status"] in ("running", "completed")

        # Wait a bit for background task
        import asyncio
        await asyncio.sleep(0.5)

        result_resp = await client.get(f"/api/v1/audit-runs/{run_id}/results")
        assert result_resp.status_code == 200
        result_data = result_resp.json()
        assert result_data["grade"] in ("A", "B", "C", "D", "F")
        assert len(result_data["inspections"]) == 10

    @pytest.mark.asyncio
    async def test_get_results_before_completion(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/api/v1/audit-runs",
            json={
                "name": "No Results Yet",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/audit-runs/{run_id}/results")
        assert response.status_code == 404


class TestFixtureAPI:
    @pytest.mark.asyncio
    async def test_create_fixture(self, client):
        response = await client.post(
            "/api/v1/fixtures",
            json={
                "name": "API Fixture",
                "description": "Created via API",
                "content": {
                    "metadata": {"name": "api-test", "version": "1.0"},
                    "tests": [{"id": "t1", "prompt": "Hello", "expected": "World"}],
                },
                "schema_version": "1.0",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API Fixture"
        assert data["version"] == 1
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_fixture_invalid_content(self, client):
        response = await client.post(
            "/api/v1/fixtures",
            json={
                "name": "Bad Fixture",
                "content": "not a dict",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_fixtures(self, client, sample_fixture):
        response = await client.get("/api/v1/fixtures")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1
        assert data["page"] == 1
        assert data["page_size"] == 20

    @pytest.mark.asyncio
    async def test_get_fixture(self, client, sample_fixture):
        response = await client.get(f"/api/v1/fixtures/{sample_fixture.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_fixture.id
        assert data["name"] == sample_fixture.name

    @pytest.mark.asyncio
    async def test_update_fixture(self, client, sample_fixture):
        response = await client.patch(
            f"/api/v1/fixtures/{sample_fixture.id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["version"] == sample_fixture.version + 1

    @pytest.mark.asyncio
    async def test_update_fixture_invalid_content(self, client, sample_fixture):
        response = await client.patch(
            f"/api/v1/fixtures/{sample_fixture.id}",
            json={"content": "not a dict"},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_fixture(self, client, sample_fixture):
        response = await client.delete(f"/api/v1/fixtures/{sample_fixture.id}")
        assert response.status_code == 204

        response = await client.get(f"/api/v1/fixtures/{sample_fixture.id}")
        assert response.status_code == 404


class TestProviderAPI:
    @pytest.mark.asyncio
    async def test_create_provider(self, client):
        response = await client.post(
            "/api/v1/providers",
            json={
                "name": "Test Provider",
                "provider_type": "mock",
                "model": "test-model",
                "is_active": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Provider"
        assert data["provider_type"] == "mock"

    @pytest.mark.asyncio
    async def test_list_providers(self, client, sample_provider):
        response = await client.get("/api/v1/providers")
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) >= 1

    @pytest.mark.asyncio
    async def test_get_provider(self, client, sample_provider):
        response = await client.get(f"/api/v1/providers/{sample_provider.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_provider.id
        assert data["name"] == sample_provider.name

    @pytest.mark.asyncio
    async def test_update_provider(self, client, sample_provider):
        response = await client.patch(
            f"/api/v1/providers/{sample_provider.id}",
            json={"is_active": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_delete_provider(self, client, sample_provider):
        response = await client.delete(f"/api/v1/providers/{sample_provider.id}")
        assert response.status_code == 204


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_check(self, client):
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
