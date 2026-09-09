import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.repositories.devices_repository import (
    devices_repository,
)
from app.services.mysim_client import mysim_client


class DevicesService:
    def __init__(self) -> None:
        self._cache: dict[int, str] = {}
        self._sync_lock = asyncio.Lock()

    @staticmethod
    def _extract_devices(
        response: dict[str, Any],
    ) -> list[dict[str, Any]]:
        data = response.get("data")

        if not isinstance(data, dict):
            return []

        rows = data.get("data")

        if not isinstance(rows, list):
            return []

        return [
            row
            for row in rows
            if (
                isinstance(row, dict)
                and isinstance(row.get("id"), int)
            )
        ]

    async def load_cache(self) -> int:
        self._cache = (
            await devices_repository.get_name_map()
        )

        return len(self._cache)

    async def synchronize(self) -> int:
        async with self._sync_lock:
            response = await mysim_client.get(
                entity="device",
            )

            if response.get("status") != 200:
                raise RuntimeError(
                    "Could not retrieve devices "
                    "from mySim"
                )

            devices = self._extract_devices(
                response
            )

            if not devices:
                raise RuntimeError(
                    "mySim returned no valid devices"
                )

            synchronized = (
                await devices_repository.synchronize(
                    response=response,
                    devices=devices,
                )
            )

            await self.load_cache()

            return synchronized

    async def synchronize_if_stale(
        self,
    ) -> tuple[bool, int]:
        last_sync = (
            await devices_repository.get_last_sync()
        )

        maximum_age = timedelta(
            seconds=(
                settings
                .devices_sync_interval_seconds
            )
        )

        if last_sync is not None:
            if last_sync.tzinfo is None:
                last_sync = last_sync.replace(
                    tzinfo=timezone.utc
                )

            age = (
                datetime.now(timezone.utc)
                - last_sync
            )

            if age < maximum_age:
                loaded = await self.load_cache()
                return False, loaded

        synchronized = await self.synchronize()

        return True, synchronized

    async def get_name(
        self,
        device_id: int | None,
    ) -> str | None:
        if device_id is None:
            return None

        if device_id in self._cache:
            return self._cache[device_id]

        local_name = (
            await devices_repository.get_name(
                device_id
            )
        )

        if local_name:
            self._cache[device_id] = local_name
            return local_name

        response = await mysim_client.get(
            entity="device",
            extra_query=f"t.id={device_id}",
        )

        if response.get("status") == 404:
            return None

        devices = self._extract_devices(
            response
        )

        if not devices:
            return None

        device = devices[0]

        await devices_repository.upsert_one(
            device
        )

        name = device.get("name")

        if name:
            self._cache[device_id] = name

        return name

    async def get_all(
        self,
        include_missing: bool = False,
    ) -> list[dict[str, Any]]:
        return await devices_repository.get_all(
            include_missing=include_missing,
        )

    async def get_raw_response(
        self,
    ) -> dict[str, Any] | None:
        return (
            await devices_repository
            .get_raw_response()
        )


devices_service = DevicesService()