from fastapi import APIRouter, Query

from app.schemas.job import Job
from app.services.jobs_service import jobs_service


router = APIRouter(
    prefix="/api/jobs",
    tags=["Jobs"],
)


@router.get(
    "/expiring",
    response_model=list[Job],
)
async def get_expiring_jobs(
    days: int = Query(
        default=7,
        ge=0,
        le=365,
    ),
):
    return await jobs_service.get_expiring_jobs(
        days=days
    )

@router.get(
    "/overdue",
    response_model=list[Job],
)
async def get_overdue_jobs():
    return await jobs_service.get_overdue_jobs()