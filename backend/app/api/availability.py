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

from app.services.availability_service import (
    get_availability,
)
from app.services.mysim_query_service import (
    begin_cache_trace,
    get_cache_trace_metadata,
)


router = APIRouter(
    prefix="/availability",
    tags=["Availability"],
)


@router.get(
    "",
    response_model=None,
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
    force_refresh: bool = Query(
        False,
        description=(
            "Ignore cached Availability data "
            "and request fresh data from mySIM"
        ),
    ),
    include_cache_metadata: bool = Query(
        False,
        description="Wrap the response with cache metadata",
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

    begin_cache_trace()
    data = await get_availability(
        window_start=window_start,
        window_end=window_end,
        force_refresh=force_refresh,
    )

    if include_cache_metadata:
        return {
            "data": data,
            "cache": get_cache_trace_metadata(),
        }

    return data
