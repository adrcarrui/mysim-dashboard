from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.database import AsyncSessionLocal
from app.models.device import MySimEntityCache
from app.models.maintenance_task import (
    MaintenanceTask,
)


class MaintenanceTasksRepository:
    @staticmethod
    def _to_values(
        row: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "mysim_id": int(row["id"]),
            "task_id": row["taskId"],
            "task_name": row["task"],
            "task_description": row.get(
                "taskDescription"
            ),
            "device_id": row.get("device"),
            "frequency_id": row.get("frequency"),
            "system_id": row.get("system"),
            "status_id": row.get("status"),
            "to_do_by_id": row.get("toDoBy"),
            "estimated_time": row.get(
                "estimatedTime"
            ),
            "preventive_manual_version": (
                row.get(
                    "preventiveManualVersion"
                )
            ),
            "enabled": row.get("enabled"),
            "raw_data": row,
            "is_present_in_mysim": True,
        }

    async def synchronize(
        self,
        response: dict[str, Any],
        maintenance_tasks: list[dict[str, Any]],
    ) -> int:
        values = [
            self._to_values(row)
            for row in maintenance_tasks
        ]

        if not values:
            return 0

        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(
                    update(MaintenanceTask).values(
                        is_present_in_mysim=False
                    )
                )

                statement = insert(
                    MaintenanceTask
                ).values(values)

                statement = (
                    statement.on_conflict_do_update(
                        index_elements=[
                            MaintenanceTask.mysim_id
                        ],
                        set_={
                            "task_id": (
                                statement.excluded.task_id
                            ),
                            "task_name": (
                                statement
                                .excluded
                                .task_name
                            ),
                            "task_description": (
                                statement
                                .excluded
                                .task_description
                            ),
                            "device_id": (
                                statement
                                .excluded
                                .device_id
                            ),
                            "frequency_id": (
                                statement
                                .excluded
                                .frequency_id
                            ),
                            "system_id": (
                                statement
                                .excluded
                                .system_id
                            ),
                            "status_id": (
                                statement
                                .excluded
                                .status_id
                            ),
                            "to_do_by_id": (
                                statement
                                .excluded
                                .to_do_by_id
                            ),
                            "estimated_time": (
                                statement
                                .excluded
                                .estimated_time
                            ),
                            "preventive_manual_version": (
                                statement
                                .excluded
                                .preventive_manual_version
                            ),
                            "enabled": (
                                statement.excluded.enabled
                            ),
                            "raw_data": (
                                statement
                                .excluded
                                .raw_data
                            ),
                            "is_present_in_mysim": True,
                            "updated_at": func.now(),
                            "synced_at": func.now(),
                        },
                    )
                )

                await session.execute(statement)

                cache_statement = (
                    insert(MySimEntityCache)
                    .values(
                        entity="maintenanceTask",
                        raw_response=response,
                    )
                )

                cache_statement = (
                    cache_statement
                    .on_conflict_do_update(
                        index_elements=[
                            MySimEntityCache.entity
                        ],
                        set_={
                            "raw_response": (
                                cache_statement
                                .excluded
                                .raw_response
                            ),
                            "synced_at": func.now(),
                        },
                    )
                )

                await session.execute(
                    cache_statement
                )

        return len(values)

    async def count(self) -> int:
        async with AsyncSessionLocal() as session:
            statement = (
                select(
                    func.count(
                        MaintenanceTask.id
                    )
                )
                .where(
                    MaintenanceTask
                    .is_present_in_mysim
                    .is_(True)
                )
            )

            result = await session.scalar(
                statement
            )

            return int(result or 0)


    async def get_many(
        self,
        maintenance_task_ids: set[int],
    ) -> dict[int, dict[str, Any]]:
        if not maintenance_task_ids:
            return {}

        async with AsyncSessionLocal() as session:
            statement = (
                select(
                    MaintenanceTask.mysim_id,
                    MaintenanceTask.raw_data,
                )
                .where(
                    MaintenanceTask.mysim_id.in_(
                        maintenance_task_ids
                    ),
                    MaintenanceTask
                    .is_present_in_mysim
                    .is_(True),
                )
            )

            result = await session.execute(
                statement
            )

            return {
                int(mysim_id): raw_data
                for mysim_id, raw_data
                in result.all()
            }

maintenance_tasks_repository = (
    MaintenanceTasksRepository()
)