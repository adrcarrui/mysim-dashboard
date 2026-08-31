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
    data = response.get("data")

    if isinstance(data, dict):
        rows = data.get("data")

        if isinstance(rows, list):
            return rows

    return []


def get_task_id_from_schedule_code(
    schedule_code: str | None,
) -> str:
    if not schedule_code:
        return "UNKNOWN"

    return schedule_code


def get_device_from_task_id(task_id: str) -> str:
    parts = task_id.split("-")

    if len(parts) >= 4:
        return parts[2]

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

    #
    # ESTA ES LA CONSULTA QUE YA HEMOS
    # COMPROBADO QUE FUNCIONA EN mySim
    #
    query = (
        f"t.plannedDate>='{start_date}' "
        f"AND t.plannedDate<'{end_date}' "
    )

    logger.info(
        "scheduledTasks query: %s",
        query,
    )

    response = await mysim_client.get(
        entity="scheduledTasks",
        extra_query=query,
    )

    rows = extract_rows(response)

    rows = [
        row
        for row in rows
        if str(row.get("status")) != "201"
    ]

    rows.sort(
        key=lambda row: row.get("plannedDate") or ""
    )
    logger.info(
        "scheduledTasks returned %d rows",
        len(rows),
    )

    result: list[Task] = []

    for row in rows:

        #
        # La consulta funcional también devuelve
        # MaintenanceSchedule 35 (ITC).
        #
        # Nosotros queremos las del schedule 34
        # que estábamos viendo en el dashboard.
        #
        if row.get("entity") != "MaintenanceSchedule":
            continue

        if row.get("idCol") != 34:
            continue

        if not row.get("enabled", False):
            continue

        #
        # No mostrar las ya terminadas.
        #
        status_id = row.get("status")

        if status_id == 201:
            continue

        planned_value = row.get("plannedDate")

        if not planned_value:
            continue

        try:
            planned_date = datetime.fromisoformat(
                planned_value
            )
        except ValueError:
            logger.warning(
                "Invalid plannedDate for task %s: %r",
                row.get("id"),
                planned_value,
            )
            continue

        task_id = get_task_id_from_schedule_code(
            row.get("scheduleTaskCod")
        )

        result.append(
            Task(
                id=row["id"],
                task_id=task_id,
                device=get_device_from_task_id(
                    task_id
                ),
                description="",
                planned_date=row.get("plannedDate"),
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