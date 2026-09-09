import asyncio
from typing import Any

from app.repositories.maintenance_tasks_repository import (
    maintenance_tasks_repository,
)
from app.services.mysim_client import mysim_client


class MaintenanceTasksService:
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
                and isinstance(
                    row.get("taskId"),
                    str,
                )
                and isinstance(
                    row.get("task"),
                    str,
                )
            )
        ]

    async def synchronize(self) -> int:
        async with self._sync_lock:
            response = await mysim_client.get(
                entity="maintenanceTask",
                extra_query=(
                    "t.deleted=0 "
                    "AND t.enabled=1"
                ),
            )

            if response.get("status") != 200:
                raise RuntimeError(
                    "Could not retrieve "
                    "MaintenanceTask from mySim"
                )

            maintenance_tasks = self._extract_rows(
                response
            )

            if not maintenance_tasks:
                raise RuntimeError(
                    "mySim returned no valid "
                    "maintenance tasks"
                )

            return await (
                maintenance_tasks_repository
                .synchronize(
                    response=response,
                    maintenance_tasks=(
                        maintenance_tasks
                    ),
                )
            )

    async def get_many(
        self,
        maintenance_task_ids: set[int],
    ) -> dict[int, dict[str, Any]]:
        return await (
            maintenance_tasks_repository
            .get_many(
                maintenance_task_ids
            )
        )

    async def count(self) -> int:
        return await (
            maintenance_tasks_repository.count()
        )


maintenance_tasks_service = (
    MaintenanceTasksService()
)