from fastapi import APIRouter, HTTPException

from app.services.maintenance_tasks_service import (
    maintenance_tasks_service,
)


router = APIRouter(
    prefix="/maintenance-tasks",
    tags=["Maintenance tasks"],
)


@router.post("/sync")
async def synchronize_maintenance_tasks():
    try:
        synchronized = await (
            maintenance_tasks_service
            .synchronize()
        )

        return {
            "status": "ok",
            "synchronized": synchronized,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc


@router.get("/count")
async def count_maintenance_tasks():
    count = await (
        maintenance_tasks_service.count()
    )

    return {
        "count": count,
    }