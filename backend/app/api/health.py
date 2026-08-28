from fastapi import APIRouter

from app.version import APP_VERSION


router = APIRouter(
    prefix="/api",
    tags=["System"],
)


@router.get("/health")
async def health():
    return {
        "status": "online",
        "version": APP_VERSION,
    }