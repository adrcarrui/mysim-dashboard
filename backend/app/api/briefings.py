import httpx

from app.config import settings
from datetime import date
from typing import Literal, Self
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, model_validator
from sqlalchemy import column, select, table, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_guard import require_mysim_session
from app.database import get_db
from app.services.maintenance_kpis import report
from app.services.briefing_task_execution import (
    Action,
    change_task_execution,
    read_task_executions,
)

router = APIRouter(prefix="/api/briefings", tags=["briefings"])


class BriefingItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_type: Literal["job", "dr", "action", "task", "manual"]
    source_id: str | None = Field(default=None, max_length=300)
    title: str = Field(min_length=1, max_length=2000)
    mysim_device_id: int | None = None
    device_name: str | None = Field(default=None, max_length=300)
    responsible_user_id: UUID | None = None
    estimated_duration_minutes: int | None = Field(default=None, strict=True, ge=1, le=10080)
    duration_reference: str = Field(default="", max_length=500)
    planned_start: AwareDatetime | None = None
    is_critical: bool = False
    discussion_notes: str = Field(default="", max_length=20000)
    agreed_action: str = Field(default="", max_length=20000)

    @model_validator(mode="after")
    def validate_source(self) -> Self:
        if self.planned_start is not None and self.estimated_duration_minutes is None:
            raise ValueError("Indica la duración estimada para programar el trabajo")
        if not self.title.strip():
            raise ValueError("El título no puede estar vacío")
        if self.source_type == "manual":
            if self.source_id is not None:
                raise ValueError("Un punto manual no debe tener identificador de mySim")
        elif not (self.source_id or "").strip():
            raise ValueError("Falta el identificador del trabajo de mySim")
        return self


class BriefingDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    briefing_date: date
    shift_code: Literal["morning", "afternoon", "night"]
    mobile_holder_user_id: UUID | None = None
    participant_ids: list[UUID] | None = Field(default=None, max_length=500)
    items: list[BriefingItem] | None = Field(default=None, max_length=1000)
    shift_start: AwareDatetime | None = None
    shift_end: AwareDatetime | None = None
    received_notes: str = Field(default="", max_length=20000)
    general_notices: str = Field(default="", max_length=20000)
    agreements: str = Field(default="", max_length=20000)
    handover_notes: str = Field(default="", max_length=20000)


    @model_validator(mode="after")
    def validate_window(self) -> Self:
        if (
            self.shift_start is not None
            and self.shift_end is not None
            and self.shift_end <= self.shift_start
        ):
            raise ValueError("El fin del turno debe ser posterior al inicio")
        return self



class BriefingDraftUpdate(BriefingDraft):
    expected_revision: int = Field(ge=1)


class CalendarTaskCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str = Field(min_length=1, max_length=300)
    title: str = Field(min_length=1, max_length=2000)
    device_name: str | None = Field(default=None, max_length=300)
    mysim_device_id: int | None = None
    estimated_duration_minutes: int | None = Field(default=None, strict=True, ge=1, le=10080)
    duration_reference: str = Field(default="", max_length=500)
    target_day: date | None = None
    responsible_user_id: UUID | None = None


class TaskExecutionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_id: str = Field(min_length=1, max_length=300)
    expected_version: int = Field(ge=0, strict=True)
    action: Action
    performer_ids: list[UUID] | None = Field(default=None, max_length=30)

    @model_validator(mode="after")
    def validate_performers(self) -> Self:
        if self.performer_ids is not None and (
            self.action != "complete" or len(set(self.performer_ids)) != len(self.performer_ids)
        ):
            raise ValueError("Lista de ejecutores no válida")
        return self


async def require_briefing_editor(
    session: dict = Depends(require_mysim_session),
) -> dict:
    if session.get("role") not in {"editor", "admin"}:
        raise HTTPException(403, "Se requiere el rol editor o admin")
    return session


def _actor_id(session: dict) -> UUID:
    try:
        return UUID(str(session["user_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(503, "AMH no identifico al usuario") from exc


async def _read_briefing(db: AsyncSession, briefing_id: int) -> dict:
    result = await db.execute(
        text("SELECT * FROM maintenance_briefings WHERE id = :id"),
        {"id": briefing_id},
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(404, "Briefing no encontrado")

    briefing = dict(row)
    participants = await db.execute(
        text("""
            SELECT amh_user_id, display_name
            FROM maintenance_briefing_participants
            WHERE briefing_id = :id
            ORDER BY display_name, amh_user_id
        """),
        {"id": briefing_id},
    )
    briefing["participants"] = [dict(r) for r in participants.mappings().all()]
    briefing["participant_ids"] = [row["amh_user_id"] for row in briefing["participants"]]
    items = await db.execute(
        text("""
            SELECT * FROM maintenance_briefing_items
            WHERE briefing_id = :id
            ORDER BY sort_order, id
        """),
        {"id": briefing_id},
    )
    executions = await read_task_executions(db, briefing_id)
    briefing["items"] = [
        {**row, "execution": executions.get(row["source_id"])} if row["source_type"] == "task" else dict(row)
        for row in items.mappings()
    ]
    return briefing


@router.get("")
async def list_briefings(
    response: Response,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    from_date: date | None = None,
    to_date: date | None = None,
    session: dict = Depends(require_mysim_session),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    if from_date is not None and to_date is not None and from_date > to_date:
        raise HTTPException(422, "La fecha inicial debe ser anterior o igual a la final")
    filters = []
    parameters: dict = {"limit": limit, "offset": offset}
    if from_date is not None:
        filters.append("briefing_date >= :from_date")
        parameters["from_date"] = from_date
    if to_date is not None:
        filters.append("briefing_date <= :to_date")
        parameters["to_date"] = to_date
    where = " WHERE " + " AND ".join(filters) if filters else ""
    total = await db.scalar(text("SELECT COUNT(*) FROM maintenance_briefings" + where), parameters)
    result = await db.execute(
        text("""
            SELECT id, briefing_date, shift_code, shift_start, shift_end, mobile_holder_user_id,
                   facilitator_user_id, status, revision, updated_at
            FROM maintenance_briefings
        """ + where + """
            ORDER BY briefing_date DESC, id DESC
            LIMIT :limit OFFSET :offset
        """),
        parameters,
    )
    return {
        "total": total or 0,
        "limit": limit,
        "offset": offset,
        "items": [dict(row) for row in result.mappings().all()],
    }


class BriefingMemberIdentity(BaseModel):
    amh_user_id: UUID
    display_name: str = Field(min_length=1, max_length=300)
    is_blocked: StrictBool


class BriefingNamesResponse(BaseModel):
    users: list[BriefingMemberIdentity] = Field(max_length=500)


async def _load_team_members(request: Request, db: AsyncSession) -> list[dict]:
    ids = (await db.scalars(text("""
        SELECT amh_user_id
        FROM maintenance_team_members
        WHERE active = TRUE
        ORDER BY amh_user_id
    """))).all()
    if not ids:
        return []
    if len(ids) > 500:
        raise HTTPException(503, "El equipo supera el límite de 500 miembros")
    if not settings.amh_api_url:
        raise HTTPException(503, "AMH no está configurado")
    expected_ids = {str(user_id) for user_id in ids}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
            result = await client.post(
                f"{settings.amh_api_url.rstrip('/')}"
                "/api/v1/integrations/mysim-dashboard/briefing-users",
                headers={
                    "Authorization": f"Bearer {request.cookies.get('mysim_session')}",
                },
                json={"user_ids": sorted(expected_ids)},
            )
    except httpx.RequestError as exc:
        raise HTTPException(503, "No se pudieron consultar los nombres en AMH") from exc
    if result.status_code in {401, 403}:
        raise HTTPException(result.status_code, "AMH no autorizó la consulta de nombres")
    if result.status_code == 404:
        raise HTTPException(503, "Falta la ruta briefing-users en AMH; actualiza y reinicia AMH")
    if result.status_code != 200:
        raise HTTPException(503, "AMH no pudo devolver los nombres del equipo")
    try:
        data = BriefingNamesResponse.model_validate(result.json())
        returned_ids = [str(user.amh_user_id) for user in data.users]
        if len(returned_ids) != len(set(returned_ids)) or not set(returned_ids).issubset(expected_ids):
            raise ValueError("Identificadores inesperados")
    except ValueError as exc:
        raise HTTPException(503, "AMH devolvió una lista de nombres no válida") from exc
    return sorted(
        [
            {"amh_user_id": str(user.amh_user_id), "display_name": user.display_name}
            for user in data.users if not user.is_blocked
        ],
        key=lambda user: (user["display_name"].casefold(), user["amh_user_id"]),
    )


async def _validate_people(
    data: BriefingDraft,
    request: Request,
    db: AsyncSession,
    briefing_id: int | None = None,
) -> dict[str, str]:
    if data.participant_ids is not None and len(data.participant_ids) != len(set(data.participant_ids)):
        raise HTTPException(422, "Hay participantes duplicados")
    assigned_ids: set[UUID] = set()
    # Validate effective assignments even when an older client omits a field.
    if data.participant_ids is not None or data.items is not None:
        if data.participant_ids is not None:
            participant_ids = set(data.participant_ids)
        elif briefing_id is not None:
            participant_ids = {
                UUID(str(uid)) for uid in (await db.scalars(text("""
                    SELECT amh_user_id FROM maintenance_briefing_participants
                    WHERE briefing_id = :id
                """), {"id": briefing_id})).all()
            }
        else:
            participant_ids = set()
        if data.items is not None:
            assigned_ids = {item.responsible_user_id for item in data.items if item.responsible_user_id}
            keys = [(item.source_type, item.source_id) for item in data.items if item.source_type != "manual"]
            if len(keys) != len(set(keys)):
                raise HTTPException(422, "Hay trabajos duplicados en el briefing")
        elif briefing_id is not None:
            assigned_ids = {
                UUID(str(uid)) for uid in (await db.scalars(text("""
                    SELECT responsible_user_id FROM maintenance_briefing_items
                    WHERE briefing_id = :id AND responsible_user_id IS NOT NULL
                """), {"id": briefing_id})).all()
            }
        else:
            assigned_ids = set()
        if not assigned_ids.issubset(participant_ids):
            raise HTTPException(422, "Cada responsable debe ser un participante del turno")
    needs_directory = data.mobile_holder_user_id is not None or bool(data.participant_ids) or bool(assigned_ids)
    if not needs_directory:
        return {}
    members = await _load_team_members(request, db)
    names = {str(member["amh_user_id"]): member["display_name"] for member in members}
    if data.mobile_holder_user_id is not None and str(data.mobile_holder_user_id) not in names:
        raise HTTPException(
            status_code=422,
            detail="El responsable del móvil no pertenece al equipo activo de mantenimiento",
        )
    if data.participant_ids is not None and not {
        str(user_id) for user_id in data.participant_ids
    }.issubset(names):
        raise HTTPException(
            status_code=422,
            detail="Algún participante ya no está disponible en el equipo activo de mantenimiento",
        )
    if not {str(user_id) for user_id in assigned_ids}.issubset(names):
        raise HTTPException(422, "Algún responsable ya no está disponible en el equipo activo")
    return names


async def _save_participants(
    db: AsyncSession,
    briefing_id: int,
    participant_ids: list[UUID] | None,
    names: dict[str, str],
) -> None:
    # Omitted field preserves participants for clients that do not send it yet.
    # [] explicitly clears the selection. Parent and children share a transaction.
    if participant_ids is None:
        return
    await db.execute(
        text("DELETE FROM maintenance_briefing_participants WHERE briefing_id = :id"),
        {"id": briefing_id},
    )
    for user_id in participant_ids:
        await db.execute(text("""
            INSERT INTO maintenance_briefing_participants
                (briefing_id, amh_user_id, display_name)
            VALUES (:briefing_id, :user_id, :display_name)
        """), {
            "briefing_id": briefing_id,
            "user_id": user_id,
            "display_name": names[str(user_id)],
        })


async def _save_items(db: AsyncSession, briefing_id: int, items: list[BriefingItem] | None) -> None:
    if items is None:
        return
    executions = await read_task_executions(db, briefing_id)
    retained_tasks = {item.source_id for item in items if item.source_type == "task"}
    if executions.keys() - retained_tasks:
        raise HTTPException(409, "Hay tareas con ejecución registrada. Vuelve a incluirlas antes de guardar.")
    saved_targets = (await db.execute(text("""
        SELECT source_id, target_day FROM maintenance_briefing_items
        WHERE briefing_id = :id AND source_type = 'task' AND target_day IS NOT NULL
    """), {"id": briefing_id})).all()
    targets = dict(saved_targets)
    await db.execute(
        text("DELETE FROM maintenance_briefing_items WHERE briefing_id = :id"),
        {"id": briefing_id},
    )
    for order, item in enumerate(items):
        await db.execute(text("""
            INSERT INTO maintenance_briefing_items (
                briefing_id, source_type, source_id, title, mysim_device_id,
                device_name, sort_order, responsible_user_id, is_critical,
                discussion_notes, agreed_action, estimated_duration_minutes,
                duration_reference, planned_start, target_day
            ) VALUES (
                :briefing_id, :source_type, :source_id, :title, :mysim_device_id,
                :device_name, :sort_order, :responsible_user_id, :is_critical,
                :discussion_notes, :agreed_action, :estimated_duration_minutes,
                :duration_reference, :planned_start, :target_day
            )
        """), {**item.model_dump(), "briefing_id": briefing_id, "sort_order": order,
               "target_day": targets.get(item.source_id) if item.source_type == "task" else None})


# Static routes must be registered before /{briefing_id}.
@router.get("/team-members")
async def briefing_team_members(
    request: Request,
    response: Response,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return {"members": await _load_team_members(request, db)}


@router.get("/metrics")
async def maintenance_metrics(
    response: Response,
    start: date,
    end: date,
    period: Literal["week", "month"] = "week",
    shift: Literal["morning", "afternoon", "night"] | None = None,
    device: str | None = Query(default=None, max_length=300),
    task: str | None = Query(default=None, max_length=300),
    employee: UUID | None = None,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    if not 0 <= (end - start).days <= 365 or end == date.max:
        raise HTTPException(422, "Selecciona un periodo de hasta 366 días")
    return await report(db, start, end, period, shift, device, task, str(employee) if employee else None)


@router.get("/{briefing_id}")
async def get_briefing(
    briefing_id: int,
    response: Response,
    session: dict = Depends(require_mysim_session),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    return await _read_briefing(db, briefing_id)


@router.put("/{briefing_id}/calendar-task")
async def save_calendar_task(
    briefing_id: int,
    data: CalendarTaskCommand,
    response: Response,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    parameters = {**data.model_dump(), "briefing_id": briefing_id}
    parent = (await db.execute(text("""
        SELECT status, revision FROM maintenance_briefings WHERE id = :briefing_id FOR UPDATE
    """), parameters)).mappings().first()
    if parent is None:
        raise HTTPException(404, "Briefing no encontrado")

    existing = (await db.execute(text("""
        SELECT * FROM maintenance_briefing_items
        WHERE briefing_id = :briefing_id AND source_type = 'task' AND source_id = :source_id
    """), parameters)).mappings().first()
    assign = "responsible_user_id" in data.model_fields_set
    assignment_changed = assign and (
        existing is None or existing["responsible_user_id"] != data.responsible_user_id
    )
    if parent["status"] != "draft" and (existing is None or assignment_changed):
        raise HTTPException(409, "Selecciona un briefing en borrador para añadir o asignar tareas")
    if assignment_changed and data.responsible_user_id is not None:
        participant = await db.scalar(text("""
            SELECT 1 FROM maintenance_briefing_participants
            WHERE briefing_id = :briefing_id AND amh_user_id = :responsible_user_id
        """), parameters)
        if participant is None:
            raise HTTPException(422, "El responsable debe ser un participante del turno")

    changed = existing is None or assignment_changed or (
        data.target_day is not None and data.target_day != existing["target_day"]
    )
    item = existing
    revision = parent["revision"]
    if existing is None:
        item = (await db.execute(text("""
            INSERT INTO maintenance_briefing_items (
                briefing_id, source_type, source_id, title, mysim_device_id,
                device_name, sort_order, responsible_user_id, is_critical, discussion_notes,
                agreed_action, estimated_duration_minutes, duration_reference, target_day
            ) SELECT
                :briefing_id, 'task', :source_id, :title, :mysim_device_id,
                :device_name, COALESCE(MAX(sort_order) + 1, 0), :responsible_user_id,
                FALSE, '', '', :estimated_duration_minutes, :duration_reference, :target_day
            FROM maintenance_briefing_items WHERE briefing_id = :briefing_id
            RETURNING *
        """), parameters)).mappings().one()
    elif changed:
        item = (await db.execute(text("""
            UPDATE maintenance_briefing_items
            SET responsible_user_id = :responsible_user_id,
                target_day = COALESCE(:target_day, target_day)
            WHERE id = :item_id RETURNING *
        """), {**parameters, "item_id": existing["id"], "responsible_user_id":
                data.responsible_user_id if assign else existing["responsible_user_id"]})).mappings().one()

    if changed:
        revision = await db.scalar(text("""
            UPDATE maintenance_briefings
            SET revision = revision + 1, updated_at = NOW(), updated_by = :actor_id
            WHERE id = :briefing_id RETURNING revision
        """), {**parameters, "actor_id": _actor_id(session)})

    execution = (await read_task_executions(db, briefing_id)).get(data.source_id)
    await db.commit()
    return {"item": {**item, "execution": execution}, "revision": revision}


@router.post("/{briefing_id}/task-execution")
async def record_task_execution(
    briefing_id: int,
    data: TaskExecutionCommand,
    response: Response,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    execution = await change_task_execution(
        db,
        briefing_id=briefing_id,
        source_id=data.source_id,
        expected_version=data.expected_version,
        action=data.action,
        actor_id=_actor_id(session),
        performer_ids=data.performer_ids,
    )
    await db.commit()
    return execution


@router.post("", status_code=201)
async def create_briefing(
    data: BriefingDraft,
    request: Request,
    response: Response,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    names = await _validate_people(data, request, db)
    parameters = data.model_dump()
    parameters["actor_id"] = _actor_id(session)

    result = await db.execute(
        text("""
            INSERT INTO maintenance_briefings (
                briefing_date, shift_code, shift_start, shift_end, mobile_holder_user_id,
                facilitator_user_id, received_notes, general_notices,
                agreements, handover_notes, created_by, updated_by
            ) VALUES (
                :briefing_date, :shift_code, :shift_start, :shift_end, :mobile_holder_user_id,
                :actor_id, :received_notes, :general_notices,
                :agreements, :handover_notes, :actor_id, :actor_id
            )
            RETURNING id
        """),
        parameters,
    )
    briefing_id = result.scalar_one()
    await _save_participants(db, briefing_id, data.participant_ids, names)
    await _save_items(db, briefing_id, data.items)
    briefing = await _read_briefing(db, briefing_id)
    await db.commit()
    return briefing


@router.put("/{briefing_id}")
async def update_briefing(
    briefing_id: int,
    data: BriefingDraftUpdate,
    request: Request,
    response: Response,
    session: dict = Depends(require_briefing_editor),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    header = table("maintenance_briefings", column("id"), column("status"), column("revision"))
    locked = (await db.execute(
        select(header.c.status, header.c.revision)
        .where(header.c.id == briefing_id)
        .with_for_update()
    )).mappings().first()
    if locked is None:
        raise HTTPException(404, "Briefing no encontrado")
    if locked["status"] != "draft" or locked["revision"] != data.expected_revision:
        raise HTTPException(409, "El briefing ha cambiado o ya está finalizado. Actualiza antes de guardar")
    names = await _validate_people(data, request, db, briefing_id)
    parameters = data.model_dump()
    parameters.update({"id": briefing_id, "actor_id": _actor_id(session)})

    result = await db.execute(
        text("""
            UPDATE maintenance_briefings
            SET briefing_date = :briefing_date,
                shift_code = :shift_code,
                shift_start = :shift_start,
                shift_end = :shift_end,
                mobile_holder_user_id = :mobile_holder_user_id,
                received_notes = :received_notes,
                general_notices = :general_notices,
                agreements = :agreements,
                handover_notes = :handover_notes,
                revision = revision + 1,
                updated_by = :actor_id,
                updated_at = NOW()
            WHERE id = :id
              AND status = 'draft'
              AND revision = :expected_revision
            RETURNING id
        """),
        parameters,
    )
    if result.scalar_one_or_none() is None:
        await db.rollback()
        exists = await db.scalar(
            text("SELECT id FROM maintenance_briefings WHERE id = :id"),
            {"id": briefing_id},
        )
        if exists is None:
            raise HTTPException(404, "Briefing no encontrado")
        raise HTTPException(
            409,
            "El briefing ha cambiado o ya esta finalizado. Actualiza antes de guardar",
        )
    await _save_participants(db, briefing_id, data.participant_ids, names)
    await _save_items(db, briefing_id, data.items)
    briefing = await _read_briefing(db, briefing_id)
    await db.commit()
    return briefing
