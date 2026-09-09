import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.device import MySimEntityCache
from app.services.maintenance_tasks_service import (
    maintenance_tasks_service,
)
from app.services.task_frequencies_service import (
    task_frequencies_service,
)


logger = logging.getLogger(__name__)


async def is_entity_stale(
    entity: str,
) -> bool:
    async with AsyncSessionLocal() as session:
        statement = (
            select(MySimEntityCache.synced_at)
            .where(
                MySimEntityCache.entity == entity
            )
        )

        last_sync = await session.scalar(
            statement
        )

    if last_sync is None:
        return True

    if last_sync.tzinfo is None:
        last_sync = last_sync.replace(
            tzinfo=timezone.utc
        )

    maximum_age = timedelta(
        seconds=(
            settings
            .reference_data_sync_interval_seconds
        )
    )

    return (
        datetime.now(timezone.utc) - last_sync
        >= maximum_age
    )


async def synchronize_if_stale(
    *,
    entity: str,
    synchronizer: Callable[
        [],
        Awaitable[int],
    ],
) -> None:
    if not await is_entity_stale(entity):
        logger.info(
            "%s is up to date in PostgreSQL",
            entity,
        )
        return

    count = await synchronizer()

    logger.info(
        "%s synchronized from mySim: %s",
        entity,
        count,
    )


async def run_reference_data_synchronization() -> None:
    while True:
        try:
            await synchronize_if_stale(
                entity="TaskFrequency",
                synchronizer=(
                    task_frequencies_service
                    .synchronize
                ),
            )

            await synchronize_if_stale(
                entity="maintenanceTask",
                synchronizer=(
                    maintenance_tasks_service
                    .synchronize
                ),
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Could not synchronize "
                "reference data"
            )

        await asyncio.sleep(
            settings
            .reference_data_sync_interval_seconds
        )