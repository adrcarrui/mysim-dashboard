from collections import defaultdict
from datetime import date, datetime, time, timedelta
from statistics import median

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.briefing_kpi_source import MADRID, SCHEDULED_FIELDS, SCHEDULED_JOINS, documented_window, madrid_time


def summarize(rows: list[dict]) -> dict:
    measured = [row for row in rows if row["active_seconds"] is not None]
    paired = [row for row in measured if row["estimate_minutes"] is not None]
    known = [row for row in rows if row["within_tolerance"] is not None]
    return {
        "closed": len(rows), "measured": len(measured), "paired": len(paired),
        "effective_minutes": sum(row["active_seconds"] for row in measured) / 60,
        "paired_actual_minutes": sum(row["active_seconds"] for row in paired) / 60,
        "paired_estimate_minutes": sum(row["estimate_minutes"] for row in paired),
        "median_actual_minutes": median(row["active_seconds"] / 60 for row in paired) if paired else None,
        "median_delta_minutes": median(row["active_seconds"] / 60 - row["estimate_minutes"] for row in paired) if paired else None,
        "median_estimate_minutes": median(row["estimate_minutes"] for row in paired) if paired else None,
        "known_window": len(known), "on_time": sum(row["within_tolerance"] for row in known),
        "attributed": sum(bool(row["performers"]) for row in rows),
    }


def occupied_seconds(intervals) -> float:
    total = 0.0
    end = None
    for start, stop in sorted(intervals):
        effective_start = max(start, end) if end is not None else start
        if stop > effective_start:
            total += (stop - effective_start).total_seconds()
            end = stop
    return total


def bucket(day: date, period: str) -> date:
    return day.replace(day=1) if period == "month" else day - timedelta(days=day.weekday())


def normalize_execution(row) -> dict:
    snapshot = row["metrics_snapshot"] or {}
    title = row["title"]
    device_id = snapshot.get("device_id") or row["mysim_device_id"]
    device = str(device_id) if device_id is not None else "unknown"
    code = snapshot.get("task_code") or row["task_code"] or title.split(" · ", 1)[0]
    task = snapshot.get("task_key") or row["task_key"] or f"{device}:{code}"
    completed = row["completed_at"]
    start, end = snapshot.get("window_start"), snapshot.get("window_end")
    known = start is not None and end is not None
    return {
        "briefing_id": row["briefing_id"], "source_id": row["source_id"], "title": title,
        "device": device, "device_name": snapshot.get("device_name") or row["device_name"] or device,
        "task": task, "task_code": code, "shift": row["shift_code"],
        "target_day": snapshot.get("target_day") or row["target_day"],
        "assigned_id": snapshot.get("assigned_id") if snapshot else row["responsible_user_id"],
        "assigned_name": snapshot.get("assigned_name") if snapshot else row["assigned_name"],
        "performers": row["performers"], "estimate_minutes": snapshot.get("estimate_minutes", row["estimated_duration_minutes"]),
        "started_at": row["started_at"], "completed_at": completed, "active_seconds": row["active_seconds"],
        "intervals_complete": row["intervals_complete"],
        "within_tolerance": datetime.fromisoformat(start) <= completed <= datetime.fromisoformat(end) if known else None,
        "window_start": start, "window_end": end,
    }


def matches(device, task, expected_device, expected_task) -> bool:
    return (expected_device is None or device == expected_device) and (expected_task is None or task == expected_task)


async def report(db: AsyncSession, start: date, end: date, period: str, shift, device, task, employee) -> dict:
    lower = datetime.combine(start, time.min, MADRID)
    upper = datetime.combine(end + timedelta(days=1), time.min, MADRID)
    bounds = {"lower": lower, "upper": upper}
    result = await db.execute(text("""
        SELECT e.briefing_id, e.source_id, e.started_at, e.completed_at, e.performers, e.intervals_complete,
               CAST(EXTRACT(EPOCH FROM e.active_duration) AS double precision) AS active_seconds,
               e.metrics_snapshot, b.shift_code, i.title, i.device_name, i.mysim_device_id,
               i.responsible_user_id, i.target_day, i.estimated_duration_minutes, p.display_name AS assigned_name,
               CAST(s.maintenance_task_id AS text) AS task_key, m.task_id AS task_code
        FROM maintenance_briefing_task_execution e
        JOIN maintenance_briefings b ON b.id = e.briefing_id
        JOIN maintenance_briefing_items i ON i.briefing_id = e.briefing_id
           AND i.source_type = 'task' AND i.source_id = e.source_id
        LEFT JOIN maintenance_briefing_participants p
          ON p.briefing_id = i.briefing_id AND p.amh_user_id = i.responsible_user_id
        LEFT JOIN scheduled_tasks s ON s.mysim_id = CASE WHEN e.source_id ~ '^[0-9]{1,18}$' THEN CAST(e.source_id AS bigint) END
        LEFT JOIN maintenance_tasks m ON m.mysim_id = s.maintenance_task_id
        WHERE e.completed_at >= :lower AND e.completed_at < :upper
          AND NOT EXISTS (
            SELECT 1 FROM maintenance_briefing_task_execution earlier
            WHERE earlier.source_id = e.source_id AND earlier.completed_at IS NOT NULL
              AND (earlier.completed_at, earlier.briefing_id) < (e.completed_at, e.briefing_id)
          )
        ORDER BY e.completed_at DESC, e.briefing_id, e.source_id
    """), bounds)
    all_rows = [normalize_execution(row) for row in result.mappings()]
    rows = [row for row in all_rows if matches(row["device"], row["task"], device, task) and (not shift or row["shift"] == shift)]
    person_rows = defaultdict(list)
    people = {}
    for row in all_rows:
        for person in row["performers"]:
            people.setdefault(person["id"], person["name"])
    for row in rows:
        for person in row["performers"]:
            person_rows[person["id"]].append(row)
    people_report = [{"id": person, "name": people[person], **summarize(items)} for person, items in person_rows.items()]
    if employee:
        rows = person_rows[employee]

    tasks = defaultdict(list)
    trend = defaultdict(list)
    shifts = {}
    for row in rows:
        tasks[(row["device"], row["task"])].append(row)
        trend[bucket(madrid_time(row["completed_at"]).date(), period)].append(row)
        slot = shifts.setdefault(row["shift"], {"closed": 0, "effective_minutes": 0, "occupied_minutes": 0, "with_intervals": 0})
        slot["closed"] += 1
        slot["effective_minutes"] += (row["active_seconds"] or 0) / 60

    eligible = {(row["briefing_id"], row["source_id"]): row for row in rows
                if row["intervals_complete"] and len(row["performers"]) == 1}
    occupied = defaultdict(list)
    if eligible:
        result = await db.execute(text("""
            SELECT t.briefing_id, t.source_id, t.started_at, t.ended_at
            FROM maintenance_briefing_task_interval t
            JOIN maintenance_briefing_task_execution e USING (briefing_id, source_id)
            WHERE e.completed_at >= :lower AND e.completed_at < :upper AND t.ended_at IS NOT NULL
        """), bounds)
        for interval in result.mappings():
            row = eligible.get((interval["briefing_id"], interval["source_id"]))
            if row:
                occupied[(row["shift"], row["performers"][0]["id"])].append((interval["started_at"], interval["ended_at"]))
        for row in eligible.values():
            shifts[row["shift"]]["with_intervals"] += 1
        for (shift_code, _), intervals in occupied.items():
            shifts[shift_code]["occupied_minutes"] += occupied_seconds(intervals) / 60

    planned_result = await db.execute(text("""
        SELECT b.shift_code, i.mysim_device_id, CAST(s.maintenance_task_id AS text) AS task_key,
               i.title, i.responsible_user_id, i.estimated_duration_minutes
        FROM maintenance_briefing_items i
        JOIN maintenance_briefings b ON b.id = i.briefing_id
        LEFT JOIN scheduled_tasks s ON s.mysim_id = CASE WHEN i.source_id ~ '^[0-9]{1,18}$' THEN CAST(i.source_id AS bigint) END
        WHERE i.source_type = 'task' AND b.briefing_date BETWEEN :start AND :end
    """), {"start": start, "end": end})
    planned_shifts = defaultdict(lambda: {"planned": 0, "planned_measured": 0, "planned_minutes": 0})
    for item in planned_result.mappings():
        device_key = str(item["mysim_device_id"]) if item["mysim_device_id"] is not None else "unknown"
        task_key = item["task_key"] or f'{device_key}:{item["title"].split(" · ", 1)[0]}'
        if not matches(device_key, task_key, device, task) or (shift and shift != item["shift_code"]):
            continue
        if employee and str(item["responsible_user_id"]) != employee:
            continue
        target = planned_shifts[item["shift_code"]]
        target["planned"] += 1
        if item["estimated_duration_minutes"] is not None:
            target["planned_minutes"] += item["estimated_duration_minutes"]
            target["planned_measured"] += 1

    snapshots = await db.execute(text("""
        SELECT snapshot_day, tasks FROM maintenance_backlog_snapshot
        WHERE snapshot_day BETWEEN :start AND :end ORDER BY snapshot_day
    """), {"start": start, "end": end})
    backlog = {}
    devices = {row["device"]: row["device_name"] for row in all_rows}
    task_options = {row["task"]: row["task_code"] for row in all_rows}
    for snapshot in snapshots.mappings():
        pending = overdue = 0
        for item in snapshot["tasks"]:
            device_key = str(item["device_id"]) if item["device_id"] is not None else "unknown"
            devices.setdefault(device_key, item["device_name"] or device_key)
            task_options.setdefault(item["task_key"], item["task_code"] or item["task_key"])
            if matches(device_key, item["task_key"], device, task):
                if item["category"] == "overdue":
                    overdue += item["count"]
                else:
                    pending += item["count"]
        day = snapshot["snapshot_day"]
        backlog[bucket(day, period)] = {"day": day, "pending": pending, "overdue": overdue}

    scheduled_result = await db.execute(text(f"""
        SELECT {SCHEDULED_FIELDS}
        {SCHEDULED_JOINS}
        WHERE s.planned_date >= :lower AND s.planned_date < :upper
          AND s.is_present_in_mysim AND s.enabled IS DISTINCT FROM false AND s.deleted IS DISTINCT FROM true
          AND s.status_id IN (199, 200, 201, 2542)
    """), {"lower": lower.replace(tzinfo=None), "upper": upper.replace(tzinfo=None)})
    cohort = {"closed_on_time": 0, "closed_outside": 0, "pending_overdue": 0, "pending_open": 0, "unknown": 0}
    now = datetime.now(MADRID)
    for scheduled in scheduled_result.mappings():
        device_key = str(scheduled["device_id"]) if scheduled["device_id"] is not None else "unknown"
        task_key = str(scheduled["maintenance_task_id"])
        devices.setdefault(device_key, scheduled["device_name"] or device_key)
        task_options.setdefault(task_key, scheduled["task_code"] or task_key)
        if not matches(device_key, task_key, device, task):
            continue
        window_start, window_end = documented_window(scheduled)
        if window_start is None or window_end is None:
            cohort["unknown"] += 1
        elif scheduled["status_id"] == 201:
            completed = scheduled["done_at"]
            if completed is None:
                cohort["unknown"] += 1
            elif window_start <= madrid_time(completed) <= window_end:
                cohort["closed_on_time"] += 1
            else:
                cohort["closed_outside"] += 1
        elif window_end < now:
            cohort["pending_overdue"] += 1
        else:
            cohort["pending_open"] += 1

    return {
        "summary": summarize(rows),
        "trend": [{"period": day, **summarize(items)} for day, items in sorted(trend.items())],
        "tasks": [{"device": d, "device_name": items[0]["device_name"], "task": t, "task_code": items[0]["task_code"], "title": items[0]["title"],
                   **summarize(items)} for (d, t), items in sorted(tasks.items(), key=lambda group: -len(group[1]))],
        "employees": sorted(people_report, key=lambda person: person["name"].casefold()),
        "shifts": [{"shift": code, **planned_shifts[code], **shifts.get(code, {"closed": 0, "effective_minutes": 0, "occupied_minutes": 0, "with_intervals": 0})}
                   for code in ("morning", "afternoon", "night") if code in shifts or code in planned_shifts],
        "backlog": list(backlog.values()), "mysim": cohort,
        "devices": devices, "task_options": task_options, "employee_options": people,
        "executions": rows,
    }
