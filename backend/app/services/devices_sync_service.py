import asyncio
import logging

from app.config import settings
from app.services.devices_service import (
    devices_service,
)


logger = logging.getLogger(__name__)


async def run_devices_synchronization() -> None:
    while True:
        try:
            performed, count = (
                await devices_service
                .synchronize_if_stale()
            )

            if performed:
                logger.info(
                    "Devices synchronized from "
                    "mySim: %s",
                    count,
                )
            else:
                logger.info(
                    "Devices loaded from "
                    "PostgreSQL: %s",
                    count,
                )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Could not synchronize devices"
            )

        await asyncio.sleep(
            settings.devices_sync_interval_seconds
        )