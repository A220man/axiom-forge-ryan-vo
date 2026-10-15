from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models import ProviderConfig, ProviderType
from app.schemas import (
    ProviderConfigCreate,
    ProviderConfigListResponse,
    ProviderConfigResponse,
    ProviderConfigUpdate,
    ErrorResponse,
)

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=ProviderConfigListResponse)
async def list_providers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    provider_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_db_session),
):
    query = select(ProviderConfig).order_by(ProviderConfig.created_at.desc())
    count_query = select(func.count(ProviderConfig.id))

    if provider_type:
        try:
            pt = ProviderType(provider_type)
            query = query.where(ProviderConfig.provider_type == pt)
            count_query = count_query.where(ProviderConfig.provider_type == pt)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid provider type: {provider_type}")

    if is_active is not None:
        query = query.where(ProviderConfig.is_active == is_active)
        count_query = count_query.where(ProviderConfig.is_active == is_active)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await session.execute(query)
    providers = result.scalars().all()

    return ProviderConfigListResponse(
        items=[ProviderConfigResponse.model_validate(p) for p in providers],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ProviderConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: ProviderConfigCreate,
    session: AsyncSession = Depends(get_db_session),
):
    provider = ProviderConfig(
        name=provider_data.name,
        provider_type=ProviderType(provider_data.provider_type),
        model=provider_data.model,
        base_url=provider_data.base_url,
        api_key_env=provider_data.api_key_env,
        extra_headers=provider_data.extra_headers,
        timeout_seconds=provider_data.timeout_seconds,
        is_active=provider_data.is_active,
    )
    session.add(provider)
    await session.flush()
    await session.refresh(provider)

    return ProviderConfigResponse.model_validate(provider)


@router.get("/{provider_id}", response_model=ProviderConfigResponse)
async def get_provider(
    provider_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    provider = await session.get(ProviderConfig, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider configuration not found")
    return ProviderConfigResponse.model_validate(provider)


@router.patch("/{provider_id}", response_model=ProviderConfigResponse)
async def update_provider(
    provider_id: str,
    provider_data: ProviderConfigUpdate,
    session: AsyncSession = Depends(get_db_session),
):
    provider = await session.get(ProviderConfig, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider configuration not found")

    if provider_data.name is not None:
        provider.name = provider_data.name
    if provider_data.provider_type is not None:
        provider.provider_type = ProviderType(provider_data.provider_type)
    if provider_data.model is not None:
        provider.model = provider_data.model
    if provider_data.base_url is not None:
        provider.base_url = provider_data.base_url
    if provider_data.api_key_env is not None:
        provider.api_key_env = provider_data.api_key_env
    if provider_data.extra_headers is not None:
        provider.extra_headers = provider_data.extra_headers
    if provider_data.timeout_seconds is not None:
        provider.timeout_seconds = provider_data.timeout_seconds
    if provider_data.is_active is not None:
        provider.is_active = provider_data.is_active

    from datetime import datetime, timezone
    provider.updated_at = datetime.now(timezone.utc)

    await session.flush()
    await session.refresh(provider)

    return ProviderConfigResponse.model_validate(provider)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    provider = await session.get(ProviderConfig, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider configuration not found")

    await session.delete(provider)
    await session.commit()