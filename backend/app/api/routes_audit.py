from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.models import AuditRun, AuditRunStatus, Fixture, ProviderConfig
from app.schemas import (
    AuditRunCreate,
    AuditRunListResponse,
    AuditRunResponse,
    AuditRunUpdate,
    AuditResults,
    ErrorResponse,
)
from app.services.audit_engine import execute_audit_run

router = APIRouter(prefix="/audit-runs", tags=["audit-runs"])


@router.get("", response_model=AuditRunListResponse)
async def list_audit_runs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    session: AsyncSession = Depends(get_db_session),
):
    query = select(AuditRun).order_by(AuditRun.created_at.desc())
    count_query = select(func.count(AuditRun.id))

    if status_filter:
        try:
            status_enum = AuditRunStatus(status_filter)
            query = query.where(AuditRun.status == status_enum)
            count_query = count_query.where(AuditRun.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status_filter}")

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    runs = result.scalars().all()

    return AuditRunListResponse(
        items=[AuditRunResponse.model_validate(r) for r in runs],
        total=total,
        page=page,
        page_size=page_size,
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
    await session.flush()
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
    await session.flush()
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

    if run.status != AuditRunStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Cannot execute run with status: {run.status}")

    fixture = await session.get(Fixture, run.fixture_id)
    provider = await session.get(ProviderConfig, run.provider_config_id)

    if not fixture or not provider:
        raise HTTPException(status_code=404, detail="Fixture or provider not found")

    run.status = AuditRunStatus.RUNNING
    run.started_at = datetime.now(timezone.utc)
    await session.flush()

    settings = get_settings()
    if settings.sync_audit_execution:
        # Synchronous execution for testing
        try:
            results = await execute_audit_run(run, fixture, provider)
            run.status = AuditRunStatus.COMPLETED
            run.completed_at = datetime.now(timezone.utc)
            run.results = results.model_dump()
        except Exception as e:
            run.status = AuditRunStatus.FAILED
            run.completed_at = datetime.now(timezone.utc)
            run.error_message = str(e)
        run.updated_at = datetime.now(timezone.utc)
        await session.commit()
    else:
        # Get the session factory from the current session's bind
        from app.core.database import async_session_maker
        background_tasks.add_task(run_audit_background, run_id, fixture, provider, async_session_maker)

    return AuditRunResponse.model_validate(run)


async def run_audit_background(
    run_id: str,
    fixture: Fixture,
    provider: ProviderConfig,
    session_factory=None,
):
    """Run audit in background with optional session factory override for testing."""
    from app.core.database import async_session_maker as default_session_maker

    session_maker = session_factory or default_session_maker

    async with session_maker() as session:
        run = await session.get(AuditRun, run_id)
        if not run:
            return

        try:
            results = await execute_audit_run(run, fixture, provider)
            run.status = AuditRunStatus.COMPLETED
            run.completed_at = datetime.now(timezone.utc)
            run.results = results.model_dump()
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