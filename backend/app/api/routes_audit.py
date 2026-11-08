
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.models import AuditRun, AuditRunStatus, Fixture, ProviderConfig
from app.schemas import (
    AuditRunListResponse,
    AuditRunResponse,
    AuditRunCreate,
    AuditRunUpdate,
    AuditResults,
    HealthResponse,
    ErrorResponse,
)
from app.services.audit_engine import execute_audit_run

router = APIRouter(prefix="/audit-runs", tags=["audit-runs"])


@router.get("", response_model=AuditRunListResponse)
async def list_audit_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_db_session),
):
    query = select(AuditRun).order_by(AuditRun.created_at.desc())
    if status:
        query = query.where(AuditRun.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    runs = result.scalars().all()

    return AuditRunListResponse(
        items=[AuditRunResponse.model_validate(run) for run in runs],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=AuditRunResponse, status_code=status.HTTP_201_CREATED)
async def create_audit_run(
    run_data: AuditRunCreate,
    session: AsyncSession = Depends(get_db_session),
):
    fixture = await session.get(Fixture, run_data.fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")

    provider = await session.get(ProviderConfig, run_data.provider_config_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider configuration not found")

    if not provider.is_active:
        raise HTTPException(status_code=400, detail="Provider configuration is not active")

    run = AuditRun(
        name=run_data.name,
        description=run_data.description,
        fixture_id=run_data.fixture_id,
        provider_config_id=run_data.provider_config_id,
        suite=run_data.suite,
        status=AuditRunStatus.PENDING,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    return AuditRunResponse.model_validate(run)


@router.get("/{run_id}", response_model=AuditRunResponse)
async def get_audit_run(
    run_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")
    return AuditRunResponse.model_validate(run)


@router.patch("/{run_id}", response_model=AuditRunResponse)
async def update_audit_run(
    run_id: str,
    run_data: AuditRunUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")

    if run_data.name is not None:
        run.name = run_data.name
    if run_data.description is not None:
        run.description = run_data.description

    run.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(run)

    return AuditRunResponse.model_validate(run)


@router.post("/{run_id}/execute", response_model=AuditRunResponse)
async def execute_audit_run_endpoint(
    run_id: str,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")

    if run.status == AuditRunStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Audit run is already running")

    run.status = AuditRunStatus.RUNNING
    run.started_at = datetime.now(timezone.utc)
    run.updated_at = datetime.now(timezone.utc)
    await session.commit()

    fixture = await session.get(Fixture, run.fixture_id)
    provider = await session.get(ProviderConfig, run.provider_config_id)

    if not fixture or not provider:
        run.status = AuditRunStatus.FAILED
        run.completed_at = datetime.now(timezone.utc)
        run.error_message = "Fixture or provider not found"
        run.updated_at = datetime.now(timezone.utc)
        await session.commit()
        return AuditRunResponse.model_validate(run)

    # Check if synchronous execution is enabled (for testing)
    settings = get_settings()
    if settings.sync_audit_execution:
        # Run synchronously in the same session
        try:
            results = await execute_audit_run(run, fixture, provider)
            run.results = results.model_dump()
            run.status = AuditRunStatus.COMPLETED
            run.completed_at = datetime.now(timezone.utc)
        except Exception as e:
            run.status = AuditRunStatus.FAILED
            run.completed_at = datetime.now(timezone.utc)
            run.error_message = str(e)
        run.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(run)
        return AuditRunResponse.model_validate(run)

    background_tasks.add_task(run_audit_background, run_id)

    await session.refresh(run)
    return AuditRunResponse.model_validate(run)


async def run_audit_background(
    run_id: str,
    session_maker: Optional[object] = None,
):
    """Run audit in background with optional session factory override for testing."""
    from app.core.database import async_session_maker

    maker = session_maker or async_session_maker

    async with maker() as session:
        run = await session.get(AuditRun, run_id)
        if not run:
            return

        fixture = await session.get(Fixture, run.fixture_id)
        provider = await session.get(ProviderConfig, run.provider_config_id)

        if not fixture or not provider:
            run.status = AuditRunStatus.FAILED
            run.completed_at = datetime.now(timezone.utc)
            run.error_message = "Fixture or provider not found"
            run.updated_at = datetime.now(timezone.utc)
            await session.commit()
            return

        try:
            results = await execute_audit_run(run, fixture, provider)
            run.results = results.model_dump()
            run.status = AuditRunStatus.COMPLETED
            run.completed_at = datetime.now(timezone.utc)
        except Exception as e:
            run.status = AuditRunStatus.FAILED
            run.completed_at = datetime.now(timezone.utc)
            run.error_message = str(e)

        run.updated_at = datetime.now(timezone.utc)
        await session.commit()


@router.get("/{run_id}/results", response_model=AuditResults)
async def get_audit_results(
    run_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")

    if not run.results:
        raise HTTPException(status_code=404, detail="Results not available")

    return AuditResults.model_validate(run.results)


@router.get("/{run_id}/results/export/json")
async def export_results_json(
    run_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")

    if not run.results:
        raise HTTPException(status_code=404, detail="Results not available")

    results = AuditResults.model_validate(run.results)
    json_data = results.model_dump_json(indent=2)

    def iter_json():
        yield json_data

    return StreamingResponse(
        iter_json(),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=audit-run-{run_id}-results.json"},
    )


@router.get("/{run_id}/results/export/markdown")
async def export_results_markdown(
    run_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    run = await session.get(AuditRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Audit run not found")

    if not run.results:
        raise HTTPException(status_code=404, detail="Results not available")

    results = AuditResults.model_validate(run.results)
    markdown = _generate_markdown_report(run, results)

    def iter_markdown():
        yield markdown

    return StreamingResponse(
        iter_markdown(),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=audit-run-{run_id}-results.md"},
    )


def _generate_markdown_report(run: AuditRun, results: AuditResults) -> str:
    """Generate a Markdown report from audit results."""
    lines = [
        f"# Audit Run Report: {run.name}",
        "",
        f"**Run ID:** `{run.id}`",
        f"**Suite:** {run.suite}",
        f"**Status:** {run.status}",
        f"**Created:** {run.created_at.isoformat() if run.created_at else 'N/A'}",
        f"**Completed:** {run.completed_at.isoformat() if run.completed_at else 'N/A'}",
        f"**Fixture:** {run.fixture_id}",
        f"**Provider:** {run.provider_config_id}",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"**Grade:** {results.grade}",
        f"**Overall Score:** {results.overall_score:.1%}",
        f"**Grade Capped (Mandatory Minimums Failed):** {'Yes' if results.grade_capped else 'No'}",
        "",
        "---",
        "",
        "## Pillar Scores",
        "",
        "| Pillar | Score | Weight | Inspections Passed / Total |",
        "|--------|-------|--------|---------------------------|",
    ]

    for pillar in results.pillar_scores:
        lines.append(
            f"| {pillar.name} | {pillar.score:.1%} | {pillar.weight:.0%} | {pillar.inspections_passed} / {pillar.inspections_total} |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## Mandatory Minimum Indicators",
        "",
        "| Inspection | Status |",
        "|------------|--------|",
    ])

    for inspection_id, passed in results.mandatory_minimums.items():
        lines.append(f"| {inspection_id} | {'✅ Pass' if passed else '❌ Fail'} |")

    lines.extend([
        "",
        "---",
        "",
        "## Inspection Details",
        "",
        "| ID | Pillar | Category | Status | Score | Mandatory | Details |",
        "|----|--------|----------|--------|-------|-----------|---------|",
    ])

    for inspection in results.inspections:
        mandatory_marker = "✅" if inspection.is_mandatory_minimum else ""
        status_emoji = {
            "pass": "✅",
            "fail": "❌",
            "partial": "⚠️",
            "insufficient_evidence": "📄",
            "error": "💥",
        }.get(inspection.status, "❓")
        details = inspection.details.replace("|", "\\|").replace("\n", " ") if inspection.details else ""
        lines.append(
            f"| {inspection.id} | {inspection.pillar} | {inspection.category} | {status_emoji} {inspection.status.replace('_', ' ')} | {inspection.score:.1%} | {mandatory_marker} | {details} |"
        )

    return "\n".join(lines)
