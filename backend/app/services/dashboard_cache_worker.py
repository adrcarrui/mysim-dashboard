import asyncio
import logging
from collections.abc import Awaitable, Callable
from datetime import date, datetime, time, timedelta
from time import monotonic
from typing import Any

from app.config import settings
from app.services.availability_service import get_availability
from app.services.mysim_query_service import (
    begin_cache_trace,
    cached_mysim_client,
    get_cache_trace_metadata,
)


logger = logging.getLogger("uvicorn.error")


def _build_queries(
    today: date,
) -> list[tuple[str, str, str]]:
    start = today.isoformat()

    # Coincide con get_expiring_jobs(days=7).
    jobs_end = (
        today + timedelta(days=8)
    ).isoformat()

    actions_end = (
        today + timedelta(days=7)
    ).isoformat()

    return [
        (
            "Jobs abiertos",
            "Job",
            "t.closingDate IS NULL",
        ),
        (
            "Jobs proximos 7 dias",
            "Job",
            f"t.targetDate>='{start}' "
            f"AND t.targetDate<'{jobs_end}' "
            "AND t.closingDate IS NULL",
        ),
        (
            "Jobs vencidos",
            "Job",
            f"t.targetDate<'{start}' "
            "AND t.closingDate IS NULL",
        ),
        (
            "DRs abiertos",
            "Dr",
            "t.closingDate IS NULL "
            "ORDER BY t.reportedDate DESC",
        ),
        (
            "Actions proximos 7 dias",
            "action",
            f"t.date>='{start}' "
            f"AND t.date<'{actions_end}'",
        ),
    ]


async def _refresh_one(
    label: str,
    refresh: Callable[[], Awaitable[Any]],
) -> bool:
    started = monotonic()
    begin_cache_trace()

    try:
        await refresh()

        # El cliente puede devolver el respaldo si mySim falla.
        # En ese caso no contamos la consulta como renovada.
        if get_cache_trace_metadata()["stale"]:
            logger.warning(
                "DASHBOARD CACHE | %s | no se pudo renovar; "
                "se conserva el respaldo anterior",
                label,
            )
            return False

        logger.info(
            "DASHBOARD CACHE | %s | actualizado en %.2fs",
            label,
            monotonic() - started,
        )

        return True

    except asyncio.CancelledError:
        raise

    except Exception:
        logger.exception(
            "DASHBOARD CACHE | %s | actualizacion fallida",
            label,
        )
        return False


async def refresh_dashboard_cache() -> dict[str, bool]:
    today = date.today()
    results: dict[str, bool] = {}

    # Se ejecutan secuencialmente para limitar las
    # peticiones simultáneas a mySim.
    for label, entity, query in _build_queries(today):

        async def refresh_query(
            entity=entity,
            query=query,
        ):
            return await cached_mysim_client.get(
                entity=entity,
                extra_query=query,
                force_refresh=True,
            )

        results[label] = await _refresh_one(
            label,
            refresh_query,
        )

    # Coincide con el rango inicial de Availability:
    # hoy, inclusive, hasta mañana, exclusive.
    window_start = datetime.combine(
        today,
        time.min,
    )

    window_end = datetime.combine(
        today + timedelta(days=1),
        time.min,
    )

    async def refresh_availability():
        return await get_availability(
            window_start=window_start,
            window_end=window_end,
            force_refresh=True,
        )

    results["Disponibilidad de hoy"] = await _refresh_one(
        "Disponibilidad de hoy",
        refresh_availability,
    )

    return results


async def run_dashboard_cache_refresh() -> None:
    # Deja arrancar la aplicación antes de comenzar.
    await asyncio.sleep(
        settings.dashboard_cache_initial_delay_seconds
    )

    while True:
        started = monotonic()

        try:
            results = await refresh_dashboard_cache()

            logger.info(
                "DASHBOARD CACHE | ciclo terminado: "
                "%s/%s actualizadas",
                sum(results.values()),
                len(results),
            )

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "DASHBOARD CACHE | fallo del ciclo automatico"
            )

        remaining = max(
            1.0,
            settings.dashboard_cache_refresh_interval_seconds
            - (monotonic() - started),
        )

        await asyncio.sleep(remaining)