from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth_guard import require_mysim_admin
from app.config import settings
from app.database import get_db


router = APIRouter(
    prefix="/api/team",
    tags=["maintenance-team"],
)


class MembershipChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    active: bool
    confirmed: Literal[True]
    expected_revision: int = Field(ge=0)


async def _get_amh_users(
    request: Request,
    resource: str = "users",
) -> dict:
    if not settings.amh_api_url:
        raise HTTPException(
            status_code=503,
            detail="AMH no está configurado",
        )

    token = request.cookies.get("mysim_session")

    try:
        async with httpx.AsyncClient(
            timeout=70.0,
            follow_redirects=False,
        ) as client:
            response = await client.get(
                f"{settings.amh_api_url.rstrip('/')}"
                f"/api/v1/integrations/mysim-dashboard/{resource}",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudo conectar con AMH",
        ) from exc

    if response.status_code in {401, 403}:
        raise HTTPException(
            status_code=response.status_code,
            detail=(
                "AMH requiere una sesión válida "
                "de administrador del Dashboard"
            ),
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="AMH no pudo devolver la lista de usuarios",
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="AMH devolvió una respuesta no válida",
        ) from exc

    if (
        not isinstance(data, dict)
        or not isinstance(data.get("users"), list)
        or data.get("complete") is not True
        or not all(
            isinstance(user, dict)
            for user in data["users"]
        )
    ):
        raise HTTPException(
            status_code=503,
            detail=(
                "La lista de usuarios de AMH "
                "no es válida o está incompleta"
            ),
        )

    return data


@router.get("/candidates")
async def list_candidates(
    request: Request,
    response: Response,
    session: dict = Depends(require_mysim_admin),
):
    response.headers["Cache-Control"] = "no-store"
    return await _get_amh_users(request)


@router.get("")
async def list_memberships(
    response: Response,
    session: dict = Depends(require_mysim_admin),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    result = await db.execute(
        text("""
            SELECT
                amh_user_id,
                active,
                revision,
                created_at,
                updated_at,
                removed_at,
                created_by,
                updated_by
            FROM maintenance_team_members
            ORDER BY created_at, amh_user_id
        """)
    )

    return {
        "memberships": [
            dict(row)
            for row in result.mappings().all()
        ]
    }

@router.get("/aturnos-candidates")
async def list_pending_aturnos_candidates(
    request: Request,
    response: Response,
    session: dict = Depends(require_mysim_admin),
):
    response.headers["Cache-Control"] = "no-store"

    return await _get_amh_users(
        request,
        resource="aturnos-candidates",
    )

@router.get("/history")
async def list_membership_history(
    response: Response,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: dict = Depends(require_mysim_admin),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    total = await db.scalar(
        text("""
            SELECT COUNT(*)
            FROM maintenance_team_events
        """)
    )

    result = await db.execute(
        text("""
            SELECT
                id,
                amh_user_id,
                actor_user_id,
                action,
                membership_revision,
                occurred_at
            FROM maintenance_team_events
            ORDER BY occurred_at DESC, id DESC
            LIMIT :limit
            OFFSET :offset
        """),
        {
            "limit": limit,
            "offset": offset,
        },
    )

    return {
        "total": total or 0,
        "limit": limit,
        "offset": offset,
        "items": [
            dict(row)
            for row in result.mappings().all()
        ],
    }

@router.put("/{amh_user_id}")
async def change_membership(
    amh_user_id: UUID,
    data: MembershipChange,
    request: Request,
    response: Response,
    session: dict = Depends(require_mysim_admin),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    try:
        actor_id = UUID(str(session["user_id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=503,
            detail="AMH no identificó al administrador",
        ) from exc

    # Las incorporaciones y reincorporaciones requieren
    # comprobar el estado actual del usuario en AMH y aTurnos.
    if data.active:
        directory = await _get_amh_users(request)

        candidate = next(
            (
                user
                for user in directory["users"]
                if user.get("amh_user_id") == str(amh_user_id)
            ),
            None,
        )

        if candidate is None:
            raise HTTPException(
                status_code=409,
                detail="El usuario ya no aparece en AMH",
            )

        if candidate.get("is_blocked") is not False:
            raise HTTPException(
                status_code=409,
                detail=(
                    "El usuario está bloqueado "
                    "o su estado no se pudo validar"
                ),
            )

        if candidate.get("aturnos_present") is not True:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No se ha podido confirmar que el usuario "
                    "exista en el equipo configurado de aTurnos"
                ),
            )

        if candidate.get("aturnos_active") is not True:
            raise HTTPException(
                status_code=409,
                detail=(
                    "El usuario figura inactivo en aTurnos "
                    "o su estado requiere revisión"
                ),
            )

    parameters = {
        "user_id": amh_user_id,
        "actor_id": actor_id,
        "active": data.active,
        "expected_revision": data.expected_revision,
    }

    if data.expected_revision == 0:
        if not data.active:
            raise HTTPException(
                status_code=409,
                detail="El usuario todavía no pertenece al equipo",
            )

        result = await db.execute(
            text("""
                INSERT INTO maintenance_team_members (
                    amh_user_id,
                    active,
                    created_by,
                    updated_by
                )
                VALUES (
                    :user_id,
                    TRUE,
                    :actor_id,
                    :actor_id
                )
                ON CONFLICT (amh_user_id) DO NOTHING
                RETURNING
                    amh_user_id,
                    active,
                    revision,
                    updated_at
            """),
            parameters,
        )
    else:
        result = await db.execute(
            text("""
                UPDATE maintenance_team_members
                SET
                    active = :active,
                    revision = revision + 1,
                    updated_at = NOW(),
                    updated_by = :actor_id,
                    removed_at = CASE
                        WHEN :active THEN NULL
                        ELSE NOW()
                    END
                WHERE amh_user_id = :user_id
                  AND revision = :expected_revision
                  AND active <> :active
                RETURNING
                    amh_user_id,
                    active,
                    revision,
                    updated_at
            """),
            parameters,
        )

    member = result.mappings().first()

    if member is None:
        await db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "La lista ha cambiado o el usuario ya tiene "
                "el estado solicitado. Actualiza antes "
                "de confirmar de nuevo"
            ),
        )

    saved_member = dict(member)

    if data.expected_revision == 0:
        action = "added"
    elif data.active:
        action = "reincorporated"
    else:
        action = "removed"

    try:
        await db.execute(
            text("""
                INSERT INTO maintenance_team_events (
                    amh_user_id,
                    actor_user_id,
                    action,
                    membership_revision
                )
                VALUES (
                    :user_id,
                    :actor_id,
                    :action,
                    :revision
                )
            """),
            {
                "user_id": amh_user_id,
                "actor_id": actor_id,
                "action": action,
                "revision": saved_member["revision"],
            },
        )

        # La pertenencia y el historial se guardan juntos.
        await db.commit()

    except Exception:
        await db.rollback()
        raise

    return saved_member