from fastapi import APIRouter, Query

from app.schemas.task import Task
from app.services.tasks_service import (
    get_upcoming_tasks,
)


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


@router.get(
    "/upcoming",
    response_model=list[Task],
)
async def upcoming_tasks(
    days: int = Query(
        default=7,
        ge=1,
        le=31,
    ),
):
    return await get_upcoming_tasks(
        days=days,
    )