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

from app.schemas.recommendation import (
    RecommendationsResponse,
)

from app.services.recommendation_service import (
    get_recommendations,
)


router = APIRouter(
    prefix="/recommendations",
    tags=["Recommendations"],
)


@router.get(
    "",
    response_model=(
        RecommendationsResponse
    ),
)
async def recommendations(
    from_date: date = Query(
        ...,
    ),
    to_date: date = Query(
        ...,
    ),
    limit: int = Query(
        5,
        ge=1,
        le=20,
    ),
):
    if (
        to_date
        <= from_date
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "to_date must be "
                "after from_date"
            ),
        )


    window_start = (
        datetime.combine(
            from_date,
            time.min,
        )
    )

    window_end = (
        datetime.combine(
            to_date,
            time.min,
        )
    )


    return await get_recommendations(
        window_start=(
            window_start
        ),
        window_end=(
            window_end
        ),
        limit_per_window=(
            limit
        ),
    )