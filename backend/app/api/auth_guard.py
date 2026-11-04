from urllib.parse import urlsplit

import httpx
from fastapi import Depends, HTTPException, Request

from app.config import settings


def _origin_from_url(url: str) -> str:
    parsed = urlsplit(url)
    return f"{parsed.scheme}://{parsed.netloc}"


async def require_mysim_session(request: Request) -> dict:
    token = request.cookies.get("mysim_session")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Inicia sesión",
        )

    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        allowed_origins = {
            _origin_from_url(settings.frontend_url),
            _origin_from_url(settings.oidc_redirect_uri),
        }

        if request.headers.get("origin") not in allowed_origins:
            raise HTTPException(
                status_code=403,
                detail="Origen no permitido",
            )

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.amh_api_url.rstrip('/')}"
                "/api/v1/access/sessions/mysim_dashboard",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="No se pudo consultar AMH",
        ) from exc

    if response.status_code == 401:
        raise HTTPException(
            status_code=401,
            detail="Sesión no válida",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="AMH no pudo validar la sesión",
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="Respuesta no válida de AMH",
        ) from exc

    if (
        not isinstance(data, dict)
        or data.get("application_code") != "mysim_dashboard"
        or data.get("role") not in {"viewer", "editor", "admin"}
    ):
        raise HTTPException(
            status_code=503,
            detail="Respuesta no válida de AMH",
        )

    return data


async def require_mysim_admin(
    session: dict = Depends(require_mysim_session),
) -> dict:
    if session.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Se requiere el rol admin de mySim Dashboard",
        )

    return session