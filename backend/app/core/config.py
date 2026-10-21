from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "axiom-forge-ryan-vo"
    app_version: str = "1.0.0"
    environment: Literal["development", "production", "test"] = "development"
    debug: bool = True

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/audit.db"

    # Security
    secret_key: str = Field(default="dev-secret-change-in-production-min-32-chars-long", min_length=32)
    access_token_expire_minutes: int = 30
    csrf_secret: str = Field(default="dev-csrf-secret-change-in-production-min-32-chars-long", min_length=32)

    # OIDC / Keycloak
    oidc_enabled: bool = False
    oidc_issuer_url: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_redirect_uri: str = ""
    oidc_logout_redirect_uri: str = ""

    # Demo mode (localhost only)
    demo_mode: bool = True

    # LLM Providers (optional, for future use)
    llm_default_provider: str = "mock"
    llm_default_model: str = "mock-model"

    # CORS
    cors_origins: list[str] = Field(default_factory=lambda: ["http://127.0.0.1:5173", "http://localhost:5173"])

    # Audit
    default_suite: str = "essential"
    audit_timeout_seconds: int = 120
    sync_audit_execution: bool = False

@lru_cache
def get_settings() -> Settings:
    return Settings()