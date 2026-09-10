import asyncio

import app.services.health_service as health_service


def run(coroutine):
    return asyncio.run(coroutine)


def database_result(status: str):
    return {
        "status": status,
        "responseTimeMs": 1.25,
        "cache": {
            "activeEntries": 12 if status == "connected" else None,
            "expiredEntries": 2 if status == "connected" else None,
        },
    }


def mysim_result(status: str):
    return {
        "status": status,
        "httpStatus": 200 if status == "available" else None,
        "responseTimeMs": 2.5,
    }


def install_checks(monkeypatch, *, database_status, mysim_status):
    async def fake_database():
        return database_result(database_status)

    async def fake_mysim():
        return mysim_result(mysim_status)

    monkeypatch.setattr(health_service, "check_database", fake_database)
    monkeypatch.setattr(health_service, "check_mysim", fake_mysim)


def test_health_is_ok_when_database_and_mysim_are_available(monkeypatch):
    install_checks(
        monkeypatch,
        database_status="connected",
        mysim_status="available",
    )

    result = run(health_service.get_health())

    assert result["status"] == "ok"
    assert result["database"]["status"] == "connected"
    assert result["mysim"]["status"] == "available"
    assert result["cache"] == {
        "activeEntries": 12,
        "expiredEntries": 2,
    }


def test_health_is_degraded_when_only_mysim_is_unavailable(monkeypatch):
    install_checks(
        monkeypatch,
        database_status="connected",
        mysim_status="unavailable",
    )

    result = run(health_service.get_health())

    assert result["status"] == "degraded"
    assert result["database"]["status"] == "connected"
    assert result["mysim"]["status"] == "unavailable"


def test_health_is_error_when_database_is_disconnected(monkeypatch):
    install_checks(
        monkeypatch,
        database_status="disconnected",
        mysim_status="available",
    )

    result = run(health_service.get_health())

    assert result["status"] == "error"
    assert result["database"]["status"] == "disconnected"
    assert result["cache"] == {
        "activeEntries": None,
        "expiredEntries": None,
    }
