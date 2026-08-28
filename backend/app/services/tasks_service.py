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


def extract_rows(response: dict) -> list[dict]:
    """
    mySim devuelve:

    {
        "msg": "Ok",
        "status": 200,
        "data": {
            "data": [...]
        }
    }
    """

    if not response:
        return []

    data = response.get("data")

    if isinstance(data, dict):
        rows = data.get("data")

        if isinstance(rows, list):
            return rows

    if isinstance(data, list):
        return data

    return []


def parse_mysim_datetime(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        logger.warning(
            "Invalid mySim datetime: %r",
            value,
        )
        return None


def get_device_from_task_id(task_id: str) -> str:
    """
    Ejemplos:

    FTD-00297       -> FTD
    A400M-000797    -> A400M
    295_2-000706    -> 295_2
    MRTT-00392      -> MRTT
    IPT-00363       -> IPT
    """

    match = re.match(r"^(.*)-\d+$", task_id)

    if match:
        return match.group(1)

    return task_id


async def get_upcoming_tasks(
    days: int = 7,
) -> list[Task]:

    start = datetime.now().replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    end = start + timedelta(days=days)

    start_date = start.strftime("%Y-%m-%d")
    end_date = end.strftime("%Y-%m-%d")

    query = (
        "t.entity='MaintenanceSchedule' "
        "AND t.idCol=34 "
        "AND t.enabled=1 "
        "AND t.status<>201 "
        f"AND t.plannedDate>='{start_date}' "
        f"AND t.plannedDate<'{end_date}' "
        "ORDER BY t.plannedDate ASC"
    )

    logger.info(
        "Fetching scheduled tasks: %s",
        query,
    )

    scheduled_response = await mysim_client.get(
        entity="scheduledTasks",
        extra_query=query,
    )

    scheduled_tasks = extract_rows(
        scheduled_response
    )

    if not scheduled_tasks:
        return []

    #
    # IDs internos de maintenanceTask
    #

    task_ids = sorted({
        row["task"]
        for row in scheduled_tasks
        if row.get("task") is not None
    })

    if not task_ids:
        return []

    ids_csv = ",".join(
        str(task_id)
        for task_id in task_ids
    )

    task_query = (
        f"t.id IN ({ids_csv}) "
        "ORDER BY t.id ASC"
    )

    logger.info(
        "Fetching maintenance tasks: %s",
        task_query,
    )

    maintenance_response = await mysim_client.get(
        entity="maintenanceTask",
        extra_query=task_query,
    )

    maintenance_tasks = extract_rows(
        maintenance_response
    )

    maintenance_by_id = {
        row["id"]: row
        for row in maintenance_tasks
        if row.get("id") is not None
    }

    result: list[Task] = []

    for scheduled in scheduled_tasks:

        internal_task_id = scheduled.get(
            "task"
        )

        maintenance = maintenance_by_id.get(
            internal_task_id
        )

        if not maintenance:
            logger.warning(
                "maintenanceTask not found for id=%s",
                internal_task_id,
            )
            continue

        task_id = maintenance.get("taskId")
        description = maintenance.get("task")

        if not task_id:
            logger.warning(
                "maintenanceTask %s has no taskId",
                internal_task_id,
            )
            continue

        planned_date = parse_mysim_datetime(
            scheduled.get("plannedDate")
        )

        if planned_date is None:
            continue

        status_id = scheduled.get("status")

        result.append(
            Task(
                id=scheduled["id"],
                task_id=task_id,
                device=get_device_from_task_id(
                    task_id
                ),
                description=description or "",
                planned_date=planned_date,
                status_id=status_id,
                status=STATUS_MAP.get(
                    status_id,
                    f"Status {status_id}",
                ),
            )
        )

    result.sort(
        key=lambda task: task.planned_date
    )

    return result