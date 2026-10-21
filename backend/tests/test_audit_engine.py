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


class TestAuditRunAPI:
    @pytest.mark.asyncio
    async def test_create_audit_run(self, client, sample_fixture, sample_provider):
        response = await client.post(
            "/audit-runs",
            json={
                "name": "Test Audit Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Audit Run"
        assert data["status"] == "pending"
        assert data["fixture_id"] == sample_fixture.id
        assert data["provider_config_id"] == sample_provider.id

    @pytest.mark.asyncio
    async def test_create_audit_run_invalid_fixture(self, client, sample_provider):
        response = await client.post(
            "/audit-runs",
            json={
                "name": "Test",
                "fixture_id": "00000000-0000-0000-0000-000000000000",
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_audit_runs(self, client, sample_fixture, sample_provider):
        await client.post(
            "/audit-runs",
            json={
                "name": "Run 1",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        await client.post(
            "/audit-runs",
            json={
                "name": "Run 2",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "smoke",
            },
        )

        response = await client.get("/audit-runs")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_get_audit_run(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/audit-runs",
            json={
                "name": "Test Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.get(f"/audit-runs/{run_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == run_id
        assert data["name"] == "Test Run"

    @pytest.mark.asyncio
    async def test_execute_audit_run(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/audit-runs",
            json={
                "name": "Test Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.post(f"/audit-runs/{run_id}/execute")
        assert response.status_code == 200
        data = response.json()
        # In sync mode, status will be completed; in async mode, it will be running
        assert data["status"] in ("running", "completed")

        # Wait for background task to complete (if async mode)
        import asyncio
        for _ in range(50):
            await asyncio.sleep(0.1)
            resp = await client.get(f"/audit-runs/{run_id}")
            if resp.json()["status"] in ("completed", "failed"):
                break

        response = await client.get(f"/audit-runs/{run_id}")
        data = response.json()
        assert data["status"] in ("completed", "failed")

    @pytest.mark.asyncio
    async def test_get_results_before_completion(self, client, sample_fixture, sample_provider):
        create_resp = await client.post(
            "/audit-runs",
            json={
                "name": "Test Run",
                "fixture_id": sample_fixture.id,
                "provider_config_id": sample_provider.id,
                "suite": "essential",
            },
        )
        run_id = create_resp.json()["id"]

        response = await client.get(f"/audit-runs/{run_id}/results")
        assert response.status_code == 404


class TestFixtureAPI:
    @pytest.mark.asyncio
    async def test_create_fixture(self, client):
        response = await client.post(
            "/fixtures",
            json={
                "name": "New Fixture",
                "description": "Test fixture",
                "content": {
                    "metadata": {"name": "test"},
                    "tests": [{"id": "t1", "prompt": "p", "expected": "e"}],
                },
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Fixture"
        assert data["version"] == 1

    @pytest.mark.asyncio
    async def test_create_fixture_invalid_content(self, client):
        response = await client.post(
            "/fixtures",
            json={
                "name": "Bad Fixture",
                "content": {"metadata": {}},  # missing tests
            },
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_list_fixtures(self, client, sample_fixture):
        response = await client.get("/fixtures")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_get_fixture(self, client, sample_fixture):
        response = await client.get(f"/fixtures/{sample_fixture.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_fixture.id

    @pytest.mark.asyncio
    async def test_update_fixture(self, client, sample_fixture):
        response = await client.patch(
            f"/fixtures/{sample_fixture.id}",
            json={
                "name": "Updated Name",
                "content": {
                    "metadata": {"name": "updated", "version": "2.0"},
                    "tests": [{"id": "test2", "prompt": "New prompt", "expected": "New response"}],
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["version"] == 2

    @pytest.mark.asyncio
    async def test_delete_fixture(self, client, sample_fixture):
        response = await client.delete(f"/fixtures/{sample_fixture.id}")
        assert response.status_code == 204

        response = await client.get(f"/fixtures/{sample_fixture.id}")
        assert response.status_code == 404


class TestProviderAPI:
    @pytest.mark.asyncio
    async def test_create_provider(self, client):
        response = await client.post(
            "/providers",
            json={
                "name": "Test Provider",
                "provider_type": "mock",
                "model": "test-model",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Provider"
        assert data["provider_type"] == "mock"

    @pytest.mark.asyncio
    async def test_list_providers(self, client, sample_provider):
        response = await client.get("/providers")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    @pytest.mark.asyncio
    async def test_get_provider(self, client, sample_provider):
        response = await client.get(f"/providers/{sample_provider.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_provider.id

    @pytest.mark.asyncio
    async def test_update_provider(self, client, sample_provider):
        response = await client.patch(
            f"/providers/{sample_provider.id}",
            json={"is_active": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_delete_provider(self, client, sample_provider):
        response = await client.delete(f"/providers/{sample_provider.id}")
        assert response.status_code == 204


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_check(self, client):
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"