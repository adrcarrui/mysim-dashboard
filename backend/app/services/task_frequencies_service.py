import asyncio
from typing import Any

from app.repositories.task_frequencies_repository import (
    task_frequencies_repository,
)
from app.services.mysim_client import mysim_client


class TaskFrequenciesService:
    def __init__(self) -> None:
        self._sync_lock = asyncio.Lock()

    @staticmethod
    def _extract_rows(
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
                and isinstance(row.get("name"), str)
            )
        ]

    async def synchronize(self) -> int:
        async with self._sync_lock:
            response = await mysim_client.get(
                entity="TaskFrequency",
            )

            if response.get("status") != 200:
                raise RuntimeError(
                    "Could not retrieve "
                    "TaskFrequency from mySim"
                )

            frequencies = self._extract_rows(
                response
            )

            if not frequencies:
                raise RuntimeError(
                    "mySim returned no valid "
                    "task frequencies"
                )

            return await (
                task_frequencies_repository
                .synchronize(
                    response=response,
                    frequencies=frequencies,
                )
            )

    async def get_many(
        self,
        frequency_ids: set[int],
    ) -> dict[int, dict[str, Any]]:
        frequencies = await (
            task_frequencies_repository
            .get_many(frequency_ids)
        )

        missing_ids = (
            frequency_ids - frequencies.keys()
        )

        if missing_ids:
            await self.synchronize()

            frequencies = await (
                task_frequencies_repository
                .get_many(frequency_ids)
            )

        return frequencies

    async def get_all(
        self,
    ) -> list[dict[str, Any]]:
        return await (
            task_frequencies_repository.get_all()
        )


task_frequencies_service = TaskFrequenciesService()