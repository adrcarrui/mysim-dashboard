import base64
import re
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.config import settings


class MySimClient:
    def __init__(self):
        self.base_url = settings.mysim_base_url.rstrip("/")
        self.token = settings.mysim_auth_token
        self.timeout = settings.mysim_timeout

        self.username = settings.mysim_username
        self.password = settings.mysim_password

        parsed = urlsplit(self.base_url)

        self.site_base_url = (
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
        raw = query.encode("utf-8")

        return base64.b64encode(
            raw
        ).decode("ascii")

    async def get(
        self,
        entity: str,
        extra_query: str | None = None,
    ) -> dict[str, Any]:
        """
        API pública de mySim.
        Usada por Jobs, Tasks, Actions, DRs, etc.
        """

        params = {
            "entity": entity,
        }

        if extra_query:
            params["extraQuery"] = (
                self.encode_extra_query(
                    extra_query
                )
            )

        headers = {
            "X-AUTH-TOKEN": self.token,
            "Accept": "application/json",
        }

        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=False,
        ) as client:
            response = await client.post(
                f"{self.base_url}/get",
                params=params,
                headers=headers,
            )

        print(
            "========== mySim DEBUG =========="
        )
        print(
            "Request URL:",
            response.request.url,
        )
        print(
            "Status:",
            response.status_code,
        )
        print(
            "Location:",
            response.headers.get(
                "location"
            ),
        )
        print(
            "Content-Type:",
            response.headers.get(
                "content-type"
            ),
        )
        print(
            "Token configured:",
            bool(self.token),
        )
        print(
            "Response body:",
            response.text[:500],
        )
        print(
            "================================="
        )

        content_type = response.headers.get(
            "content-type",
            "",
        )

        if (
            "application/json"
            not in content_type
        ):
            raise RuntimeError(
                "mySim returned unexpected response "
                f"(HTTP {response.status_code}, "
                f"{content_type})"
            )

        data = response.json()

        if data.get("status") not in (
            200,
            404,
        ):
            raise RuntimeError(
                f"mySim API error: {data}"
            )

        return data

    async def _get_csrf_token(
        self,
    ) -> str:
        response = await self.session_client.get(
            "/login",
            params={
                "partial": "1",
            },
            headers={
                "Accept": (
                    "text/html,"
                    "application/xhtml+xml,"
                    "application/xml;q=0.9,"
                    "*/*;q=0.8"
                ),
            },
        )

        response.raise_for_status()

        html = response.text

        patterns = [
            (
                r'name=["\']_csrf_token["\']'
                r'[^>]*'
                r'value=["\']([^"\']+)["\']'
            ),
            (
                r'value=["\']([^"\']+)["\']'
                r'[^>]*'
                r'name=["\']_csrf_token["\']'
            ),
        ]

        for pattern in patterns:
            match = re.search(
                pattern,
                html,
                flags=re.IGNORECASE,
            )

            if match:
                print(
                    "CSRF found:",
                    True,
                )

                print(
                    "Session cookies after login page:",
                    self.session_client.cookies,
                )

                return match.group(1)

        raise RuntimeError(
            "Could not find mySim CSRF token "
            "in login page"
        )

    async def login(
        self,
    ) -> None:
        if (
            not self.username
            or not self.password
        ):
            raise RuntimeError(
                "MYSIM_USERNAME and "
                "MYSIM_PASSWORD are not configured"
            )

        csrf_token = (
            await self._get_csrf_token()
        )

        print(
            "Cookies before login_check:",
            self.session_client.cookies,
        )

        response = await self.session_client.post(
            "/login_check",
            data={
                "target_path": "",
                "_csrf_token": csrf_token,
                "_username": self.username,
                "_password": self.password,
            },
            headers={
                "Accept": (
                    "text/html,"
                    "application/xhtml+xml,"
                    "application/xml;q=0.9,"
                    "image/avif,"
                    "image/webp,"
                    "image/apng,"
                    "*/*;q=0.8"
                ),
                "Content-Type": (
                    "application/x-www-form-urlencoded"
                ),
                "Origin": self.site_base_url,
                "Referer": (
                    f"{self.site_base_url}"
                    "/login?partial=1"
                ),
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            },
        )

        location = response.headers.get(
            "location",
            "",
        )

        print(
            "====== mySim LOGIN DEBUG ======"
        )
        print(
            "Status:",
            response.status_code,
        )
        print(
            "Location:",
            location,
        )
        print(
            "Cookies after login_check:",
            self.session_client.cookies,
        )
        print(
            "Username configured:",
            bool(self.username),
        )
        print(
            "Password configured:",
            bool(self.password),
        )
        print(
            "Password length:",
            len(self.password or ""),
        )
        print(
            "==============================="
        )

        if response.status_code not in (
            301,
            302,
            303,
        ):
            raise RuntimeError(
                "mySim login failed: "
                f"HTTP {response.status_code}"
            )

        normalized_location = (
            location.lower()
        )

        if (
            normalized_location.endswith(
                "/login"
            )
            or "/login?" in normalized_location
        ):
            raise RuntimeError(
                "mySim login failed: "
                f"redirected to {location}"
            )

        if (
            "/index"
            not in normalized_location
        ):
            raise RuntimeError(
                "mySim login returned "
                "unexpected redirect: "
                f"{location}"
            )

        print(
            "mySim login successful"
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
        ).lower()

        return "/login" in location

    async def get_datatable(
        self,
        entity: str,
        *,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Consulta endpoints:

        /content-datatable/<entity>

        Si la sesión web no existe o ha caducado,
        hace login automáticamente y repite.
        """

        url = (
            f"/content-datatable/{entity}"
        )

        headers = {
            "Accept": (
                "application/json, "
                "text/javascript, */*; q=0.01"
            ),
            "X-Requested-With": (
                "XMLHttpRequest"
            ),
            "Referer": (
                f"{self.site_base_url}/index"
            ),
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

        response = await self.session_client.get(
            url,
            params=params,
            headers=headers,
        )

        if self._requires_login(
            response
        ):
            print(
                "mySim session missing/expired. "
                "Logging in..."
            )

            await self.login()

            response = (
                await self.session_client.get(
                    url,
                    params=params,
                    headers=headers,
                )
            )

        if self._requires_login(
            response
        ):
            raise RuntimeError(
                "mySim authentication failed "
                "after login"
            )

        print(
            "=== mySim DATATABLE DEBUG ==="
        )
        print(
            "Request URL:",
            response.request.url,
        )
        print(
            "Status:",
            response.status_code,
        )
        print(
            "Location:",
            response.headers.get(
                "location"
            ),
        )
        print(
            "Content-Type:",
            response.headers.get(
                "content-type"
            ),
        )
        print(
            "============================="
        )

        response.raise_for_status()

        content_type = response.headers.get(
            "content-type",
            "",
        )

        if (
            "application/json"
            not in content_type
        ):
            raise RuntimeError(
                "mySim datatable returned "
                "unexpected response "
                f"(HTTP {response.status_code}, "
                f"{content_type})"
            )

        return response.json()


mysim_client = MySimClient()