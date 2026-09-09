import asyncio
import hashlib
import json
import logging
from time import perf_counter
from typing import Any

from app.config import settings
from app.repositories.mysim_query_cache_repository import (
    mysim_query_cache_repository,
)
from app.services.mysim_client import mysim_client


logger = logging.getLogger(__name__)


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
    ) -> dict[str, Any]:
        total_started_at = perf_counter()
        cache_key = self._build_cache_key(
            entity=entity,
            extra_query=extra_query,
        )

        cache_started_at = perf_counter()
        cached = await (
            mysim_query_cache_repository
            .get_fresh(cache_key)
        )
        cache_seconds = perf_counter() - cache_started_at

        if cached is not None:
            logger.info(
                "mySim CACHE HIT | entity=%s | "
                "postgres=%.3fs | total=%.3fs",
                entity,
                cache_seconds,
                perf_counter() - total_started_at,
            )
            return cached

        lock = self._locks.setdefault(
            cache_key,
            asyncio.Lock(),
        )

        async with lock:
            cache_started_at = perf_counter()
            cached = await (
                mysim_query_cache_repository
                .get_fresh(cache_key)
            )
            cache_seconds = (
                perf_counter() - cache_started_at
            )

            if cached is not None:
                logger.info(
                    "mySim CACHE HIT AFTER LOCK | "
                    "entity=%s | postgres=%.3fs | "
                    "total=%.3fs",
                    entity,
                    cache_seconds,
                    perf_counter() - total_started_at,
                )
                return cached

            logger.info(
                "mySim CACHE MISS | entity=%s | "
                "postgres=%.3fs",
                entity,
                cache_seconds,
            )

            try:
                mysim_started_at = perf_counter()
                response = await mysim_client.get(
                    entity=entity,
                    extra_query=extra_query,
                )
                mysim_seconds = (
                    perf_counter() - mysim_started_at
                )

                save_started_at = perf_counter()
                await (
                    mysim_query_cache_repository
                    .save(
                        cache_key=cache_key,
                        entity=entity,
                        extra_query=extra_query,
                        response=response,
                        ttl_seconds=(
                            ttl_seconds
                            or settings
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
                    entity,
                    mysim_seconds,
                    save_seconds,
                    perf_counter() - total_started_at,
                )

                return response

            except Exception:
                stale = await (
                    mysim_query_cache_repository
                    .get_stale(cache_key)
                )

                if stale is not None:
                    logger.warning(
                        "mySim STALE CACHE | entity=%s | "
                        "total=%.3fs",
                        entity,
                        perf_counter() - total_started_at,
                    )
                    return stale

                raise


cached_mysim_client = CachedMySimClient()