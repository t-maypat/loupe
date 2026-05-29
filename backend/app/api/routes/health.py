from fastapi import APIRouter

from app.core.config import settings


router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "public_ingest_enabled": settings.public_ingest_enabled,
        "hcaptcha_enabled": settings.require_hcaptcha,
    }
