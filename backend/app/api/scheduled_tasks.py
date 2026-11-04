from datetime import date

from fastapi import APIRouter, HTTPException, Query, Depends
from app.api.auth_guard import require_mysim_admin
from app.repositories.scheduled_tasks_repository import (
    scheduled_tasks_repository,
)
from app.services.scheduled_tasks_sync_service import (
    scheduled_tasks_sync_service,
)


router = APIRouter(
    prefix="/scheduled-tasks",
    tags=["Scheduled tasks"],
)


@router.post("/sync", dependencies=[Depends(require_mysim_admin)])
async def synchronize_scheduled_tasks(
    period_start: date = Query(
        description="Fecha inicial incluida",
    ),
    period_end: date = Query(
        description="Fecha final no incluida",
    ),
):
    try:
        synchronized = await (
            scheduled_tasks_sync_service
            .synchronize_period(
                period_start=period_start,
                period_end=period_end,
            )
        )

        return {
            "status": "ok",
            "period_start": period_start,
            "period_end": period_end,
            "period_end_inclusive": False,
            "synchronized": synchronized,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.post("/sync/month", dependencies=[Depends(require_mysim_admin)])
async def synchronize_scheduled_tasks_month(
    year: int = Query(
        ge=2000,
        le=2100,
    ),
    month: int = Query(
        ge=1,
        le=12,
    ),
):
    try:
        synchronized = await (
            scheduled_tasks_sync_service
            .synchronize_month(
                year=year,
                month=month,
            )
        )

        return {
            "status": "ok",
            "year": year,
            "month": month,
            "synchronized": synchronized,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.get("/count")
async def count_scheduled_tasks():
    count = await (
        scheduled_tasks_repository.count()
    )

    return {
        "count": count,
    }