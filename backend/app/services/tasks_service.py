from datetime import datetime, timedelta
import logging
import re

from app.schemas.task import Task
from app.services.maintenance_tasks_service import (
    maintenance_tasks_service,
)
from app.services.mysim_query_service import (
    cached_mysim_client as mysim_client,
)
from app.services.task_frequencies_service import (
    task_frequencies_service,
)


from app.services.task_tolerance_rules import (
    get_documented_window,
    get_planning_category,
)

logger = logging.getLogger(__name__)


STATUS_MAP = {
    199: "Pending",
    200: "In process",
    201: "Done",
    2542: "Not done",
}


VALID_STATUS_IDS = {
    199,
    200,
    2542,
}


DEVICE_MAP = {
    "A400M": "A400M",

    "295": "C295",
    "C295": "C295",
    "295_2": "C295 TS03",
    "295/2": "C295 TS03",

    "235": "CN235",
    "CN235": "CN235",

    "MRTT": "MRTT",
    "MT_MRTT1": "MRTT",

    "FTD": "FTD",

    "MPR": "MPRS",

    "IPT": "IPTS",

    "CM": "CMOS",

    "LM": "LMWS",

    "CHT": "CHT",
    "DT": "DT",
    "GEN": "GEN",

    "ARMS": "ARMS",
    "LE": "LE",
}


def extract_rows(
    response: dict,
) -> list[dict]:

    data = response.get(
        "data"
    )

    if isinstance(
        data,
        dict,
    ):

        rows = data.get(
            "data"
        )

        if isinstance(
            rows,
            list,
        ):
            return rows

    return []


def parse_mysim_datetime(
    value: str | None,
) -> datetime | None:

    if not value:
        return None

    formats = (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    )

    for fmt in formats:

        try:
            return datetime.strptime(
                value,
                fmt,
            )

        except ValueError:
            continue

    logger.warning(
        "Could not parse mySim datetime: %s",
        value,
    )

    return None


def get_schedule_parts(
    schedule_code: str | None,
) -> tuple[str, str]:

    if not schedule_code:
        return (
            "UNKNOWN",
            "UNKNOWN",
        )

    parts = schedule_code.split(
        "-"
    )

    if len(parts) < 4:
        return (
            "UNKNOWN",
            schedule_code,
        )

    device_code = parts[-2]
    task_code = parts[-1]

    return (
        device_code,
        task_code,
    )


def normalize_device(
    device_code: str,
) -> str:

    return DEVICE_MAP.get(
        device_code,
        device_code,
    )


def clean_html_text(
    value: str | None,
) -> str | None:

    if not value:
        return None

    value = re.sub(
        r"<[^>]+>",
        " ",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return (
        value.strip()
        or None
    )


def get_tolerance_status(*, now, tolerance_start, tolerance_end) -> str:
    if tolerance_start is None or tolerance_end is None:
        return "unknown_tolerance"
    if now < tolerance_start:
        return "upcoming"
    if now > tolerance_end:
        return "out_of_tolerance"
    return "in_tolerance"


async def get_upcoming_tasks(
    days: int = 7,
) -> list[Task]:

    if not 1 <= days <= 31:
        raise ValueError("days must be between 1 and 31")

    # mySim timestamps are interpreted in the backend's local timezone,
    # preserving the existing convention.
    now = datetime.now()
    today = now.date()

    # No lower date bound: old pending occurrences must remain visible.
    # Fetch enough future dates to include windows opening during the horizon.
    horizon_end = datetime.combine(
        today + timedelta(days=days + 1),
        datetime.min.time(),
    )

    start_date = today - timedelta(weeks=5)
    end_date = horizon_end.date() + timedelta(days=35)

    query = (
        "t.entity='MaintenanceSchedule' "
        "AND t.idCol=34 "
        "AND t.deleted=0 "
        "AND t.enabled=1 "
        f"AND t.plannedDate>='{start_date.isoformat()}' "
        f"AND t.plannedDate<'{end_date.isoformat()}'"
    )

    logger.info(
        "SCHEDULED TASK QUERY: %s",
        query,
    )

    response = (
        await mysim_client.get(
            entity="scheduledTasks",
            extra_query=query,
        )
    )

    if response.get("status") != 200:
        raise RuntimeError("Could not retrieve scheduledTasks from mySim")

    rows = extract_rows(response)

    logger.info(
        "SCHEDULED TASKS RECEIVED: %s",
        len(rows),
    )

    #
    # Excluir Done.
    #
    rows = [
        row
        for row
        in rows
        if row.get(
            "status"
        )
        in VALID_STATUS_IDS
    ]

    logger.info(
        "OPEN SCHEDULED TASKS: %s",
        len(rows),
    )

    #
    # IDs únicos de MaintenanceTask.
    #
    maintenance_task_ids = {
        row.get(
            "task"
        )
        for row
        in rows
        if isinstance(
            row.get(
                "task"
            ),
            int,
        )
    }

    logger.info(
        "UNIQUE MAINTENANCE TASKS: %s",
        len(
            maintenance_task_ids
        ),
    )

    maintenance_details = await (
        maintenance_tasks_service.get_many(
            maintenance_task_ids
        )
    )

    logger.info(
        "MAINTENANCE TASKS FROM POSTGRESQL: %s/%s",
        len(maintenance_details),
        len(maintenance_task_ids),
    )

    #
    # IDs únicos de frecuencia.
    #
    frequency_ids = {
        details.get(
            "frequency"
        )
        for details
        in maintenance_details.values()
        if (
            isinstance(
                details,
                dict,
            )
            and isinstance(
                details.get(
                    "frequency"
                ),
                int,
            )
        )
    }

    logger.info(
        "UNIQUE TASK FREQUENCIES: %s",
        len(
            frequency_ids
        ),
    )

    frequency_details = await (
        task_frequencies_service.get_many(
            frequency_ids
        )
    )

    logger.info(
        "TASK FREQUENCIES FROM POSTGRESQL: %s/%s",
        len(frequency_details),
        len(frequency_ids),
    )

    tasks: list[Task] = []

    #
    # Construcción de tareas enriquecidas.
    #
    for row in rows:

        scheduled_task_id = (
            row.get(
                "id"
            )
        )

        maintenance_task_id = (
            row.get(
                "task"
            )
        )

        schedule_code = (
            row.get(
                "scheduleTaskCod"
            )
        )

        status_id = (
            row.get(
                "status"
            )
        )

        if not isinstance(
            scheduled_task_id,
            int,
        ):
            continue

        if not isinstance(
            maintenance_task_id,
            int,
        ):
            continue

        if not schedule_code:
            continue

        planned_date = (
            parse_mysim_datetime(
                row.get(
                    "plannedDate"
                )
            )
        )

        if planned_date is None:
            continue

        (
            device_code,
            task_code,
        ) = get_schedule_parts(
            schedule_code
        )

        details = (
            maintenance_details.get(
                maintenance_task_id
            )
        )

        description = None

        frequency_id = None
        frequency = None
        frequency_num_of_days = None

        if isinstance(
            details,
            dict,
        ):

            description = clean_html_text(
                details.get(
                    "task"
                )
                or details.get(
                    "description"
                )
                or details.get(
                    "taskDescription"
                )
            )

            raw_frequency_id = (
                details.get(
                    "frequency"
                )
            )

            if isinstance(
                raw_frequency_id,
                int,
            ):

                frequency_id = (
                    raw_frequency_id
                )

                freq_details = (
                    frequency_details.get(
                        frequency_id
                    )
                )

                if isinstance(
                    freq_details,
                    dict,
                ):

                    frequency = (
                        freq_details.get(
                            "name"
                        )
                    )

                    frequency_num_of_days = (
                        freq_details.get(
                            "num_of_days"
                        )
                    )

        (
            tolerance_start,
            tolerance_end,
        ) = get_documented_window(
            planned_date=planned_date,
            device_id=details.get("device") if isinstance(details, dict) else None,
            manual_version=(details.get("preventiveManualVersion")
                            if isinstance(details, dict) else None),
            frequency=frequency,
            has_planned_time=len(str(row.get("plannedDate", "")).strip()) > 10,
        )

        tolerance_status = (
            get_tolerance_status(
                now=now,
                tolerance_start=tolerance_start,
                tolerance_end=tolerance_end,
            )
        )

        planning_category = get_planning_category(
            now=now, planned_date=planned_date,
            tolerance_end=tolerance_end, frequency=frequency,
        )

        task = Task(
            planning_category=planning_category,
            device_id=details.get("device") if isinstance(details, dict) else None,
            preventive_manual_version=(details.get("preventiveManualVersion")
                                       if isinstance(details, dict) else None),
            scheduled_task_id=(
                scheduled_task_id
            ),

            maintenance_task_id=(
                maintenance_task_id
            ),

            schedule_code=(
                schedule_code
            ),

            device=normalize_device(
                device_code
            ),

            task_code=(
                task_code
            ),

            description=(
                description
            ),

            frequency_id=(
                frequency_id
            ),

            frequency=(
                frequency
            ),

            frequency_num_of_days=(
                frequency_num_of_days
            ),

            planned_date=(
                planned_date
            ),

            tolerance_start=(
                tolerance_start
            ),

            tolerance_end=(
                tolerance_end
            ),

            tolerance_status=(
                tolerance_status
            ),

            status=STATUS_MAP.get(
                status_id,
                f"Unknown ({status_id})",
            ),

            status_id=(
                status_id
            ),

            remarks=clean_html_text(
                row.get(
                    "remarksInfo"
                )
            ),

            done_at=parse_mysim_datetime(
                row.get(
                    "doneAt"
                )
            ),

            performed_by=(
                row.get(
                    "performedBy"
                )
            ),

            performance_remarks=(
                clean_html_text(
                    row.get(
                        "performanceRemarks"
                    )
                )
            ),
        )

        tasks.append(
            task
        )

    # Include all past pending tasks, plus future planned dates/windows
    # intersecting today through today + days (inclusive).
    tasks = [task for task in tasks if (
        task.planned_date < horizon_end
        or (task.tolerance_start is not None
            and task.tolerance_start < horizon_end)
    )]

    tolerance_status_order = {
        "out_of_tolerance": 0,
        "backlog": 1,
        "today": 2,
        "upcoming": 3,
        "unknown_tolerance": 4,
    }

    tasks.sort(
        key=lambda task: (
            tolerance_status_order.get(
                task.planning_category,
                99,
            ),

            task.tolerance_end
            or task.planned_date,

            task.device,

            task.task_code,
        )
    )

    logger.info(
        "TASKS AFTER TOLERANCE FILTER: %s",
        len(tasks),
    )

    return tasks
