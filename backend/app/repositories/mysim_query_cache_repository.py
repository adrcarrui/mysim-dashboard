from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.database import AsyncSessionLocal
from app.models.mysim_query_cache import (
    MySimQueryCache,
)


class MySimQueryCacheRepository:
    async def get_fresh(
        self,
        cache_key: str,
    ) -> dict[str, Any] | None:
        async with AsyncSessionLocal() as session:
            statement = (
                select(MySimQueryCache.raw_response)
                .where(
                    MySimQueryCache.cache_key
                    == cache_key,
                    MySimQueryCache.expires_at
                    > func.now(),
                )
            )

            return await session.scalar(statement)

    async def get_stale(
        self,
        cache_key: str,
    ) -> dict[str, Any] | None:
        async with AsyncSessionLocal() as session:
            statement = (
                select(MySimQueryCache.raw_response)
                .where(
                    MySimQueryCache.cache_key
                    == cache_key
                )
            )

            return await session.scalar(statement)

    async def save(
        self,
        *,
        cache_key: str,
        entity: str,
        extra_query: str | None,
        response: dict[str, Any],
        ttl_seconds: int,
    ) -> None:
        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(seconds=ttl_seconds)
        )

        async with AsyncSessionLocal() as session:
            async with session.begin():
                statement = (
                    insert(MySimQueryCache)
                    .values(
                        cache_key=cache_key,
                        entity=entity,
                        extra_query=extra_query,
                        raw_response=response,
                        expires_at=expires_at,
                    )
                )

                statement = (
                    statement.on_conflict_do_update(
                        index_elements=[
                            MySimQueryCache.cache_key
                        ],
                        set_={
                            "entity": (
                                statement.excluded.entity
                            ),
                            "extra_query": (
                                statement
                                .excluded
                                .extra_query
                            ),
                            "raw_response": (
                                statement
                                .excluded
                                .raw_response
                            ),
                            "expires_at": (
                                statement
                                .excluded
                                .expires_at
                            ),
                            "updated_at": func.now(),
                        },
                    )
                )

                await session.execute(statement)


mysim_query_cache_repository = (
    MySimQueryCacheRepository()
)