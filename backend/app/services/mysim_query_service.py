import asyncio
import hashlib
import json
import logging
from contextvars import ContextVar
from datetime import datetime, timezone
from time import perf_counter
from collections.abc import Awaitable, Callable
from typing import Any

from app.config import settings
from app.repositories.mysim_query_cache_repository import (
    mysim_query_cache_repository,
)
from app.services.mysim_client import mysim_client


logger = logging.getLogger(__name__)

_cache_events: ContextVar[tuple[str, ...]] = ContextVar("mysim_cache_events", default=())


def begin_cache_trace() -> None:
    _cache_events.set(())


def _record_cache_event(status: str) -> None:
    _cache_events.set((*_cache_events.get(), status))


def get_cache_trace_metadata() -> dict[str, Any]:
    events = _cache_events.get()
    if "STALE" in events:
        status, source, stale = "STALE", "postgresql", True
    elif "MISS" in events:
        status, source, stale = "MISS", "mysim", False
    else:
        status, source, stale = "HIT", "postgresql", False

    return {
        "status": status,
        "source": source,
        "stale": stale,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }


class CachedMySimClient:
    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def _build_cache_key(
        *,
        entity: str,
        extra_query: str | None,
    ) -> str:
        value = json.dumps(
            {
                "entity": entity,
                "extra_query": extra_query,
            },
            sort_keys=True,
            ensure_ascii=False,
        )

        return hashlib.sha256(
            value.encode("utf-8")
        ).hexdigest()

    async def get(
        self,
        entity: str,
        extra_query: str | None = None,
        ttl_seconds: int | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        return await self._get_cached(
            cache_entity=entity,
            cache_query=extra_query,
            ttl_seconds=ttl_seconds,
            force_refresh=force_refresh,
            fetch=lambda: mysim_client.get(
                entity=entity,
                extra_query=extra_query,
            ),
        )

    async def get_datatable(
        self,
        entity: str,
        *,
        params: dict[str, Any],
        ttl_seconds: int | None = None,
        force_refresh: bool = False,
    ) -> dict[str, Any]:
        cache_entity = f"datatable:{entity}"
        cache_query = json.dumps(
            params,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        )

        return await self._get_cached(
            cache_entity=cache_entity,
            cache_query=cache_query,
            ttl_seconds=ttl_seconds,
            force_refresh=force_refresh,
            fetch=lambda: mysim_client.get_datatable(
                entity,
                params=params,
            ),
        )

    async def _get_cached(
        self,
        *,
        cache_entity: str,
        cache_query: str | None,
        ttl_seconds: int | None,
        force_refresh: bool,
        fetch: Callable[
            [],
            Awaitable[dict[str, Any]],
        ],
    ) -> dict[str, Any]:
        total_started_at = perf_counter()
        cache_key = self._build_cache_key(
            entity=cache_entity,
            extra_query=cache_query,
        )

        if not force_refresh:
            cache_started_at = perf_counter()
            cached = await (
                mysim_query_cache_repository
                .get_fresh(cache_key)
            )
            cache_seconds = (
                perf_counter() - cache_started_at
            )

            if cached is not None:
                _record_cache_event("HIT")
                logger.info(
                    "mySim CACHE HIT | entity=%s | "
                    "postgres=%.3fs | total=%.3fs",
                    cache_entity,
                    cache_seconds,
                    perf_counter() - total_started_at,
                )
                return cached
        else:
            logger.info(
                "mySim CACHE BYPASS | entity=%s",
                cache_entity,
            )

        lock = self._locks.setdefault(
            cache_key,
            asyncio.Lock(),
        )

        async with lock:
            if not force_refresh:
                cache_started_at = perf_counter()
                cached = await (
                    mysim_query_cache_repository
                    .get_fresh(cache_key)
                )
                cache_seconds = (
                    perf_counter() - cache_started_at
                )

                if cached is not None:
                    _record_cache_event("HIT")
                    logger.info(
                        "mySim CACHE HIT AFTER LOCK | "
                        "entity=%s | postgres=%.3fs | "
                        "total=%.3fs",
                        cache_entity,
                        cache_seconds,
                        perf_counter() - total_started_at,
                    )
                    return cached

                logger.info(
                    "mySim CACHE MISS | entity=%s | "
                    "postgres=%.3fs",
                    cache_entity,
                    cache_seconds,
                )

            try:
                mysim_started_at = perf_counter()
                response = await fetch()
                mysim_seconds = (
                    perf_counter() - mysim_started_at
                )

                save_started_at = perf_counter()
                await (
                    mysim_query_cache_repository
                    .save(
                        cache_key=cache_key,
                        entity=cache_entity,
                        extra_query=cache_query,
                        response=response,
                        ttl_seconds=(
                            ttl_seconds
                            if ttl_seconds is not None
                            else settings
                            .dynamic_query_cache_seconds
                        ),
                    )
                )
                save_seconds = (
                    perf_counter() - save_started_at
                )

                logger.info(
                    "mySim CACHE STORED | entity=%s | "
                    "mysim=%.3fs | postgres_save=%.3fs | "
                    "total=%.3fs",
                    cache_entity,
                    mysim_seconds,
                    save_seconds,
                    perf_counter() - total_started_at,
                )

                _record_cache_event("MISS")

                return response

            except Exception:
                stale = await (
                    mysim_query_cache_repository
                    .get_stale(cache_key)
                )

                if stale is not None:
                    _record_cache_event("STALE")
                    logger.warning(
                        "mySim STALE CACHE | entity=%s | "
                        "total=%.3fs",
                        cache_entity,
                        perf_counter() - total_started_at,
                    )
                    return stale

                raise


cached_mysim_client = CachedMySimClient()
