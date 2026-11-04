from fastapi import APIRouter, Query, Depends
from app.api.auth_guard import require_mysim_admin
from app.schemas.dr import DrOut
from app.services.drs_service import get_open_drs

router = APIRouter(
    prefix="/drs",
    tags=["Drs"],
)

@router.get(
    "/open",
    response_model=list[DrOut]
)
async def open_drs(
    device_id: int | None = Query(default=None),
):
    return await get_open_drs(
        device_id=device_id,
    )