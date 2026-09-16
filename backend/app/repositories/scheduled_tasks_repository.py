from datetime import date, datetime, time
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from app.database import AsyncSessionLocal
from app.models.scheduled_task import (
    ScheduledTask,
    ScheduledTaskSyncPeriod,
)


class ScheduledTasksRepository:
    @staticmethod
    def _period_datetimes(
        period_start: date,
        period_end: date,
    ) -> tuple[datetime, datetime]:
        return (
            datetime.combine(
                period_start,
                time.min,
            ),
            datetime.combine(
                period_end,
                time.min,
            ),
        )

    async def mark_period_running(
        self,
        *,
        period_start: date,
        period_end: date,
    ) -> None:
        statement = insert(
            ScheduledTaskSyncPeriod
        ).values(
            period_start=period_start,
            period_end=period_end,
            sync_status="running",
            rows_received=0,
            error_message=None,
            last_attempt_at=func.now(),
        )

        statement = statement.on_conflict_do_update(
            constraint="uq_scheduled_task_sync_period",
            set_={
                "sync_status": "running",
                "rows_received": 0,
                "error_message": None,
                "last_attempt_at": func.now(),
                "updated_at": func.now(),
            },
        )

        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(statement)

    async def mark_period_failed(
        self,
        *,
        period_start: date,
        period_end: date,
        error_message: str,
    ) -> None:
        truncated_error = error_message[:2000]

        statement = insert(
            ScheduledTaskSyncPeriod
        ).values(
            period_start=period_start,
            period_end=period_end,
            sync_status="failed",
            rows_received=0,
            error_message=truncated_error,
            last_attempt_at=func.now(),
        )

        statement = statement.on_conflict_do_update(
            constraint="uq_scheduled_task_sync_period",
            set_={
                "sync_status": "failed",
                "rows_received": 0,
                "error_message": truncated_error,
                "last_attempt_at": func.now(),
                "updated_at": func.now(),
            },
        )

        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(statement)

    async def synchronize_period(
        self,
        *,
        period_start: date,
        period_end: date,
        tasks: list[dict[str, Any]],
    ) -> int:
        start_datetime, end_datetime = (
            self._period_datetimes(
                period_start,
                period_end,
            )
        )

        async with AsyncSessionLocal() as session:
            async with session.begin():
                # Una tarea que antes estaba en este periodo,
                # pero ya no llega desde mySim, se marca como ausente.
                await session.execute(
                    update(ScheduledTask)
                    .where(
                        ScheduledTask.planned_date
                        >= start_datetime,
                        ScheduledTask.planned_date
                        < end_datetime,
                    )
                    .values(
                        is_present_in_mysim=False,
                        updated_at=func.now(),
                        synced_at=func.now(),
                    )
                )

                if tasks:
                    statement = insert(
                        ScheduledTask
                    ).values(tasks)

                    statement = (
                        statement.on_conflict_do_update(
                            index_elements=[
                                ScheduledTask.mysim_id
                            ],
                            set_={
                                "maintenance_task_id": (
                                    statement
                                    .excluded
                                    .maintenance_task_id
                                ),
                                "schedule_code": (
                                    statement
                                    .excluded
                                    .schedule_code
                                ),
                                "planned_date": (
                                    statement
                                    .excluded
                                    .planned_date
                                ),
                                "status_id": (
                                    statement
                                    .excluded
                                    .status_id
                                ),
                                "remarks": (
                                    statement
                                    .excluded
                                    .remarks
                                ),
                                "done_at": (
                                    statement
                                    .excluded
                                    .done_at
                                ),
                                "performed_by_id": (
                                    statement
                                    .excluded
                                    .performed_by_id
                                ),
                                "performance_remarks": (
                                    statement
                                    .excluded
                                    .performance_remarks
                                ),
                                "enabled": (
                                    statement
                                    .excluded
                                    .enabled
                                ),
                                "deleted": (
                                    statement
                                    .excluded
                                    .deleted
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

                period_statement = insert(
                    ScheduledTaskSyncPeriod
                ).values(
                    period_start=period_start,
                    period_end=period_end,
                    sync_status="completed",
                    rows_received=len(tasks),
                    error_message=None,
                    last_attempt_at=func.now(),
                    last_success_at=func.now(),
                )

                period_statement = (
                    period_statement.on_conflict_do_update(
                        constraint=(
                            "uq_scheduled_task_sync_period"
                        ),
                        set_={
                            "sync_status": "completed",
                            "rows_received": len(tasks),
                            "error_message": None,
                            "last_attempt_at": func.now(),
                            "last_success_at": func.now(),
                            "updated_at": func.now(),
                        },
                    )
                )

                await session.execute(period_statement)

        return len(tasks)

    async def get_open_until(
        self,
        *,
        end_date: datetime,
    ) -> list[dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            statement = (
                select(ScheduledTask.raw_data)
                .where(
                    ScheduledTask.planned_date
                    < end_date,
                    ScheduledTask.status_id.in_(
                        {
                            199,
                            200,
                            2542,
                        }
                    ),
                    ScheduledTask.is_present_in_mysim
                    .is_(True),
                    ScheduledTask.enabled.is_(True),
                    ScheduledTask.deleted.is_(False),
                )
                .order_by(
                    ScheduledTask.planned_date.asc()
                )
            )

            result = await session.execute(statement)

            return [
                raw_data
                for raw_data
                in result.scalars().all()
                if isinstance(raw_data, dict)
            ]

    async def count(self) -> int:
        async with AsyncSessionLocal() as session:
            statement = select(ScheduledTask.id)

            result = await session.execute(statement)

            return len(result.scalars().all())


scheduled_tasks_repository = ScheduledTasksRepository()