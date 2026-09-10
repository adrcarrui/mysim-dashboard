from fastapi import APIRouter

from app.services.health_service import get_health


router = APIRouter(
    prefix="/api/health",
    tags=["Health"],
)


@router.get("")
async def health():
    return await get_health()
