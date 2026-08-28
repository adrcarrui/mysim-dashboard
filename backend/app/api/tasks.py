from fastapi import APIRouter, Query

from app.schemas.task import Task
from app.services import tasks_service


router = APIRouter(
    prefix="/api/tasks",
    tags=["tasks"],
)


@router.get(
    "/upcoming",
    response_model=list[Task],
)
async def get_upcoming_tasks(
    days: int = Query(default=7, ge=1, le=30),
):
    return await tasks_service.get_upcoming_tasks(days)