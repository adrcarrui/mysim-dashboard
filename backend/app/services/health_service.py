import asyncio
from datetime import datetime, timezone
from time import perf_counter
from typing import Any

import httpx
from sqlalchemy import func, select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.mysim_query_cache import MySimQueryCache
from app.services.mysim_client import mysim_client


async def check_database() -> dict[str, Any]:
    started_at = perf_counter()

    try:
        async with AsyncSessionLocal() as session:
            active_statement = select(
                func.count(MySimQueryCache.cache_key)
            ).where(MySimQueryCache.expires_at > func.now())

            expired_statement = select(
                func.count(MySimQueryCache.cache_key)
            ).where(MySimQueryCache.expires_at <= func.now())

            active_entries = await session.scalar(active_statement)
            expired_entries = await session.scalar(expired_statement)

        return {
            "status": "connected",
            "responseTimeMs": round(
                (perf_counter() - started_at) * 1000,
                2,
            ),
            "cache": {
                "activeEntries": active_entries or 0,
                "expiredEntries": expired_entries or 0,
            },
        }
    except Exception as exc:
        return {
            "status": "disconnected",
            "responseTimeMs": round(
                (perf_counter() - started_at) * 1000,
                2,
            ),
            "error": type(exc).__name__,
            "cache": {
                "activeEntries": None,
                "expiredEntries": None,
            },
        }


async def check_mysim() -> dict[str, Any]:
    started_at = perf_counter()

    try:
        timeout = httpx.Timeout(
            settings.health_mysim_timeout_seconds
        )

        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
        ) as client:
            response = await client.get(
                mysim_client.site_base_url,
            )

        if response.status_code >= 500:
            raise RuntimeError(
                f"mySIM returned HTTP {response.status_code}"
            )

        return {
            "status": "available",
            "httpStatus": response.status_code,
            "responseTimeMs": round(
                (perf_counter() - started_at) * 1000,
                2,
            ),
        }
    except Exception as exc:
        return {
            "status": "unavailable",
            "httpStatus": None,
            "responseTimeMs": round(
                (perf_counter() - started_at) * 1000,
                2,
            ),
            "error": type(exc).__name__,
        }


async def get_health() -> dict[str, Any]:
    database, mysim = await asyncio.gather(
        check_database(),
        check_mysim(),
    )

    if database["status"] != "connected":
        status = "error"
    elif mysim["status"] != "available":
        status = "degraded"
    else:
        status = "ok"

    return {
        "status": status,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "database": {
            key: value
            for key, value in database.items()
            if key != "cache"
        },
        "mysim": mysim,
        "cache": database["cache"],
    }
