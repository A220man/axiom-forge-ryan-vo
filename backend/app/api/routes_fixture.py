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

import json
import yaml


def _parse_fixture_content(raw_content) -> dict:
    """Parse fixture content, accepting both JSON and YAML formats.

    Tries JSON first, then YAML. Raises HTTPException if neither works
    or required keys are missing.
    """
    if raw_content is None:
        return None

    if isinstance(raw_content, dict):
        return raw_content

    if isinstance(raw_content, str):
        # Try JSON first
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass

        # Try YAML
        try:
            parsed = yaml.safe_load(raw_content)
            if isinstance(parsed, dict):
                return parsed
        except (yaml.YAMLError, ValueError):
            pass

        raise HTTPException(
            status_code=400,
            detail="Fixture content must be a JSON or YAML object with metadata and tests keys",
        )

    raise HTTPException(
        status_code=400,
        detail="Fixture content must be a JSON or YAML object",
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
    if search:
        query = query.where(Fixture.name.ilike(f"%{search}%"))

    total_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(total_query)).scalar()

    items = (await session.execute(query.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return FixtureListResponse(
        items=[FixtureResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=FixtureResponse, status_code=status.HTTP_201_CREATED)
async def create_fixture(
    fixture_data: FixtureCreate,
    session: AsyncSession = Depends(get_db_session),
):
    # Parse and validate fixture content structure (accepts JSON or YAML)
    content = _parse_fixture_content(fixture_data.content)
    if not isinstance(content, dict):
        raise HTTPException(status_code=400, detail="Fixture content must be a JSON or YAML object")

    required_keys = {"metadata", "tests"}
    if not required_keys.issubset(content.keys()):
        raise HTTPException(
            status_code=400,
            detail=f"Fixture content must contain keys: {required_keys}",
        )

    fixture = Fixture(
        name=fixture_data.name,
        description=fixture_data.description,
        content=content,
        schema_version=fixture_data.schema_version,
    )
    session.add(fixture)
    await session.commit()
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

    updated = False
    if fixture_data.name is not None:
        fixture.name = fixture_data.name
        updated = True
    if fixture_data.description is not None:
        fixture.description = fixture_data.description
        updated = True
    if fixture_data.content is not None:
        content = _parse_fixture_content(fixture_data.content)
        if not isinstance(content, dict):
            raise HTTPException(status_code=400, detail="Fixture content must be a JSON or YAML object")
        required_keys = {"metadata", "tests"}
        if not required_keys.issubset(content.keys()):
            raise HTTPException(
                status_code=400,
                detail=f"Fixture content must contain keys: {required_keys}",
            )
        fixture.content = content
        updated = True
    if fixture_data.schema_version is not None:
        fixture.schema_version = fixture_data.schema_version
        updated = True

    if updated:
        fixture.version += 1

    from datetime import datetime, timezone
    fixture.updated_at = datetime.now(timezone.utc)

    await session.flush()
    await session.refresh(fixture)

    return FixtureResponse.model_validate(fixture)


@router.delete("/{fixture_id}", response_model=None, status_code=status.HTTP_204_NO_CONTENT)
async def delete_fixture(
    fixture_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    fixture = await session.get(Fixture, fixture_id)
    if not fixture:
        raise HTTPException(status_code=404, detail="Fixture not found")
    await session.delete(fixture)
    await session.commit()
