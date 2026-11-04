from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request
import httpx
import re
from urllib.parse import urlencode, urlsplit
from fastapi.responses import RedirectResponse, JSONResponse
import hashlib
import hmac
from pydantic import BaseModel, ConfigDict, Field

from app.config import settings


router = APIRouter(prefix="/auth", tags=["auth"])
oauth = OAuth()

if (
    settings.oidc_issuer
    and settings.oidc_client_id
    and settings.oidc_client_secret
):
    oauth.register(
        name="keycloak",
        client_id=settings.oidc_client_id,
        client_secret=settings.oidc_client_secret.get_secret_value(),
        server_metadata_url=(
            f"{settings.oidc_issuer.rstrip('/')}"
            "/.well-known/openid-configuration"
        ),
        client_kwargs={
            "scope": "openid profile email",
            "code_challenge_method": "S256",
        },
    )


def _oidc_client():
    if not all(
        (
            settings.oidc_issuer,
            settings.oidc_client_id,
            settings.oidc_client_secret,
            settings.oidc_redirect_uri,
            settings.oidc_state_secret,
            settings.amh_api_url,
        )
    ):
        raise HTTPException(
            status_code=503,
            detail="Login OIDC no configurado",
        )

    client = oauth.create_client("keycloak")
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Cliente OIDC no disponible",
        )
    return client


@router.get("/login")
async def login(request: Request):
    client = _oidc_client()
    return await client.authorize_redirect(
        request,
        settings.oidc_redirect_uri,
    )


@router.get("/callback")
async def callback(request: Request):
    client = _oidc_client()

    try:
        try:
            token_data = await client.authorize_access_token(request)
        except OAuthError as exc:
            raise HTTPException(
                status_code=401,
                detail="No se pudo completar el login OIDC",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail="Keycloak no disponible",
            ) from exc

        userinfo = token_data.get("userinfo")
        access_token = token_data.get("access_token")

        if (
            not isinstance(userinfo, dict)
            or not userinfo.get("sub")
            or not isinstance(access_token, str)
            or not access_token
        ):
            raise HTTPException(
                status_code=401,
                detail="Identidad OIDC no válida",
            )

        try:
            async with httpx.AsyncClient(timeout=5.0) as http:
                amh_response = await http.post(
                    f"{settings.amh_api_url.rstrip('/')}/api/v1/access/sessions",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                    },
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=503,
                detail="AMH no disponible",
            ) from exc

        if amh_response.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="AMH no aceptó el token",
            )
        if amh_response.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="Sin acceso a mySim Dashboard",
            )
        if amh_response.status_code != 201:
            raise HTTPException(
                status_code=503,
                detail="No se pudo crear la sesión en AMH",
            )

        try:
            session_data = amh_response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=503,
                detail="Respuesta de AMH no válida",
            ) from exc

        if not isinstance(session_data, dict):
            raise HTTPException(
                status_code=503,
                detail="Respuesta de AMH no válida",
            )

        session_token = session_data.get("session_token")

        if (
            session_data.get("application_code") != "mysim_dashboard"
            or session_data.get("role") not in {"viewer", "editor", "admin"}
            or not session_data.get("user_id")
            or not isinstance(session_token, str)
            or re.fullmatch(r"[A-Za-z0-9_-]{43}", session_token) is None
        ):
            raise HTTPException(
                status_code=503,
                detail="Sesión recibida de AMH no válida",
            )

        response = RedirectResponse(
            url=f"{settings.frontend_url.rstrip('/')}/",
            status_code=303,
            headers={"Cache-Control": "no-store"},
        )
        response.set_cookie(
            key="mysim_session",
            value=session_token,
            max_age=8 * 60 * 60,
            httponly=True,
            secure=settings.oidc_redirect_uri.startswith("https://"),
            samesite="lax",
            path="/",
        )
        return response
    finally:
        request.session.clear()

@router.get("/me")
async def current_user(request: Request):
    session_token = request.cookies.get("mysim_session")

    if (
        not isinstance(session_token, str)
        or re.fullmatch(r"[A-Za-z0-9_-]{43}", session_token) is None
    ):
        raise HTTPException(status_code=401, detail="Sesión no iniciada")

    if not settings.amh_api_url:
        raise HTTPException(status_code=503, detail="AMH no configurado")

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            amh_response = await http.get(
                f"{settings.amh_api_url.rstrip('/')}"
                "/api/v1/access/sessions/mysim_dashboard",
                headers={
                    "Authorization": f"Bearer {session_token}",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="AMH no disponible",
        ) from exc

    if amh_response.status_code == 401:
        raise HTTPException(status_code=401, detail="Sesión caducada o revocada")
    if amh_response.status_code != 200:
        raise HTTPException(
            status_code=503,
            detail="No se pudo validar la sesión",
        )

    try:
        access = amh_response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="Respuesta de AMH no válida",
        ) from exc

    if (
        not isinstance(access, dict)
        or access.get("application_code") != "mysim_dashboard"
        or access.get("role") not in {"viewer", "editor", "admin"}
        or not access.get("user_id")
    ):
        raise HTTPException(
            status_code=503,
            detail="Respuesta de AMH no válida",
        )

    return {
        "user_id": access["user_id"],
        "role": access["role"],
    }

@router.post("/logout")
async def logout(request: Request):
    # Este endpoint se invoca mediante un formulario del navegador.
    # Acepta el origen del frontend y el del propio backend.
    backend_url = urlsplit(settings.oidc_redirect_uri)
    backend_origin = f"{backend_url.scheme}://{backend_url.netloc}"

    frontend_url = urlsplit(settings.frontend_url)
    frontend_origin = f"{frontend_url.scheme}://{frontend_url.netloc}"

    if request.headers.get("origin") not in {
        backend_origin,
        frontend_origin,
    }:
        raise HTTPException(status_code=403, detail="Origen no permitido")

    token = request.cookies.get("mysim_session")

    if token:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                result = await client.delete(
                    f"{settings.amh_api_url.rstrip('/')}"
                    "/api/v1/access/sessions/mysim_dashboard",
                    headers={"Authorization": f"Bearer {token}"},
                )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=503,
                detail="No se pudo revocar la sesión en AMH; inténtalo de nuevo",
            ) from exc

        # 401 significa que AMH ya considera inválida esa sesión.
        if result.status_code not in (204, 401):
            raise HTTPException(
                status_code=503,
                detail="AMH no confirmó la revocación de la sesión",
            )

    logout_url = (
        f"{settings.oidc_issuer.rstrip('/')}"
        "/protocol/openid-connect/logout?"
        + urlencode(
            {
                "client_id": settings.oidc_client_id,
                "post_logout_redirect_uri": (
                    settings.frontend_url.rstrip("/") + "/"
                ),
            }
        )
    )

    response = RedirectResponse(logout_url, status_code=303)
    response.delete_cookie("mysim_session", path="/")
    response.headers["Cache-Control"] = "no-store"
    return response
class NfcFinishRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge: str = Field(min_length=43, max_length=43)


def _require_frontend_origin(request: Request) -> None:
    frontend = urlsplit(settings.frontend_url)
    keycloak = urlsplit(settings.oidc_issuer)

    allowed_origins = {
        f"{frontend.scheme}://{frontend.netloc}",
        f"{keycloak.scheme}://{keycloak.netloc}",
    }

    if request.headers.get("origin") not in allowed_origins:
        raise HTTPException(status_code=403, detail="Origen no permitido")


def _nfc_client_token() -> str:
    if not settings.amh_api_url or settings.amh_nfc_client_token is None:
        raise HTTPException(
            status_code=503,
            detail="Login NFC no configurado",
        )
    return settings.amh_nfc_client_token.get_secret_value()


@router.post("/nfc/start")
async def start_nfc_login(request: Request):
    _require_frontend_origin(request)
    client_token = _nfc_client_token()

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            result = await http.post(
                f"{settings.amh_api_url.rstrip('/')}/api/v1/nfc/attempts",
                headers={"X-AMH-NFC-Client-Token": client_token},
                json={"application_code": "mysim_dashboard"},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="AMH no disponible",
        ) from exc

    if result.status_code != 201:
        raise HTTPException(
            status_code=503,
            detail="No se pudo iniciar el login NFC",
        )

    try:
        challenge = result.json()["challenge"]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=503,
            detail="Respuesta NFC de AMH no válida",
        ) from exc

    if (
        not isinstance(challenge, str)
        or re.fullmatch(r"[A-Za-z0-9_-]{43}", challenge) is None
    ):
        raise HTTPException(
            status_code=503,
            detail="Desafío NFC no válido",
        )

    # SessionMiddleware firma esta cookie; guardamos solo el hash.
    request.session["nfc_challenge_hash"] = hashlib.sha256(
        challenge.encode("ascii")
    ).hexdigest()

    return JSONResponse(
        {"challenge": challenge},
        headers={"Cache-Control": "no-store"},
    )


@router.post("/nfc/finish")
async def finish_nfc_login(
    data: NfcFinishRequest,
    request: Request,
):
    _require_frontend_origin(request)
    client_token = _nfc_client_token()

    saved_hash = request.session.get("nfc_challenge_hash")
    submitted_hash = hashlib.sha256(
        data.challenge.encode("ascii")
    ).hexdigest()

    if (
        not isinstance(saved_hash, str)
        or not hmac.compare_digest(saved_hash, submitted_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail="Intento NFC no iniciado en este navegador",
        )

    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            result = await http.post(
                f"{settings.amh_api_url.rstrip('/')}"
                "/api/v1/nfc/attempts/consume",
                headers={"X-AMH-NFC-Client-Token": client_token},
                json={"challenge": data.challenge},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="AMH no disponible",
        ) from exc

    if result.status_code == 409:
        raise HTTPException(
            status_code=409,
            detail="Lectura NFC pendiente, caducada o rechazada",
        )
    if result.status_code != 201:
        raise HTTPException(
            status_code=503,
            detail="No se pudo crear la sesión NFC",
        )

    try:
        session_data = result.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=503,
            detail="Respuesta de AMH no válida",
        ) from exc

    if not isinstance(session_data, dict):
        raise HTTPException(
            status_code=503,
            detail="Respuesta de AMH no válida",
        )

    session_token = session_data.get("session_token")
    if (
        session_data.get("application_code") != "mysim_dashboard"
        or session_data.get("role") not in {"viewer", "editor", "admin"}
        or not session_data.get("user_id")
        or not isinstance(session_token, str)
        or re.fullmatch(r"[A-Za-z0-9_-]{43}", session_token) is None
    ):
        raise HTTPException(
            status_code=503,
            detail="Sesión NFC recibida de AMH no válida",
        )

    request.session.pop("nfc_challenge_hash", None)

    response = JSONResponse(
        {"status": "session_created"},
        headers={"Cache-Control": "no-store"},
    )
    response.set_cookie(
        key="mysim_session",
        value=session_token,
        max_age=8 * 60 * 60,
        httponly=True,
        secure=settings.oidc_redirect_uri.startswith("https://"),
        samesite="lax",
        path="/",
    )
    return response