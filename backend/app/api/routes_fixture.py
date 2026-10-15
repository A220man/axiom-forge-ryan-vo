from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models import Fixture
from app.schemas import (
    FixtureCreate,
    FixtureListResponse,
    FixtureResponse,
    FixtureUpdate,
    ErrorResponse,
)

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


@router.get("", response_model=FixtureListResponse)
async def list_fixtures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db_session),
):
    query = select(Fixture).order_by(Fixture.created_at.desc())
    count_query = select(func.count(Fixture.id))

    if search:
        query = query.where(Fixture.name.ilike(f"%{search}%"))
        count_query = count_query.where(Fixture.name.ilike(f"%{search}%"))

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    fixtures = result.scalars().all()

    return FixtureListResponse(
        items=[FixtureResponse.model_validate(f) for f in fixtures],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=FixtureResponse, status_code=status.HTTP_201_CREATED)
async def create_fixture(
    fixture_data: FixtureCreate,
    session: AsyncSession = Depends(get_db_session),
):
    # Validate fixture content structure
    if not isinstance(fixture_data.content, dict):
        raise HTTPException(status_code=400, detail="Fixture content must be a JSON object")

    required_keys = {"metadata", "tests"}
    if not required_keys.issubset(fixture_data.content.keys()):
        raise HTTPException(
            status_code=400,
            detail=f"Fixture content must contain keys: {required_keys}",
        )

    fixture = Fixture(
        name=fixture_data.name,
        description=fixture_data.description,
        content=fixture_data.content,
        schema_version=fixture_data.schema_version,
        version=1,
    )
    session.add(fixture)
    await session.flush()
    await session.refresh(fixture)

    return FixtureResponse.model_validate(fixture)


@router.get("/{fixture_id}", response_model=FixtureResponse)
async def get_fixture(
    fixture_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    fixture = await session.get(Fixture, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")
    return FixtureResponse.model_validate(fixture)


@router.patch("/{fixture_id}", response_model=FixtureResponse)
async def update_fixture(
    fixture_id: str,
    fixture_data: FixtureUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    fixture = await session.get(Fixture, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")

    if fixture_data.name is not None:
        fixture.name = fixture_data.name
    if fixture_data.description is not None:
        fixture.description = fixture_data.description
    if fixture_data.content is not None:
        if not isinstance(fixture_data.content, dict):
            raise HTTPException(status_code=400, detail="Fixture content must be a JSON object")
        fixture.content = fixture_data.content
        fixture.version += 1
    if fixture_data.schema_version is not None:
        fixture.schema_version = fixture_data.schema_version

    from datetime import datetime, timezone
    fixture.updated_at = datetime.now(timezone.utc)

    await session.flush()
    await session.refresh(fixture)

    return FixtureResponse.model_validate(fixture)


@router.delete("/{fixture_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fixture(
    fixture_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    fixture = await session.get(Fixture, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")

    await session.delete(fixture)
    await session.commit()