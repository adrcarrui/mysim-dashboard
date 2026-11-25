import json
from collections import Counter
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.briefing_kpi_source import MADRID, SCHEDULED_FIELDS, SCHEDULED_JOINS, documented_window


async def capture_backlog(db: AsyncSession) -> None:
    now = datetime.now(MADRID)
    candidates = await db.execute(text(f"""
        SELECT {SCHEDULED_FIELDS}
        {SCHEDULED_JOINS}
        WHERE s.is_present_in_mysim AND s.enabled IS DISTINCT FROM FALSE
          AND s.deleted IS DISTINCT FROM TRUE AND s.status_id IN (199, 200, 2542)
          AND s.planned_date < :now
          AND NOT EXISTS (
            SELECT 1 FROM maintenance_briefing_task_execution e
            WHERE e.source_id = CAST(s.mysim_id AS text) AND e.completed_at IS NOT NULL
          )
    """), {"now": now.replace(tzinfo=None)})
    counts = Counter()
    for row in candidates.mappings():
        _, end = documented_window(row)
        if end is not None and end < now:
            category = "overdue"
        elif row["planned_date"].date() < now.date() or (row["frequency"] or "").lower() == "daily":
            category = "pending"
        else:
            continue
        counts[(row["device_id"], row["device_name"], str(row["maintenance_task_id"]), row["task_code"], category)] += 1

    tasks = [{
        "device_id": device, "device_name": name, "task_key": key, "task_code": code,
        "category": category, "count": count,
    } for (device, name, key, code, category), count in counts.items()]
    await db.execute(text("""
        INSERT INTO maintenance_backlog_snapshot (snapshot_day, tasks)
        VALUES (:day, CAST(:tasks AS jsonb))
        ON CONFLICT (snapshot_day) DO UPDATE SET tasks = EXCLUDED.tasks, captured_at = clock_timestamp()
    """), {"day": now.date(), "tasks": json.dumps(tasks)})
    await db.commit()
