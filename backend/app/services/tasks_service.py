from datetime import datetime, timedelta
import logging
import re

from app.schemas.task import Task
from app.services.mysim_client import mysim_client


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


def extract_rows(response: dict) -> list[dict]:
    data = response.get("data")

    if isinstance(data, dict):
        rows = data.get("data")

        if isinstance(rows, list):
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
        return "UNKNOWN", "UNKNOWN"

    parts = schedule_code.split("-")

    if len(parts) < 4:
        return "UNKNOWN", schedule_code

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

    return value.strip() or None


async def get_maintenance_task_description(
    maintenance_task_id: int,
) -> str | None:

    query = f"t.id={maintenance_task_id}"

    response = await mysim_client.get(
        entity="MaintenanceTask",
        extra_query=query,
    )

    rows = extract_rows(response)

    if not rows:
        logger.warning(
            "MaintenanceTask %s not found",
            maintenance_task_id,
        )
        return None

    row = rows[0]

    possible_fields = (
        "description",
        "taskDescription",
        "name",
        "title",
        "taskName",
    )

    for field in possible_fields:

        value = row.get(field)

        if value:
            return clean_html_text(
                str(value)
            )

    logger.warning(
        "MaintenanceTask %s has no known description field. Keys: %s",
        maintenance_task_id,
        list(row.keys()),
    )

    return None


async def get_upcoming_tasks(
    days: int = 7,
) -> list[Task]:

    today = datetime.now().date()

    end_date = today + timedelta(
        days=days
    )

    query = (
        "t.entity='MaintenanceSchedule' "
        "AND t.idCol=34 "
        "AND t.deleted=0 "
        "AND t.enabled=1 "
        f"AND t.plannedDate>='{today.isoformat()}' "
        f"AND t.plannedDate<'{end_date.isoformat()}'"
    )

    logger.info(
        "SCHEDULED TASK QUERY: %s",
        query,
    )

    response = await mysim_client.get(
        entity="scheduledTasks",
        extra_query=query,
    )

    rows = extract_rows(response)

    logger.info(
        "SCHEDULED TASKS RECEIVED: %s",
        len(rows),
    )

    #
    # La API no está aplicando correctamente
    # t.status<>201, así que filtramos aquí.
    #
    rows = [
        row
        for row in rows
        if row.get("status")
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
        row.get("task")
        for row in rows
        if isinstance(
            row.get("task"),
            int,
        )
    }

    #
    # Cache local para no pedir la misma
    # MaintenanceTask varias veces.
    #
    descriptions: dict[
        int,
        str | None
    ] = {}

    for maintenance_task_id in maintenance_task_ids:

        descriptions[
            maintenance_task_id
        ] = await get_maintenance_task_description(
            maintenance_task_id
        )

    tasks: list[Task] = []

    for row in rows:

        scheduled_task_id = row.get("id")
        maintenance_task_id = row.get("task")
        schedule_code = row.get(
            "scheduleTaskCod"
        )
        status_id = row.get("status")

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

        planned_date = parse_mysim_datetime(
            row.get("plannedDate")
        )

        if planned_date is None:
            continue

        device_code, task_code = (
            get_schedule_parts(
                schedule_code
            )
        )

        task = Task(
            scheduled_task_id=scheduled_task_id,

            maintenance_task_id=maintenance_task_id,

            schedule_code=schedule_code,

            device=normalize_device(
                device_code
            ),

            task_code=task_code,

            description=descriptions.get(
                maintenance_task_id
            ),

            planned_date=planned_date,

            status=STATUS_MAP.get(
                status_id,
                f"Unknown ({status_id})",
            ),

            status_id=status_id,

            remarks=clean_html_text(
                row.get("remarksInfo")
            ),

            done_at=parse_mysim_datetime(
                row.get("doneAt")
            ),

            performed_by=row.get(
                "performedBy"
            ),

            performance_remarks=clean_html_text(
                row.get(
                    "performanceRemarks"
                )
            ),
        )

        tasks.append(task)

    #
    # Orden para el operador:
    #
    # fecha -> device -> código de task
    #
    tasks.sort(
        key=lambda task: (
            task.planned_date,
            task.device,
            task.task_code,
        )
    )

    return tasks