from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services.devices_service import (
    devices_service,
)


router = APIRouter(
    prefix="/devices",
    tags=["Devices"],
)


@router.post("/sync")
async def synchronize_devices() -> dict[str, Any]:
    try:
        synchronized = (
            await devices_service.synchronize()
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
async def get_devices(
    include_missing: bool = Query(
        default=False,
    ),
) -> dict[str, Any]:
    devices = await devices_service.get_all(
        include_missing=include_missing,
    )

    return {
        "count": len(devices),
        "devices": devices,
    }


@router.get("/raw")
async def get_raw_devices_response() -> dict[str, Any]:
    response = (
        await devices_service
        .get_raw_response()
    )

    if response is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Devices have not been "
                "synchronized yet"
            ),
        )

    return response