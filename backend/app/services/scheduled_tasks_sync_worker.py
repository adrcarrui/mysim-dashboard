import asyncio
import logging
from time import monotonic

from app.config import settings
from app.services.scheduled_tasks_sync_service import (
    scheduled_tasks_sync_service,
)


logger = logging.getLogger(__name__)


async def run_scheduled_tasks_synchronization() -> None:
    # Evita lanzar simultáneamente todas las
    # sincronizaciones durante el arranque.
    await asyncio.sleep(
        settings
        .scheduled_tasks_initial_delay_seconds
    )

    while True:
        started_at = monotonic()

        try:
            synchronized = await (
                scheduled_tasks_sync_service
                .synchronize_around_today()
            )

            logger.info(
                "Scheduled tasks synchronized "
                "automatically: %s rows",
                synchronized,
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Automatic scheduled task "
                "synchronization failed"
            )

        elapsed = (
            monotonic() - started_at
        )

        remaining = max(
            1,
            (
                settings
                .scheduled_tasks_sync_interval_seconds
                - elapsed
            ),
        )

        await asyncio.sleep(
            remaining
        )