from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.task_tolerance_rules import get_documented_window

MADRID = ZoneInfo("Europe/Madrid")

SCHEDULED_FIELDS = """
    s.mysim_id, s.planned_date, s.status_id, s.done_at, s.maintenance_task_id,
    m.task_id AS task_code, m.device_id, m.preventive_manual_version,
    f.name AS frequency, d.name AS device_name,
    length(trim(COALESCE(s.raw_data ->> 'plannedDate', ''))) > 10 AS has_time
"""
SCHEDULED_JOINS = """
    FROM scheduled_tasks s
    LEFT JOIN maintenance_tasks m ON m.mysim_id = s.maintenance_task_id
    LEFT JOIN task_frequencies f ON f.mysim_id = m.frequency_id
    LEFT JOIN devices d ON d.mysim_id = m.device_id
"""


def madrid_time(value: datetime) -> datetime:
    return value.replace(tzinfo=MADRID) if value.tzinfo is None else value.astimezone(MADRID)


def documented_window(row):
    return get_documented_window(
        planned_date=madrid_time(row["planned_date"]),
        device_id=row["device_id"],
        manual_version=row["preventive_manual_version"],
        frequency=row["frequency"],
        has_planned_time=row["has_time"],
    )


async def execution_snapshot(db: AsyncSession, task, source_id: str) -> dict:
    snapshot = {
        "device_id": task["mysim_device_id"],
        "device_name": task["device_name"],
        "estimate_minutes": task["estimated_duration_minutes"],
        "assigned_id": str(task["responsible_user_id"]) if task["responsible_user_id"] else None,
        "assigned_name": task["assigned_name"],
        "target_day": task["target_day"].isoformat() if task["target_day"] else None,
    }
    if not source_id.isascii() or not source_id.isdecimal() or len(source_id) > 18:
        return snapshot
    scheduled = (await db.execute(text(f"""
        SELECT {SCHEDULED_FIELDS}
        {SCHEDULED_JOINS}
        WHERE s.mysim_id = :id
    """), {"id": int(source_id)})).mappings().first()
    if scheduled is None:
        return snapshot
    start, end = documented_window(scheduled)
    snapshot.update(
        task_key=str(scheduled["maintenance_task_id"]),
        task_code=scheduled["task_code"],
        target_day=snapshot["target_day"] or scheduled["planned_date"].date().isoformat(),
        window_start=start.isoformat() if start else None,
        window_end=end.isoformat() if end else None,
    )
    return snapshot
