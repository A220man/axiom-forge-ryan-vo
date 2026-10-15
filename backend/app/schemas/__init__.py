from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FixtureBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    content: dict[str, Any]
    schema_version: str = "1.0"


class FixtureCreate(FixtureBase):
    pass


class FixtureUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    content: Optional[dict[str, Any]] = None
    schema_version: Optional[str] = None


class FixtureResponse(FixtureBase):
    id: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FixtureListResponse(BaseModel):
    items: list[FixtureResponse]
    total: int
    page: int
    page_size: int


class ProviderConfigBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider_type: str = Field(..., pattern="^(mock|openai_compatible|anthropic|gemini|ollama)$")
    model: str = Field(..., min_length=1, max_length=255)
    base_url: Optional[str] = Field(None, max_length=500)
    api_key_env: Optional[str] = Field(None, max_length=100)
    extra_headers: Optional[dict[str, str]] = None
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    is_active: bool = True


class ProviderConfigCreate(ProviderConfigBase):
    pass


class ProviderConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    provider_type: Optional[str] = Field(None, pattern="^(mock|openai_compatible|anthropic|gemini|ollama)$")
    model: Optional[str] = Field(None, min_length=1, max_length=255)
    base_url: Optional[str] = Field(None, max_length=500)
    api_key_env: Optional[str] = Field(None, max_length=100)
    extra_headers: Optional[dict[str, str]] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=300)
    is_active: Optional[bool] = None


class ProviderConfigResponse(ProviderConfigBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProviderConfigListResponse(BaseModel):
    items: list[ProviderConfigResponse]
    total: int
    page: int
    page_size: int


class AuditRunBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    fixture_id: str
    provider_config_id: str
    suite: str = Field(default="essential", pattern="^(smoke|strategic|essential|core|extended|all)$")


class AuditRunCreate(AuditRunBase):
    pass


class AuditRunUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class AuditRunStatus(str):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AuditRunResponse(AuditRunBase):
    id: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    results: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditRunListResponse(BaseModel):
    items: list[AuditRunResponse]
    total: int
    page: int
    page_size: int


class PillarScore(BaseModel):
    name: str
    score: float = Field(..., ge=0.0, le=1.0)
    weight: float = Field(..., ge=0.0, le=1.0)
    inspections_passed: int
    inspections_total: int


class InspectionResult(BaseModel):
    id: str
    category: str
    pillar: str
    status: str = Field(..., pattern="^(pass|fail|partial|insufficient_evidence|error)$")
    score: float = Field(..., ge=0.0, le=1.0)
    details: Optional[str] = None
    is_mandatory_minimum: bool = False


class AuditResults(BaseModel):
    grade: str = Field(..., pattern="^[A-F]$")
    overall_score: float = Field(..., ge=0.0, le=1.0)
    pillar_scores: list[PillarScore]
    inspections: list[InspectionResult]
    mandatory_minimums: dict[str, bool]
    grade_capped: bool = False


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None