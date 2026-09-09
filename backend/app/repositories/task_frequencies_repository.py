from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.database import AsyncSessionLocal
from app.models.device import MySimEntityCache
from app.models.task_frequency import TaskFrequency


class TaskFrequenciesRepository:
    async def synchronize(
        self,
        response: dict[str, Any],
        frequencies: list[dict[str, Any]],
    ) -> int:
        values = [
            {
                "mysim_id": int(row["id"]),
                "name": row["name"],
                "num_of_days": row.get("numOfDays"),
                "enabled": row.get("enabled"),
                "raw_data": row,
                "is_present_in_mysim": True,
            }
            for row in frequencies
        ]

        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(
                    update(TaskFrequency).values(
                        is_present_in_mysim=False,
                    )
                )

                statement = insert(
                    TaskFrequency
                ).values(values)

                statement = (
                    statement.on_conflict_do_update(
                        index_elements=[
                            TaskFrequency.mysim_id
                        ],
                        set_={
                            "name": statement.excluded.name,
                            "num_of_days": (
                                statement
                                .excluded
                                .num_of_days
                            ),
                            "enabled": (
                                statement.excluded.enabled
                            ),
                            "raw_data": (
                                statement.excluded.raw_data
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
                        entity="TaskFrequency",
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

    async def get_many(
        self,
        frequency_ids: set[int],
    ) -> dict[int, dict[str, Any]]:
        if not frequency_ids:
            return {}

        async with AsyncSessionLocal() as session:
            statement = (
                select(TaskFrequency)
                .where(
                    TaskFrequency.mysim_id.in_(
                        frequency_ids
                    ),
                    TaskFrequency
                    .is_present_in_mysim
                    .is_(True),
                )
            )

            result = await session.scalars(
                statement
            )

            return {
                frequency.mysim_id: {
                    "id": frequency.mysim_id,
                    "name": frequency.name,
                    "num_of_days": (
                        frequency.num_of_days
                    ),
                }
                for frequency in result.all()
            }

    async def get_all(
        self,
    ) -> list[dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            statement = (
                select(TaskFrequency)
                .where(
                    TaskFrequency
                    .is_present_in_mysim
                    .is_(True)
                )
                .order_by(
                    TaskFrequency.mysim_id
                )
            )

            result = await session.scalars(
                statement
            )

            return [
                frequency.raw_data
                for frequency in result.all()
            ]


task_frequencies_repository = (
    TaskFrequenciesRepository()
)