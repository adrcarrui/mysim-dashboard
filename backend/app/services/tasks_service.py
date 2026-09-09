from datetime import datetime, timedelta
import asyncio
import logging
import re
import time

from app.schemas.task import Task
from app.services.mysim_client import mysim_client
from app.services.task_frequencies_service import (
    task_frequencies_service,
)


logger = logging.getLogger(__name__)


TOLERANCE_MAP = {
    "Daily": timedelta(hours=12),

    "Weekly": timedelta(days=1),

    "Biweekly": timedelta(days=2),

    "Monthly": timedelta(weeks=1),
    "28 days": timedelta(weeks=1),

    "Quarterly": timedelta(weeks=3),

    "SemiAnnual": timedelta(weeks=4),

    "Annual": timedelta(weeks=5),
    "Biennial": timedelta(weeks=5),
    "Triannual": timedelta(weeks=5),
    "Quadrennial": timedelta(weeks=5),
    "Quinquennial": timedelta(weeks=5),
    "5 years": timedelta(weeks=5),
    "10 Years": timedelta(weeks=5),
}


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


#
# NÃºmero mÃ¡ximo de peticiones concurrentes a mySim.
#
MYSIM_CONCURRENCY = 10


#
# Tiempo de vida de la cachÃ©.
#
# 3600 segundos = 1 hora.
#
CACHE_TTL_SECONDS = 3600


#
# CachÃ© de MaintenanceTask.
#
# {
#     maintenance_task_id: (
#         timestamp,
#         details,
#     )
# }
#
maintenance_task_cache: dict[
    int,
    tuple[float, dict | None]
] = {}


#
# Locks por ID.
#
# Evitan que dos peticiones simultÃ¡neas
# consulten el mismo dato a mySim.
#
maintenance_task_locks: dict[
    int,
    asyncio.Lock
] = {}


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


def is_cache_valid(
    cached_at: float,
) -> bool:

    return (
        time.monotonic()
        - cached_at
        < CACHE_TTL_SECONDS
    )


async def get_maintenance_task_details(
    maintenance_task_id: int,
) -> dict | None:

    #
    # 1. Comprobar cachÃ©.
    #
    cached = (
        maintenance_task_cache.get(
            maintenance_task_id
        )
    )

    if cached is not None:

        cached_at, details = cached

        if is_cache_valid(
            cached_at
        ):

            logger.debug(
                "MaintenanceTask CACHE HIT: %s",
                maintenance_task_id,
            )

            return details

    #
    # 2. Lock especÃ­fico para este ID.
    #
    lock = (
        maintenance_task_locks.setdefault(
            maintenance_task_id,
            asyncio.Lock(),
        )
    )

    async with lock:

        #
        # Volvemos a comprobar la cachÃ©
        # porque otra coroutine podrÃ­a haberla
        # rellenado mientras esperÃ¡bamos el lock.
        #
        cached = (
            maintenance_task_cache.get(
                maintenance_task_id
            )
        )

        if cached is not None:

            cached_at, details = cached

            if is_cache_valid(
                cached_at
            ):

                logger.debug(
                    "MaintenanceTask CACHE HIT AFTER LOCK: %s",
                    maintenance_task_id,
                )

                return details

        logger.debug(
            "MaintenanceTask CACHE MISS: %s",
            maintenance_task_id,
        )

        query = (
            f"t.id={maintenance_task_id}"
        )

        response = (
            await mysim_client.get(
                entity="maintenanceTask",
                extra_query=query,
            )
        )

        rows = extract_rows(
            response
        )

        if not rows:

            logger.warning(
                "MaintenanceTask %s not found",
                maintenance_task_id,
            )

            details = None

        else:

            details = rows[0]

        #
        # Guardar resultado en cachÃ©.
        #
        maintenance_task_cache[
            maintenance_task_id
        ] = (
            time.monotonic(),
            details,
        )

        return details


def get_tolerance_window(
    planned_date: datetime,
    frequency: str | None,
) -> tuple[
    datetime | None,
    datetime | None,
]:

    if not frequency:
        return (
            None,
            None,
        )

    tolerance = (
        TOLERANCE_MAP.get(
            frequency
        )
    )

    if tolerance is None:
        return (
            None,
            None,
        )

    return (
        planned_date
        - tolerance,

        planned_date
        + tolerance,
    )


def get_tolerance_status(
    *,
    now: datetime,
    planned_date: datetime,
    tolerance_start: datetime | None,
    tolerance_end: datetime | None,
    frequency: str | None,
) -> str:

    if (
        frequency
        and frequency
        not in TOLERANCE_MAP
    ):
        return (
            "unknown_tolerance"
        )

    if (
        tolerance_start is None
        or tolerance_end is None
    ):
        return (
            "unknown_tolerance"
        )

    if now < tolerance_start:
        return "upcoming"

    if now > tolerance_end:
        return (
            "out_of_tolerance"
        )

    return (
        "in_tolerance"
    )


async def get_upcoming_tasks(
    days: int = 7,
) -> list[Task]:

    now = datetime.now()
    today = now.date()

    #
    # Recuperamos suficiente histÃ³rico y futuro
    # para cubrir la tolerancia mÃ¡xima de Â±5 semanas.
    #
    start_date = (
        today
        - timedelta(
            weeks=5
        )
    )

    end_date = (
        today
        + timedelta(
            weeks=5
        )
        + timedelta(
            days=1
        )
    )

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

    rows = extract_rows(
        response
    )

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
    # IDs Ãºnicos de MaintenanceTask.
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

    #
    # NÃºmero de IDs que ya tenemos
    # disponibles en cachÃ©.
    #
    valid_cached_maintenance = sum(
        1
        for maintenance_task_id
        in maintenance_task_ids
        if (
            maintenance_task_id
            in maintenance_task_cache
            and is_cache_valid(
                maintenance_task_cache[
                    maintenance_task_id
                ][0]
            )
        )
    )

    logger.info(
        "MAINTENANCE TASK CACHE: %s/%s",
        valid_cached_maintenance,
        len(
            maintenance_task_ids
        ),
    )

    #
    # Limitador de concurrencia.
    #
    semaphore = asyncio.Semaphore(
        MYSIM_CONCURRENCY
    )

    #
    # Cargar MaintenanceTask.
    #
    # Los que estÃ©n en cachÃ© se devolverÃ¡n
    # inmediatamente.
    #
    async def load_maintenance_task(
        maintenance_task_id: int,
    ) -> tuple[
        int,
        dict | None,
    ]:

        async with semaphore:

            details = (
                await get_maintenance_task_details(
                    maintenance_task_id
                )
            )

            return (
                maintenance_task_id,
                details,
            )

    maintenance_results = (
        await asyncio.gather(
            *[
                load_maintenance_task(
                    maintenance_task_id
                )
                for maintenance_task_id
                in maintenance_task_ids
            ]
        )
    )

    maintenance_details: dict[
        int,
        dict | None
    ] = {
        maintenance_task_id: details
        for (
            maintenance_task_id,
            details,
        )
        in maintenance_results
    }

    #
    # IDs Ãºnicos de frecuencia.
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
    # ConstrucciÃ³n de tareas enriquecidas.
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
        ) = get_tolerance_window(
            planned_date,
            frequency,
        )

        tolerance_status = (
            get_tolerance_status(
                now=now,
                planned_date=planned_date,
                tolerance_start=tolerance_start,
                tolerance_end=tolerance_end,
                frequency=frequency,
            )
        )

        task = Task(
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

    #
    # Mostrar:
    #
    # - Siempre out of tolerance.
    # - Siempre in tolerance.
    # - Upcoming solamente prÃ³ximos 3 dÃ­as.
    #
    display_limit = (
        now
        + timedelta(
            days=3
        )
    )

    tasks = [
        task
        for task
        in tasks
        if (
            task.tolerance_status
            in {
                "out_of_tolerance",
                "in_tolerance",
            }
            or (
                task.tolerance_status
                == "upcoming"
                and task.planned_date
                <= display_limit
            )
            or (
                task.tolerance_status
                == "unknown_tolerance"
                and task.planned_date
                <= display_limit
            )
        )
    ]

    tolerance_status_order = {
        "out_of_tolerance": 0,
        "in_tolerance": 1,
        "upcoming": 2,
        "unknown_tolerance": 3,
    }

    tasks.sort(
        key=lambda task: (
            tolerance_status_order.get(
                task.tolerance_status,
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