from datetime import (
    datetime,
    time,
    timedelta,
)

from app.schemas.recommendation import (
    DeviceRecommendations,
    RecommendationReason,
    RecommendedWindow,
    RecommendationsResponse,
    TaskRecommendation,
)

from app.services.availability_service import (
    get_availability,
)

from app.services.tasks_service import (
    get_upcoming_tasks,
)


# =========================================================
# CONFIGURACIÓN
# =========================================================

STATUS_SCORES = {
    "Not done": 30,
    "Pending": 20,
    "In process": 10,
}


FREQUENCY_SCORES = {
    "Daily": 15,
    "Weekly": 12,
    "Biweekly": 10,
    "Monthly": 8,
    "Quarterly": 6,
    "SemiAnnual": 4,
    "Annual": 2,
}


# =========================================================
# DEVICE ALIASES
# =========================================================

DEVICE_ALIASES = {
    # A400M
    "A400M": "A400M",
    "FFS A400M": "A400M",

    # MRTT
    "MRTT": "MRTT",
    "A330 MRTT": "MRTT",
    "FFS A330 MRTT": "MRTT",

    # C295 EA03
    "C295": "C295",
    "C295 EA03": "C295",
    "FFS C295 EA03": "C295",

    # C295 TS03
    "C295 TS03": "C295 TS03",
    "FFS C295 TS03": "C295 TS03",

    # CN235
    "CN235": "CN235",
    "FFS CN235": "CN235",

    # Otros
    "FTD": "FTD",
    "FTD A400M": "FTD",

    "ARMS": "ARMS",

    "CHT": "CHT",
    "CHT-E": "CHT",
}


# =========================================================
# NORMALIZACIÓN
# =========================================================

def normalize_device(
    value: str | None,
) -> str:
    if not value:
        return ""

    normalized = (
        value
        .strip()
        .upper()
    )

    aliases = {
        key.upper():
            mapped.upper()
        for (
            key,
            mapped,
        )
        in DEVICE_ALIASES.items()
    }

    return aliases.get(
        normalized,
        normalized,
    )


# =========================================================
# DURACIÓN TASK
# =========================================================

def get_duration(
    task,
) -> tuple[
    int | None,
    str,
]:
    possible_fields = (
        "duration_minutes",
        "estimated_duration_minutes",
        "estimated_time",
        "estimatedTime",
    )

    for field in possible_fields:

        value = getattr(
            task,
            field,
            None,
        )

        if value is None:
            continue

        try:
            duration = int(
                value
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

        if duration > 0:
            return (
                duration,
                "mysim",
            )

    return (
        None,
        "unknown",
    )


# =========================================================
# DURACIÓN WINDOW
# =========================================================

def calculate_minutes(
    start: datetime,
    end: datetime,
) -> int:
    return max(
        0,
        int(
            (
                end - start
            ).total_seconds()
            / 60
        ),
    )


# =========================================================
# SPLIT FREE WINDOWS BY DAY
# =========================================================

def split_window_by_day(
    *,
    start: datetime,
    end: datetime,
) -> list[
    tuple[
        datetime,
        datetime,
    ]
]:
    if end <= start:
        return []

    windows: list[
        tuple[
            datetime,
            datetime,
        ]
    ] = []

    current_start = start

    while current_start < end:

        next_midnight = datetime.combine(
            (
                current_start.date()
                + timedelta(days=1)
            ),
            time.min,
        )

        current_end = min(
            end,
            next_midnight,
        )

        if current_end > current_start:
            windows.append(
                (
                    current_start,
                    current_end,
                )
            )

        current_start = (
            current_end
        )

    return windows


def split_free_windows_by_day(
    free_windows,
):
    daily_windows: list[
        tuple[
            datetime,
            datetime,
        ]
    ] = []

    for interval in free_windows:

        pieces = (
            split_window_by_day(
                start=(
                    interval.start
                ),
                end=(
                    interval.end
                ),
            )
        )

        daily_windows.extend(
            pieces
        )

    return daily_windows


# =========================================================
# AVAILABILITY ∩ TOLERANCE
# =========================================================

def get_effective_window(
    *,
    task,
    free_window_start: datetime,
    free_window_end: datetime,
) -> tuple[
    datetime,
    datetime,
    str,
    bool,
]:
    tolerance_start = getattr(
        task,
        "tolerance_start",
        None,
    )

    tolerance_end = getattr(
        task,
        "tolerance_end",
        None,
    )


    # Sin tolerance
    if (
        tolerance_start is None
        or tolerance_end is None
    ):
        return (
            free_window_start,
            free_window_end,
            "unknown",
            True,
        )


    # Hueco antes de toleranceStart
    if (
        free_window_end
        <= tolerance_start
    ):
        return (
            free_window_start,
            free_window_end,
            "not_due_yet",
            False,
        )


    # Solape
    overlaps = (
        free_window_start
        < tolerance_end
        and
        free_window_end
        > tolerance_start
    )

    if overlaps:

        effective_start = max(
            free_window_start,
            tolerance_start,
        )

        effective_end = min(
            free_window_end,
            tolerance_end,
        )

        if (
            effective_end
            <= effective_start
        ):
            return (
                effective_start,
                effective_end,
                "invalid",
                False,
            )

        return (
            effective_start,
            effective_end,
            "within_tolerance",
            True,
        )


    # Hueco después de toleranceEnd
    if (
        free_window_start
        >= tolerance_end
    ):
        return (
            free_window_start,
            free_window_end,
            "overdue",
            True,
        )


    return (
        free_window_start,
        free_window_end,
        "unknown",
        True,
    )


# =========================================================
# BONUS SIZE
# =========================================================

def calculate_window_size_score(
    window_minutes: int,
) -> tuple[
    int,
    RecommendationReason | None,
]:

    if window_minutes >= 240:
        return (
            15,
            RecommendationReason(
                code="large_window",
                label="Large free window",
                score=15,
            ),
        )

    if window_minutes >= 120:
        return (
            10,
            RecommendationReason(
                code="medium_window",
                label="Medium free window",
                score=10,
            ),
        )

    if window_minutes >= 60:
        return (
            5,
            RecommendationReason(
                code="useful_window",
                label="Useful free window",
                score=5,
            ),
        )

    if window_minutes >= 30:
        return (
            2,
            RecommendationReason(
                code="short_window",
                label="Short free window",
                score=2,
            ),
        )

    return (
        0,
        None,
    )


# =========================================================
# TOLERANCE SCORE
# =========================================================

def calculate_tolerance_score(
    *,
    task,
    effective_start: datetime,
    window_tolerance_status: str,
) -> tuple[
    int,
    RecommendationReason,
]:

    tolerance_end = getattr(
        task,
        "tolerance_end",
        None,
    )


    if (
        tolerance_end is None
        or
        window_tolerance_status
        == "unknown"
    ):
        return (
            5,
            RecommendationReason(
                code="tolerance_unknown",
                label="Tolerance unknown",
                score=5,
            ),
        )


    if (
        window_tolerance_status
        == "overdue"
    ):

        overdue_minutes = int(
            (
                effective_start
                - tolerance_end
            ).total_seconds()
            / 60
        )

        overdue_days = (
            overdue_minutes
            / 60
            / 24
        )

        if overdue_days >= 7:
            score = 120

        elif overdue_days >= 3:
            score = 110

        else:
            score = 100

        return (
            score,
            RecommendationReason(
                code="overdue",
                label=(
                    "Task is overdue "
                    "at this free window"
                ),
                score=score,
            ),
        )


    remaining_minutes = int(
        (
            tolerance_end
            - effective_start
        ).total_seconds()
        / 60
    )

    remaining_hours = (
        remaining_minutes
        / 60
    )


    if remaining_hours <= 24:
        return (
            100,
            RecommendationReason(
                code="tolerance_critical",
                label=(
                    "Tolerance ends "
                    "within 24 h"
                ),
                score=100,
            ),
        )


    if remaining_hours <= 72:
        return (
            80,
            RecommendationReason(
                code="tolerance_ending",
                label=(
                    "Tolerance ends "
                    "within 3 days"
                ),
                score=80,
            ),
        )


    return (
        60,
        RecommendationReason(
            code="within_tolerance",
            label=(
                "Free window is within "
                "task tolerance"
            ),
            score=60,
        ),
    )


# =========================================================
# PLANNED DATE RELATION
# =========================================================

def get_planned_relation(
    *,
    task,
    window_start: datetime,
    window_end: datetime,
) -> str:

    planned_date = getattr(
        task,
        "planned_date",
        None,
    )

    if planned_date is None:
        return "unknown"


    if (
        window_start
        <= planned_date
        < window_end
    ):
        return "planned_in_window"


    if (
        window_end
        <= planned_date
    ):
        return "before_planned"


    if (
        window_start
        > planned_date
    ):
        return "after_planned"


    return "unknown"


# =========================================================
# PLANNED DATE SCORE
# =========================================================

def calculate_planned_date_score(
    *,
    task,
    window_start: datetime,
    window_end: datetime,
) -> tuple[
    int,
    RecommendationReason | None,
]:

    planned_date = getattr(
        task,
        "planned_date",
        None,
    )

    if planned_date is None:
        return (
            0,
            None,
        )


    if (
        window_start
        <= planned_date
        < window_end
    ):
        return (
            40,
            RecommendationReason(
                code="planned_in_window",
                label=(
                    "Planned date is "
                    "inside free window"
                ),
                score=40,
            ),
        )


    if (
        window_end
        <= planned_date
    ):

        minutes_until_planned = int(
            (
                planned_date
                - window_end
            ).total_seconds()
            / 60
        )

        hours_until_planned = (
            minutes_until_planned
            / 60
        )


        if hours_until_planned <= 24:
            return (
                25,
                RecommendationReason(
                    code="before_planned",
                    label=(
                        "Free window is "
                        "before planned date "
                        "within 24 h"
                    ),
                    score=25,
                ),
            )


        if hours_until_planned <= 72:
            return (
                15,
                RecommendationReason(
                    code="before_planned",
                    label=(
                        "Free window is "
                        "before planned date "
                        "within 3 days"
                    ),
                    score=15,
                ),
            )


        return (
            5,
            RecommendationReason(
                code="before_planned",
                label=(
                    "Free window is "
                    "before planned date"
                ),
                score=5,
            ),
        )


    if (
        window_start
        > planned_date
    ):

        minutes_after_planned = int(
            (
                window_start
                - planned_date
            ).total_seconds()
            / 60
        )

        hours_after_planned = (
            minutes_after_planned
            / 60
        )


        if hours_after_planned <= 24:
            return (
                20,
                RecommendationReason(
                    code="after_planned",
                    label=(
                        "Free window is "
                        "after planned date "
                        "within 24 h"
                    ),
                    score=20,
                ),
            )


        if hours_after_planned <= 72:
            return (
                10,
                RecommendationReason(
                    code="after_planned",
                    label=(
                        "Free window is "
                        "after planned date "
                        "within 3 days"
                    ),
                    score=10,
                ),
            )


        return (
            5,
            RecommendationReason(
                code="after_planned",
                label=(
                    "Free window is "
                    "after planned date"
                ),
                score=5,
            ),
        )


    return (
        0,
        None,
    )


# =========================================================
# EVALUATE TASK WINDOW
# =========================================================

def evaluate_task_window(
    *,
    task,
    window_start: datetime,
    window_end: datetime,
) -> RecommendedWindow | None:

    (
        effective_start,
        effective_end,
        window_tolerance_status,
        valid_candidate,
    ) = (
        get_effective_window(
            task=task,
            free_window_start=(
                window_start
            ),
            free_window_end=(
                window_end
            ),
        )
    )


    if not valid_candidate:
        return None


    effective_minutes = (
        calculate_minutes(
            effective_start,
            effective_end,
        )
    )


    if effective_minutes <= 0:
        return None


    score = 0

    reasons: list[
        RecommendationReason
    ] = []


    # =====================================================
    # TOLERANCE
    # =====================================================

    (
        tolerance_score,
        tolerance_reason,
    ) = (
        calculate_tolerance_score(
            task=task,
            effective_start=(
                effective_start
            ),
            window_tolerance_status=(
                window_tolerance_status
            ),
        )
    )


    score += (
        tolerance_score
    )

    reasons.append(
        tolerance_reason
    )


    # =====================================================
    # PLANNED DATE
    # =====================================================

    (
        planned_score,
        planned_reason,
    ) = (
        calculate_planned_date_score(
            task=task,
            window_start=(
                effective_start
            ),
            window_end=(
                effective_end
            ),
        )
    )


    score += (
        planned_score
    )


    if planned_reason:
        reasons.append(
            planned_reason
        )


    # =====================================================
    # STATUS
    # =====================================================

    status = getattr(
        task,
        "status",
        "",
    )


    status_score = (
        STATUS_SCORES.get(
            status,
            0,
        )
    )


    if status_score:

        score += (
            status_score
        )

        reasons.append(
            RecommendationReason(
                code="status",
                label=status,
                score=(
                    status_score
                ),
            )
        )


    # =====================================================
    # FREQUENCY
    # =====================================================

    frequency = getattr(
        task,
        "frequency",
        None,
    )


    frequency_score = (
        FREQUENCY_SCORES.get(
            frequency or "",
            0,
        )
    )


    if frequency_score:

        score += (
            frequency_score
        )

        reasons.append(
            RecommendationReason(
                code="frequency",
                label=(
                    frequency
                    or "Unknown"
                ),
                score=(
                    frequency_score
                ),
            )
        )


    # =====================================================
    # DURATION
    # =====================================================

    (
        duration_minutes,
        _,
    ) = get_duration(
        task
    )


    fits_window: bool | None


    if duration_minutes is None:

        fits_window = None

        reasons.append(
            RecommendationReason(
                code="duration_unknown",
                label="Duration unknown",
                score=0,
            )
        )


        (
            window_size_score,
            window_size_reason,
        ) = (
            calculate_window_size_score(
                effective_minutes
            )
        )


        score += (
            window_size_score
        )


        if window_size_reason:
            reasons.append(
                window_size_reason
            )


    elif (
        duration_minutes
        <= effective_minutes
    ):

        fits_window = True

        score += 30

        reasons.append(
            RecommendationReason(
                code="fits_window",
                label=(
                    f"Fits in "
                    f"{effective_minutes} min "
                    f"window"
                ),
                score=30,
            )
        )


        utilization = (
            duration_minutes
            / effective_minutes
        )


        if utilization >= 0.75:

            score += 20

            reasons.append(
                RecommendationReason(
                    code="high_utilization",
                    label=(
                        "High free window "
                        "utilization"
                    ),
                    score=20,
                )
            )


        elif utilization >= 0.50:

            score += 15

            reasons.append(
                RecommendationReason(
                    code="good_utilization",
                    label=(
                        "Good free window "
                        "utilization"
                    ),
                    score=15,
                )
            )


        elif utilization >= 0.25:

            score += 8

            reasons.append(
                RecommendationReason(
                    code="partial_utilization",
                    label=(
                        "Partial free window "
                        "utilization"
                    ),
                    score=8,
                )
            )


    else:

        fits_window = False

        score -= 200

        reasons.append(
            RecommendationReason(
                code="does_not_fit",
                label=(
                    f"Requires "
                    f"{duration_minutes} min"
                ),
                score=-200,
            )
        )


    return RecommendedWindow(
        start=(
            effective_start
        ),

        end=(
            effective_end
        ),

        durationMinutes=(
            effective_minutes
        ),

        score=(
            score
        ),

        fitsWindow=(
            fits_window
        ),

        windowToleranceStatus=(
            window_tolerance_status
        ),

        reasons=(
            reasons
        ),
    )


# =========================================================
# TOLERANCE ORDER
# =========================================================

def get_tolerance_order(
    status: str,
) -> int:

    order = {
        "within_tolerance": 0,
        "overdue": 1,
        "unknown": 2,
    }

    return order.get(
        status,
        3,
    )


# =========================================================
# PLANNED ORDER
# =========================================================

def get_planned_order(
    *,
    task,
    item: RecommendedWindow,
) -> int:

    relation = (
        get_planned_relation(
            task=task,
            window_start=(
                item.start
            ),
            window_end=(
                item.end
            ),
        )
    )


    order = {
        "planned_in_window": 0,
        "before_planned": 1,
        "after_planned": 2,
        "unknown": 3,
    }


    return order.get(
        relation,
        3,
    )


# =========================================================
# DISTANCE TO PLANNED DATE
# =========================================================

def get_planned_distance_minutes(
    *,
    task,
    item: RecommendedWindow,
) -> int:

    planned_date = getattr(
        task,
        "planned_date",
        None,
    )


    if planned_date is None:
        return 999999999


    if (
        item.start
        <= planned_date
        < item.end
    ):
        return 0


    if item.end <= planned_date:

        return int(
            (
                planned_date
                - item.end
            ).total_seconds()
            / 60
        )


    return int(
        (
            item.start
            - planned_date
        ).total_seconds()
        / 60
    )


# =========================================================
# WINDOW SORT
# =========================================================

def window_sort_key(
    *,
    task,
    item: RecommendedWindow,
):
    """
    Orden definitivo:

    1. within_tolerance
    2. planned relation:
       - planned_in_window
       - before_planned
       - after_planned
    3. fit:
       - cabe
       - unknown
       - no cabe
    4. mayor score
    5. mayor duración
    6. menor distancia a plannedDate
    7. fecha más temprana
    """


    tolerance_order = (
        get_tolerance_order(
            item.windowToleranceStatus
        )
    )


    planned_order = (
        get_planned_order(
            task=task,
            item=item,
        )
    )


    planned_distance = (
        get_planned_distance_minutes(
            task=task,
            item=item,
        )
    )


    if (
        item.fitsWindow
        is True
    ):
        fit_order = 0

    elif (
        item.fitsWindow
        is None
    ):
        fit_order = 1

    else:
        fit_order = 2


    return (
        tolerance_order,
        planned_order,
        fit_order,
        -item.score,
        -item.durationMinutes,
        planned_distance,
        item.start,
    )


# =========================================================
# BUILD TASK RECOMMENDATION
# =========================================================

def build_task_recommendation(
    *,
    task,
    free_windows,
    alternatives: int = 2,
) -> TaskRecommendation | None:

    candidate_windows: list[
        RecommendedWindow
    ] = []


    daily_windows = (
        split_free_windows_by_day(
            free_windows
        )
    )


    for (
        daily_start,
        daily_end,
    ) in daily_windows:

        recommendation = (
            evaluate_task_window(
                task=task,
                window_start=(
                    daily_start
                ),
                window_end=(
                    daily_end
                ),
            )
        )


        if (
            recommendation
            is None
        ):
            continue


        candidate_windows.append(
            recommendation
        )


    if not candidate_windows:
        return None


    candidate_windows.sort(
        key=lambda item:
            window_sort_key(
                task=task,
                item=item,
            )
    )


    best_window = (
        candidate_windows[0]
    )


    alternative_windows = (
        candidate_windows[
            1:
            1 + alternatives
        ]
    )


    (
        duration_minutes,
        duration_source,
    ) = get_duration(
        task
    )


    return TaskRecommendation(
        scheduledTaskId=(
            task.scheduled_task_id
        ),

        maintenanceTaskId=(
            task.maintenance_task_id
        ),

        scheduleCode=(
            task.schedule_code
        ),

        taskCode=(
            task.task_code
        ),

        device=(
            task.device
        ),

        description=(
            task.description
        ),

        plannedDate=(
            task.planned_date
        ),

        toleranceStart=(
            task.tolerance_start
        ),

        toleranceEnd=(
            task.tolerance_end
        ),

        currentToleranceStatus=(
            task.tolerance_status
        ),

        frequency=(
            task.frequency
        ),

        status=(
            task.status
        ),

        durationMinutes=(
            duration_minutes
        ),

        durationSource=(
            duration_source
        ),

        bestWindow=(
            best_window
        ),

        alternativeWindows=(
            alternative_windows
        ),
    )


# =========================================================
# TASK SORT
# =========================================================

def task_sort_key(
    item: TaskRecommendation,
):

    if (
        item.bestWindow
        is None
    ):
        return (
            99,
            0,
            item.plannedDate,
        )


    tolerance_order = (
        get_tolerance_order(
            item
            .bestWindow
            .windowToleranceStatus
        )
    )


    return (
        tolerance_order,
        -item.bestWindow.score,
        item.plannedDate,
        item.taskCode,
    )


# =========================================================
# MAIN SERVICE
# =========================================================

async def get_recommendations(
    *,
    window_start: datetime,
    window_end: datetime,
    limit_per_window: int = 5,
) -> RecommendationsResponse:

    availability = (
        await get_availability(
            window_start=(
                window_start
            ),
            window_end=(
                window_end
            ),
        )
    )


    tasks = (
        await get_upcoming_tasks()
    )


    result_devices: list[
        DeviceRecommendations
    ] = []


    for device in availability:

        normalized_device = (
            normalize_device(
                device.deviceName
            )
        )


        device_tasks = [
            task
            for task in tasks
            if normalize_device(
                task.device
            )
            == normalized_device
        ]


        task_recommendations: list[
            TaskRecommendation
        ] = []


        for task in device_tasks:

            recommendation = (
                build_task_recommendation(
                    task=task,
                    free_windows=(
                        device.available
                    ),
                    alternatives=2,
                )
            )


            if (
                recommendation
                is None
            ):
                continue


            task_recommendations.append(
                recommendation
            )


        task_recommendations.sort(
            key=task_sort_key
        )


        task_recommendations = (
            task_recommendations[
                :limit_per_window
            ]
        )


        result_devices.append(
            DeviceRecommendations(
                deviceId=(
                    device.deviceId
                ),

                deviceName=(
                    device.deviceName
                ),

                taskDeviceName=(
                    normalized_device
                ),

                tasks=(
                    task_recommendations
                ),
            )
        )


    return RecommendationsResponse(
        fromDate=(
            window_start
        ),

        toDate=(
            window_end
        ),

        devices=(
            result_devices
        ),
    )