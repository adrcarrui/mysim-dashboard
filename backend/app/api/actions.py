from fastapi import APIRouter, Query

from app.schemas.action import Action
from app.services.actions_service import actions_service


router = APIRouter(
    prefix="/actions",
    tags=["Actions"],
)


@router.get(
    "/open",
    response_model=list[Action],
)
async def get_open_actions(
    from_date: str | None = Query(
        default=None,
        description="Fecha inicial YYYY-MM-DD",
    ),
    to_date: str | None = Query(
        default=None,
        description="Fecha final exclusiva YYYY-MM-DD",
    ),
):
    return await actions_service.get_open_actions(
        from_date=from_date,
        to_date=to_date,
    )