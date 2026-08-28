from fastapi import APIRouter, Query

from app.services.actions_service import actions_service


router = APIRouter(
    prefix="/actions",
    tags=["Actions"],
)


@router.get("/open")
async def get_open_actions(
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
):
    return await actions_service.get_open_actions(
        from_date=from_date,
        to_date=to_date,
    )