import asyncio
from typing import Any

import pytest

import app.services.mysim_query_service as query_service


CACHED_RESPONSE = {"data": [{"id": 1, "name": "cached"}]}
MYSIM_RESPONSE = {"data": [{"id": 2, "name": "mysim"}]}


class FakeCacheRepository:
    def __init__(
        self,
        *,
        fresh: dict[str, Any] | None = None,
        stale: dict[str, Any] | None = None,
    ) -> None:
        self.fresh = fresh
        self.stale = stale
        self.fresh_calls = 0
        self.stale_calls = 0
        self.saved: list[dict[str, Any]] = []

    async def get_fresh(self, cache_key: str):
        self.fresh_calls += 1
        return self.fresh

    async def get_stale(self, cache_key: str):
        self.stale_calls += 1
        return self.stale

    async def save(self, **values: Any) -> None:
        self.saved.append(values)


class FakeMySimClient:
    def __init__(
        self,
        *,
        response: dict[str, Any] | None = MYSIM_RESPONSE,
        error: Exception | None = None,
    ) -> None:
        self.response = response
        self.error = error
        self.calls = 0

    async def get(
        self,
        *,
        entity: str,
        extra_query: str | None = None,
    ) -> dict[str, Any]:
        self.calls += 1
        if self.error is not None:
            raise self.error
        assert self.response is not None
        return self.response


def run(coroutine):
    return asyncio.run(coroutine)


async def get_with_metadata(client, *args, **kwargs):
    result = await client.get(*args, **kwargs)
    metadata = query_service.get_cache_trace_metadata()
    return result, metadata


def install_fakes(
    monkeypatch: pytest.MonkeyPatch,
    repository: FakeCacheRepository,
    mysim: FakeMySimClient,
) -> query_service.CachedMySimClient:
    monkeypatch.setattr(
        query_service,
        "mysim_query_cache_repository",
        repository,
    )
    monkeypatch.setattr(query_service, "mysim_client", mysim)
    query_service.begin_cache_trace()
    return query_service.CachedMySimClient()


def test_hit_returns_fresh_postgresql_cache(monkeypatch):
    repository = FakeCacheRepository(fresh=CACHED_RESPONSE)
    mysim = FakeMySimClient()
    client = install_fakes(monkeypatch, repository, mysim)

    result, metadata = run(
        get_with_metadata(client, "Job", "t.status<>14")
    )

    assert result == CACHED_RESPONSE
    assert repository.fresh_calls == 1
    assert repository.saved == []
    assert mysim.calls == 0
    assert metadata["status"] == "HIT"


def test_miss_fetches_mysim_and_saves_response(monkeypatch):
    repository = FakeCacheRepository()
    mysim = FakeMySimClient()
    client = install_fakes(monkeypatch, repository, mysim)

    result, metadata = run(
        get_with_metadata(
            client,
            "Job",
            "t.status<>14",
            ttl_seconds=120,
        )
    )

    assert result == MYSIM_RESPONSE
    assert repository.fresh_calls == 2
    assert mysim.calls == 1
    assert len(repository.saved) == 1
    assert repository.saved[0]["response"] == MYSIM_RESPONSE
    assert repository.saved[0]["ttl_seconds"] == 120
    assert metadata["status"] == "MISS"
    assert metadata["source"] == "mysim"
    assert metadata["stale"] is False


def test_force_refresh_bypasses_existing_cache(monkeypatch):
    repository = FakeCacheRepository(fresh=CACHED_RESPONSE)
    mysim = FakeMySimClient()
    client = install_fakes(monkeypatch, repository, mysim)

    result, metadata = run(
        get_with_metadata(client, "Job", force_refresh=True)
    )

    assert result == MYSIM_RESPONSE
    assert repository.fresh_calls == 0
    assert mysim.calls == 1
    assert len(repository.saved) == 1
    assert metadata["status"] == "MISS"


def test_stale_cache_is_returned_when_mysim_fails(monkeypatch):
    repository = FakeCacheRepository(stale=CACHED_RESPONSE)
    mysim = FakeMySimClient(error=ConnectionError("mySIM unavailable"))
    client = install_fakes(monkeypatch, repository, mysim)

    result, metadata = run(
        get_with_metadata(client, "Job", force_refresh=True)
    )

    assert result == CACHED_RESPONSE
    assert repository.fresh_calls == 0
    assert repository.stale_calls == 1
    assert repository.saved == []
    assert metadata["status"] == "STALE"
    assert metadata["source"] == "postgresql"
    assert metadata["stale"] is True


def test_original_error_is_raised_without_stale_cache(monkeypatch):
    repository = FakeCacheRepository()
    mysim = FakeMySimClient(error=ConnectionError("mySIM unavailable"))
    client = install_fakes(monkeypatch, repository, mysim)

    with pytest.raises(ConnectionError, match="mySIM unavailable"):
        run(client.get("Job", force_refresh=True))

    assert repository.stale_calls == 1
    assert repository.saved == []
