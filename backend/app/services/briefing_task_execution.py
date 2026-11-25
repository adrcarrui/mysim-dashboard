import json
from datetime import timedelta
from typing import Literal
from uuid import UUID

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.briefing_kpi_source import execution_snapshot

Action = Literal["start", "pause", "complete"]


def _public_execution(row: dict) -> dict:
    duration = row["active_duration"]
    return {
        **{key: row[key] for key in (
            "version", "started_at", "started_by", "running_since", "completed_at", "completed_by"
        )},
        "performers": row.get("performers", []),
        "active_seconds": duration.total_seconds() if duration is not None else None,
    }


async def read_task_executions(db: AsyncSession, briefing_id: int) -> dict[str, dict]:
    result = await db.execute(text("""
        SELECT * FROM maintenance_briefing_task_execution
        WHERE briefing_id = :briefing_id
    """), {"briefing_id": briefing_id})
    return {row["source_id"]: _public_execution(dict(row)) for row in result.mappings()}


async def change_task_execution(
    db: AsyncSession,
    *,
    briefing_id: int,
    source_id: str,
    expected_version: int,
    action: Action,
    actor_id: UUID,
    performer_ids: list[UUID] | None = None,
) -> dict:
    # Draft saves take this same lock before replacing briefing items.
    parent = await db.scalar(text("""
        SELECT id FROM maintenance_briefings WHERE id = :id FOR UPDATE
    """), {"id": briefing_id})
    if parent is None:
        raise HTTPException(404, "Briefing no encontrado")

    keys = {"briefing_id": briefing_id, "source_id": source_id}
    task = (await db.execute(text("""
        SELECT i.*, p.display_name AS assigned_name
        FROM maintenance_briefing_items i
        LEFT JOIN maintenance_briefing_participants p
          ON p.briefing_id = i.briefing_id AND p.amh_user_id = i.responsible_user_id
        WHERE i.briefing_id = :briefing_id AND i.source_type = 'task' AND i.source_id = :source_id
    """), keys)).mappings().first()
    if task is None:
        raise HTTPException(404, "La tarea no está incluida en este briefing")

    record = (await db.execute(text("""
        SELECT * FROM maintenance_briefing_task_execution
        WHERE briefing_id = :briefing_id AND source_id = :source_id
    """), keys)).mappings().first()
    current = dict(record) if record is not None else {
        "version": 0, "started_at": None, "started_by": None, "running_since": None,
        "completed_at": None, "completed_by": None, "active_duration": None,
        "performers": [], "intervals_complete": False, "metrics_snapshot": None,
    }
    running_since = current["running_since"]
    if (
        current["version"] != expected_version
        or current["completed_at"] is not None
        or (action == "start" and running_since is not None)
        or (action == "pause" and running_since is None)
    ):
        execution = _public_execution(current)
        raise HTTPException(409, jsonable_encoder({
            "message": "La ejecución ha cambiado. Se ha recuperado el estado guardado.",
            "execution": execution,
        }))

    now = await db.scalar(text("SELECT clock_timestamp()"))
    if current["started_at"] is not None:
        now = max(now, current["started_at"])
    if running_since is not None:
        now = max(now, running_since)

    if action == "start":
        if current["started_at"] is None:
            current.update(started_at=now, started_by=actor_id, active_duration=timedelta(), intervals_complete=True)
        current["running_since"] = now
    else:
        if running_since is not None:
            current["active_duration"] += now - running_since
            current["running_since"] = None
        if action == "complete":
            performers = []
            if performer_ids:
                people = (await db.execute(text("""
                    SELECT amh_user_id, display_name FROM maintenance_briefing_participants
                    WHERE briefing_id = :briefing_id AND amh_user_id = ANY(CAST(:ids AS uuid[]))
                """), {**keys, "ids": performer_ids})).mappings().all()
                if len(people) != len(performer_ids):
                    raise HTTPException(422, "Ejecutado por debe contener participantes del turno")
                performers = [{"id": str(person["amh_user_id"]), "name": person["display_name"]} for person in people]
            snapshot = await execution_snapshot(db, task, source_id)
            current.update(completed_at=now, completed_by=actor_id, performers=performers, metrics_snapshot=snapshot)
    current["version"] += 1

    await db.execute(text("""
        INSERT INTO maintenance_briefing_task_execution (
            briefing_id, source_id, version, started_at, started_by, running_since,
            completed_at, completed_by, active_duration, performers, intervals_complete, metrics_snapshot
        ) VALUES (
            :briefing_id, :source_id, :version, :started_at, :started_by, :running_since,
            :completed_at, :completed_by, :active_duration, CAST(:performers AS jsonb),
            :intervals_complete, CAST(:metrics_snapshot AS jsonb)
        )
        ON CONFLICT (briefing_id, source_id) DO UPDATE SET
            version = EXCLUDED.version,
            started_at = EXCLUDED.started_at,
            started_by = EXCLUDED.started_by,
            running_since = EXCLUDED.running_since,
            completed_at = EXCLUDED.completed_at,
            completed_by = EXCLUDED.completed_by,
            active_duration = EXCLUDED.active_duration,
            performers = EXCLUDED.performers,
            intervals_complete = EXCLUDED.intervals_complete,
            metrics_snapshot = EXCLUDED.metrics_snapshot
    """), {**keys, **current, "performers": json.dumps(current["performers"]),
           "metrics_snapshot": json.dumps(current["metrics_snapshot"]) if current["metrics_snapshot"] else None})

    if current["intervals_complete"]:
        if action == "start":
            await db.execute(text("""
                INSERT INTO maintenance_briefing_task_interval (briefing_id, source_id, started_at)
                VALUES (:briefing_id, :source_id, :time)
            """), {**keys, "time": now})
        elif running_since is not None:
            await db.execute(text("""
                UPDATE maintenance_briefing_task_interval SET ended_at = :time
                WHERE briefing_id = :briefing_id AND source_id = :source_id AND ended_at IS NULL
            """), {**keys, "time": now})
    return _public_execution(current)
