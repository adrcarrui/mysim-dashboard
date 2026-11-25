import base64
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.config import settings


class _CsrfTokenParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.token: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "input":
            return

        attributes = dict(attrs)

        if attributes.get("name") == "_csrf_token":
            self.token = attributes.get("value")


class MySimClient:
    def __init__(self):
        self.base_url = settings.mysim_base_url.rstrip("/")
        self.token = settings.mysim_auth_token
        self.timeout = settings.mysim_timeout

        self.username = settings.mysim_username
        self.password = settings.mysim_password

        parsed = urlsplit(self.base_url)

        site_path = (
            parsed.path
            .split("/api/", 1)[0]
            .rstrip("/")
        )

        self.site_base_url = (
            f"{parsed.scheme}://{parsed.netloc}{site_path}"
        )

        self.site_origin = (
            f"{parsed.scheme}://{parsed.netloc}"
        )

        self.session_client = httpx.AsyncClient(
            base_url=self.site_base_url,
            timeout=self.timeout,
            follow_redirects=False,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/152 Safari/537.36"
                ),
            },
        )

    @staticmethod
    def encode_extra_query(query: str) -> str:
        return base64.b64encode(
            query.encode("utf-8")
        ).decode("ascii")

    async def get(
        self,
        entity: str,
        extra_query: str | None = None,
    ) -> dict[str, Any]:
        """
        Consulta la API pública de mySim mediante el token.
        """

        params = {
            "entity": entity,
        }

        if extra_query:
            params["extraQuery"] = (
                self.encode_extra_query(extra_query)
            )

        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=False,
        ) as client:
            response = await client.post(
                f"{self.base_url}/get",
                params=params,
                headers={
                    "X-AUTH-TOKEN": self.token,
                    "Accept": "application/json",
                },
            )

        print("========== mySim DEBUG ==========")
        print("Request URL:", response.request.url)
        print("Status:", response.status_code)
        print(
            "Location:",
            response.headers.get("location"),
        )
        print(
            "Content-Type:",
            response.headers.get("content-type"),
        )
        print("Token configured:", bool(self.token))
        print("=================================")

        content_type = response.headers.get(
            "content-type",
            "",
        )

        if "application/json" not in content_type.lower():
            raise RuntimeError(
                "mySim returned unexpected response "
                f"(HTTP {response.status_code}, "
                f"{content_type})"
            )

        data = response.json()

        if not isinstance(data, dict):
            raise RuntimeError(
                "mySim API returned an invalid JSON structure"
            )

        if data.get("status") not in (200, 404):
            raise RuntimeError(
                f"mySim API error: status={data.get('status')}, "
                f"msg={data.get('msg')}"
            )

        return data

    async def _get_csrf_token(self) -> str:
        response = await self.session_client.get(
            "/login",
            params={
                "partial": "1",
            },
            headers={
                "Accept": (
                    "text/html,application/xhtml+xml,"
                    "application/xml;q=0.9,*/*;q=0.8"
                ),
            },
        )

        response.raise_for_status()

        parser = _CsrfTokenParser()
        parser.feed(response.text)

        if not parser.token:
            raise RuntimeError(
                "Could not find mySim CSRF token "
                "in login page"
            )

        print("CSRF found: True")

        return parser.token

    async def login(self) -> None:
        if not self.username or not self.password:
            raise RuntimeError(
                "MYSIM_USERNAME and MYSIM_PASSWORD "
                "are not configured"
            )

        csrf_token = await self._get_csrf_token()

        # El formulario actual de mySim envía POST a /login.
        response = await self.session_client.post(
            "/login",
            data={
                "target_path": "",
                "_csrf_token": csrf_token,
                "_username": self.username,
                "_password": self.password,
            },
            headers={
                "Accept": (
                    "text/html,application/xhtml+xml,"
                    "application/xml;q=0.9,*/*;q=0.8"
                ),
                "Origin": self.site_origin,
                "Referer": (
                    f"{self.site_base_url}/login?partial=1"
                ),
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
            follow_redirects=False,
        )

        location = response.headers.get(
            "location",
            "",
        )

        location_path = (
            urlsplit(location)
            .path
            .rstrip("/")
            .lower()
        )

        print("====== mySim LOGIN DEBUG ======")
        print("Request URL:", response.request.url)
        print("Method:", response.request.method)
        print("Status:", response.status_code)
        print("Location:", location)
        print("===============================")

        if response.status_code not in (302, 303):
            raise RuntimeError(
                "mySim login returned an unexpected response "
                f"(HTTP {response.status_code})"
            )

        if (
            not location
            or location_path.endswith(
                ("/login", "/login_check")
            )
        ):
            raise RuntimeError(
                "mySim did not confirm the login; "
                "check the web credentials and login form"
            )

        # La siguiente consulta verificará que la sesión
        # permite acceder a los datos.
        print(
            "mySim login submitted; "
            "verifying session with the next request"
        )

    @staticmethod
    def _requires_login(
        response: httpx.Response,
    ) -> bool:
        if response.status_code not in (
            301,
            302,
            303,
            307,
            308,
        ):
            return False

        location = response.headers.get(
            "location",
            "",
        )

        path = (
            urlsplit(location)
            .path
            .rstrip("/")
            .lower()
        )

        return path.endswith(
            ("/login", "/login_check")
        )

    async def get_datatable(
        self,
        entity: str,
        *,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Consulta DataTables utilizando la sesión web de mySim.
        """

        url = f"/content-datatable/{entity}"

        headers = {
            "Accept": (
                "application/json, "
                "text/javascript, */*; q=0.01"
            ),
            "X-Requested-With": "XMLHttpRequest",
            "Referer": f"{self.site_base_url}/index",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

        response = await self.session_client.get(
            url,
            params=params,
            headers=headers,
        )

        login_attempted = False

        if self._requires_login(response):
            print(
                "mySim session missing/expired. "
                "Logging in..."
            )

            await self.login()
            login_attempted = True

            response = await self.session_client.get(
                url,
                params=params,
                headers=headers,
            )

        print("=== mySim DATATABLE DEBUG ===")
        print("Request URL:", response.request.url)
        print("Method:", response.request.method)
        print("Status:", response.status_code)
        print(
            "Location:",
            response.headers.get("location"),
        )
        print(
            "Content-Type:",
            response.headers.get("content-type"),
        )
        print("Login attempted:", login_attempted)
        print("=============================")

        if self._requires_login(response):
            raise RuntimeError(
                "mySim authentication failed after login"
            )

        response.raise_for_status()

        content_type = response.headers.get(
            "content-type",
            "",
        )

        if "application/json" not in content_type.lower():
            raise RuntimeError(
                "mySim datatable returned unexpected response "
                f"(HTTP {response.status_code}, "
                f"{content_type})"
            )

        data = response.json()

        if not isinstance(data, dict):
            raise RuntimeError(
                "mySim datatable returned "
                "an invalid JSON structure"
            )

        return data


mysim_client = MySimClient()