from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_audit, routes_fixture, routes_provider
from app.core.config import get_settings
from app.core.database import close_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Independent auditing platform for AI agents",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_audit.router)
    app.include_router(routes_fixture.router)
    app.include_router(routes_provider.router)

    @app.get("/healthz", tags=["health"])
    async def health_check():
        return {"status": "ok", "version": settings.app_version, "environment": settings.environment}

    return app


app = create_app()