import base64
from typing import Any

import httpx

from app.config import settings


class MySimClient:
    def __init__(self):
        self.base_url = settings.mysim_base_url.rstrip("/")
        self.token = settings.mysim_auth_token
        self.timeout = settings.mysim_timeout

    @staticmethod
    def encode_extra_query(query: str) -> str:
        raw = query.encode("utf-8")
        return base64.b64encode(raw).decode("ascii")

    async def get(
        self,
        entity: str,
        extra_query: str | None = None,
    ) -> dict[str, Any]:

        params = {
            "entity": entity,
        }

        if extra_query:
            params["extraQuery"] = self.encode_extra_query(extra_query)

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

            print("========== mySim DEBUG ==========")
            print("Request URL:", response.request.url)
            print("Status:", response.status_code)
            print("Location:", response.headers.get("location"))
            print("Content-Type:", response.headers.get("content-type"))
            print("Token configured:", bool(self.token))
            print("Response body:", response.text[:500])
            print("=================================")


        content_type = response.headers.get("content-type", "")

        if "application/json" not in content_type:
            raise RuntimeError(
                f"mySim returned unexpected response "
                f"(HTTP {response.status_code}, {content_type})"
            )

        data = response.json()

        if data.get("status") not in (200, 404):
            raise RuntimeError(
                f"mySim API error: {data}"
            )

        return data


mysim_client = MySimClient()