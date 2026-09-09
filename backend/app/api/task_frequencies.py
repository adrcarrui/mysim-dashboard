from fastapi import APIRouter, HTTPException

from app.services.task_frequencies_service import (
    task_frequencies_service,
)


router = APIRouter(
    prefix="/task-frequencies",
    tags=["Task frequencies"],
)


@router.post("/sync")
async def synchronize_task_frequencies():
    try:
        synchronized = await (
            task_frequencies_service.synchronize()
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


@router.get("")
async def get_task_frequencies():
    frequencies = await (
        task_frequencies_service.get_all()
    )

    return {
        "count": len(frequencies),
        "frequencies": frequencies,
    }