import logging

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.ingest import router as ingest_router
from app.api.routes.query import router as query_router
from app.core.config import settings


app = FastAPI(title=settings.api_title, version=settings.api_version)


@app.on_event("startup")
async def validate_production_settings() -> None:
    if settings.app_env.lower() != "production":
        return
    if settings.session_signing_secret == "change-me-before-production":
        raise RuntimeError("SESSION_SIGNING_SECRET must be set to a unique value in production.")
    if settings.public_ingest_enabled:
        logging.warning("PUBLIC_INGEST_ENABLED is true in production. The public demo can ingest documents.")
    if settings.require_hcaptcha and not settings.hcaptcha_secret_key:
        raise RuntimeError("HCAPTCHA_SECRET_KEY is required when REQUIRE_HCAPTCHA=true in production.")


@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cache-Control"] = "no-store"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(query_router)
