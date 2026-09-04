from datetime import (
    date,
    datetime,
    time,
)

from fastapi import (
    APIRouter,
    HTTPException,
    Query,
)

from app.schemas.availability import (
    DeviceAvailability,
)
from app.services.availability_service import (
    get_availability,
)


router = APIRouter(
    prefix="/availability",
    tags=["Availability"],
)


@router.get(
    "",
    response_model=list[
        DeviceAvailability
    ],
)
async def availability(
    from_date: date = Query(
        ...,
        description=(
            "Start date, inclusive"
        ),
    ),
    to_date: date = Query(
        ...,
        description=(
            "End date, exclusive"
        ),
    ),
):
    if to_date <= from_date:
        raise HTTPException(
            status_code=400,
            detail=(
                "to_date must be "
                "after from_date"
            ),
        )

    window_start = datetime.combine(
        from_date,
        time.min,
    )

    window_end = datetime.combine(
        to_date,
        time.min,
    )

    return await get_availability(
        window_start=window_start,
        window_end=window_end,
    )