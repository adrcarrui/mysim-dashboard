import asyncio
import logging
from datetime import date, datetime
from typing import Any

from app.repositories.scheduled_tasks_repository import (
    scheduled_tasks_repository,
)
from app.services.mysim_client import mysim_client


logger = logging.getLogger(__name__)

MAX_SYNC_DAYS = 62


class ScheduledTasksSyncService:
    def __init__(self) -> None:
        self._sync_lock = asyncio.Lock()

    @staticmethod
    def _extract_rows(
        response: dict[str, Any],
    ) -> list[dict[str, Any]]:
        data = response.get("data")

        if not isinstance(data, dict):
            raise RuntimeError(
                "mySim returned an invalid scheduledTasks response"
            )

        rows = data.get("data")

        if not isinstance(rows, list):
            raise RuntimeError(
                "mySim returned an invalid scheduledTasks row list"
            )

        if not all(isinstance(row, dict) for row in rows):
            raise RuntimeError(
                "mySim returned a malformed scheduledTasks row"
            )

        return rows

    @staticmethod
    def _parse_datetime(
        value: Any,
        *,
        field_name: str,
        required: bool = False,
    ) -> datetime | None:
        if value in (None, ""):
            if required:
                raise ValueError(
                    f"Missing required field: {field_name}"
                )

            return None

        if not isinstance(value, str):
            raise ValueError(
                f"Invalid {field_name}: {value!r}"
            )

        normalized = value.strip()

        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"

        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError(
                f"Invalid {field_name}: {value!r}"
            ) from exc

        # mySim planned dates follow the existing convention:
        # local time without timezone.
        if parsed.tzinfo is not None:
            parsed = parsed.replace(tzinfo=None)

        return parsed

    @staticmethod
    def _optional_int(
        value: Any,
        *,
        field_name: str,
    ) -> int | None:
        if value in (None, ""):
            return None

        if isinstance(value, bool):
            raise ValueError(
                f"Invalid {field_name}: {value!r}"
            )

        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Invalid {field_name}: {value!r}"
            ) from exc

    @staticmethod
    def _required_int(
        row: dict[str, Any],
        field_name: str,
    ) -> int:
        value = ScheduledTasksSyncService._optional_int(
            row.get(field_name),
            field_name=field_name,
        )

        if value is None:
            raise ValueError(
                f"Missing required field: {field_name}"
            )

        return value

    @staticmethod
    def _to_bool(
        value: Any,
        *,
        default: bool,
    ) -> bool:
        if value is None:
            return default

        if isinstance(value, bool):
            return value

        if isinstance(value, int):
            return value != 0

        if isinstance(value, str):
            normalized = value.strip().lower()

            if normalized in {"1", "true", "yes"}:
                return True

            if normalized in {"0", "false", "no"}:
                return False

        raise ValueError(
            f"Invalid boolean value: {value!r}"
        )

    @classmethod
    def _to_values(
        cls,
        row: dict[str, Any],
        *,
        period_start: date,
        period_end: date,
    ) -> dict[str, Any]:
        schedule_code = row.get("scheduleTaskCod")

        if not isinstance(schedule_code, str):
            raise ValueError(
                "Missing required field: scheduleTaskCod"
            )

        schedule_code = schedule_code.strip()

        if not schedule_code:
            raise ValueError(
                "Empty required field: scheduleTaskCod"
            )

        planned_date = cls._parse_datetime(
            row.get("plannedDate"),
            field_name="plannedDate",
            required=True,
        )

        if planned_date is None:
            raise ValueError(
                "Missing required field: plannedDate"
            )

        if not (
            period_start
            <= planned_date.date()
            < period_end
        ):
            raise ValueError(
                "mySim returned a scheduled task outside "
                f"the requested period: {planned_date!s}"
            )

        return {
            "mysim_id": cls._required_int(
                row,
                "id",
            ),
            "maintenance_task_id": cls._required_int(
                row,
                "task",
            ),
            "schedule_code": schedule_code,
            "planned_date": planned_date,
            "status_id": cls._optional_int(
                row.get("status"),
                field_name="status",
            ),
            "remarks": row.get("remarksInfo"),
            "done_at": cls._parse_datetime(
                row.get("doneAt"),
                field_name="doneAt",
            ),
            "performed_by_id": cls._optional_int(
                row.get("performedBy"),
                field_name="performedBy",
            ),
            "performance_remarks": row.get(
                "performanceRemarks"
            ),
            # La consulta ya exige enabled=1 y deleted=0.
            "enabled": cls._to_bool(
                row.get("enabled"),
                default=True,
            ),
            "deleted": cls._to_bool(
                row.get("deleted"),
                default=False,
            ),
            "raw_data": row,
            "is_present_in_mysim": True,
        }

    async def synchronize_period(
        self,
        *,
        period_start: date,
        period_end: date,
    ) -> int:
        if period_end <= period_start:
            raise ValueError(
                "period_end must be after period_start"
            )

        period_days = (
            period_end - period_start
        ).days

        if period_days > MAX_SYNC_DAYS:
            raise ValueError(
                f"A synchronization period cannot exceed "
                f"{MAX_SYNC_DAYS} days"
            )

        async with self._sync_lock:
            await (
                scheduled_tasks_repository
                .mark_period_running(
                    period_start=period_start,
                    period_end=period_end,
                )
            )

            try:
                query = (
                    "t.entity='MaintenanceSchedule' "
                    "AND t.idCol=34 "
                    "AND t.deleted=0 "
                    "AND t.enabled=1 "
                    f"AND t.plannedDate>="
                    f"'{period_start.isoformat()}' "
                    f"AND t.plannedDate<"
                    f"'{period_end.isoformat()}'"
                )

                logger.info(
                    "Synchronizing scheduled tasks: %s",
                    query,
                )

                response = await mysim_client.get(
                    entity="scheduledTasks",
                    extra_query=query,
                )

                status = response.get("status")

                if status == 200:
                    rows = self._extract_rows(response)

                elif (
                    status == 404
                    and response.get("msg") == "No data!"
                    and response.get("data") == []
                ):
                    rows = []

                    logger.info(
                        "No scheduled tasks for period: %s - %s",
                        period_start,
                        period_end,
                    )

                else:
                    raise RuntimeError(
                        "Could not retrieve scheduledTasks from mySim"
                    )

                values = [
                    self._to_values(
                        row,
                        period_start=period_start,
                        period_end=period_end,
                    )
                    for row in rows
                ]

                synchronized = await (
                    scheduled_tasks_repository
                    .synchronize_period(
                        period_start=period_start,
                        period_end=period_end,
                        tasks=values,
                    )
                )

                logger.info(
                    "Scheduled task period synchronized: "
                    "%s - %s (%s rows)",
                    period_start,
                    period_end,
                    synchronized,
                )

                return synchronized

            except Exception as exc:
                try:
                    await (
                        scheduled_tasks_repository
                        .mark_period_failed(
                            period_start=period_start,
                            period_end=period_end,
                            error_message=str(exc)[:2000],
                        )
                    )
                except Exception:
                    logger.exception(
                        "Could not mark scheduled task "
                        "period as failed"
                    )

                raise

    async def synchronize_month(
        self,
        *,
        year: int,
        month: int,
    ) -> int:
        period_start = date(
            year,
            month,
            1,
        )

        if month == 12:
            period_end = date(
                year + 1,
                1,
                1,
            )
        else:
            period_end = date(
                year,
                month + 1,
                1,
            )

        return await self.synchronize_period(
            period_start=period_start,
            period_end=period_end,
        )

    @staticmethod
    def _get_month_period(
        *,
        reference_date: date,
        month_offset: int,
    ) -> tuple[date, date]:
        month_index = (
            reference_date.year * 12
            + reference_date.month
            - 1
            + month_offset
        )

        year, zero_based_month = divmod(
            month_index,
            12,
        )

        month = zero_based_month + 1

        period_start = date(
            year,
            month,
            1,
        )

        if month == 12:
            period_end = date(
                year + 1,
                1,
                1,
            )
        else:
            period_end = date(
                year,
                month + 1,
                1,
            )

        return (
            period_start,
            period_end,
        )

    async def synchronize_around_today(
        self,
    ) -> int:
        today = date.today()
        synchronized = 0

        # Mes anterior, mes actual y dos meses futuros.
        for month_offset in (
            -1,
            0,
            1,
            2,
        ):
            (
                period_start,
                period_end,
            ) = self._get_month_period(
                reference_date=today,
                month_offset=month_offset,
            )

            synchronized += (
                await self.synchronize_period(
                    period_start=period_start,
                    period_end=period_end,
                )
            )

        return synchronized

scheduled_tasks_sync_service = (
    ScheduledTasksSyncService()
)