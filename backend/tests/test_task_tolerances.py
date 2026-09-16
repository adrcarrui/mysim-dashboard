import asyncio
from datetime import datetime, timedelta
import pytest
from app.services.task_tolerance_rules import (
    get_documented_window, get_documented_tolerance, get_planning_category,
)


@pytest.mark.parametrize('frequency,days', [
    ('Weekly',1),('Biweekly',2),('Monthly',7),('Quarterly',21),
    ('SemiAnnual',28),('Annual',35),('10 Years',35),
])
def test_documented_tolerances(frequency, days):
    assert get_documented_tolerance(device_id=10, manual_version='Issue E (30-06-2026)',
                                    frequency=frequency) == timedelta(days=days)


@pytest.mark.parametrize('device,issue,frequency', [
    (5,'AA','Monthly'),(1,'H','Monthly'),(10,None,'Monthly'),
    (1,'L','28 days'),(10,'E','28 days'),(21,'E','Special'),
    (21,'E','By planning'),(16,'I','18 months'),
])
def test_unvalidated_rules_remain_unknown(device,issue,frequency):
    assert get_documented_tolerance(device_id=device,manual_version=issue,
                                    frequency=frequency) is None


def test_ts03_28_days():
    assert get_documented_tolerance(device_id=21,manual_version='E',
                                    frequency='28 days') == timedelta(days=2)


@pytest.mark.parametrize('now,expected', [
    ('2026-09-14 12:00:00','upcoming'), ('2026-09-15 20:00:00','today'),
    ('2026-09-16 00:00:00','backlog'),('2026-09-22 23:59:59','backlog'),
    ('2026-09-23 00:00:00','out_of_tolerance'),
])
def test_monthly_category_boundaries(now,expected):
    planned=datetime(2026,9,15)
    _,end=get_documented_window(planned_date=planned,device_id=1,
                                manual_version='L',frequency='Monthly')
    assert get_planning_category(now=datetime.fromisoformat(now),planned_date=planned,
                                 tolerance_end=end,frequency='Monthly') == expected


def test_daily_hours_and_missing_time():
    planned=datetime(2026,9,15,8)
    start,end=get_documented_window(planned_date=planned,device_id=1,
                                    manual_version='L',frequency='Daily')
    assert start == planned-timedelta(hours=12)
    assert end == planned+timedelta(hours=12)
    assert get_planning_category(now=planned+timedelta(hours=1),planned_date=planned,
                                 tolerance_end=end,frequency='Daily') == 'backlog'
    assert get_documented_window(planned_date=planned,device_id=1,
        manual_version='L',frequency='Daily',has_planned_time=False) == (None,None)


def test_service_reads_local_tasks_and_respects_horizon(
    monkeypatch,
):
    import app.services.tasks_service as service

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls):
            return cls(
                2026,
                9,
                15,
                12,
            )

    monkeypatch.setattr(
        service,
        "datetime",
        FrozenDatetime,
    )

    rows = []

    for index, day, status in [
        (2, "2026-09-14", 200),
        (3, "2026-09-15", 199),
        (4, "2026-09-18", 199),
        (5, "2026-09-30", 199),
        (6, "2025-01-01", 201),
        (7, "2026-09-19", 2542),
    ]:
        rows.append(
            {
                "id": index,
                "task": 100,
                "scheduleTaskCod": (
                    f"{index}-2026-CN235-001"
                ),
                "plannedDate": day,
                "status": status,
            }
        )

    requested_end_dates = []

    async def get_open_until(
        *,
        end_date,
    ):
        requested_end_dates.append(
            end_date
        )

        return rows

    async def details(ids):
        assert ids == {100}

        return {
            100: {
                "device": 1,
                "preventiveManualVersion": "L",
                "frequency": 3,
                "task": "Check",
            }
        }

    async def frequencies(ids):
        assert ids == {3}

        return {
            3: {
                "name": "Weekly",
                "num_of_days": 7,
            }
        }

    monkeypatch.setattr(
        service
        .scheduled_tasks_repository,
        "get_open_until",
        get_open_until,
    )

    monkeypatch.setattr(
        service
        .maintenance_tasks_service,
        "get_many",
        details,
    )

    monkeypatch.setattr(
        service
        .task_frequencies_service,
        "get_many",
        frequencies,
    )

    tasks = asyncio.run(
        service.get_upcoming_tasks(
            days=3,
        )
    )

    categories = {
        task.scheduled_task_id: (
            task.planning_category
        )
        for task in tasks
    }

    assert categories == {
        2: "backlog",
        3: "today",
        4: "upcoming",
        7: "upcoming",
    }

    # La tarea 7 queda fuera por planned_date,
    # pero entra porque su tolerancia comienza
    # dentro del horizonte de tres días.
    assert [
        task.scheduled_task_id
        for task in tasks
    ] == [
        2,
        3,
        4,
        7,
    ]

    tasks = asyncio.run(
        service.get_upcoming_tasks(
            days=1,
        )
    )

    assert {
        task.scheduled_task_id
        for task in tasks
    } == {
        2,
        3,
    }

    assert requested_end_dates == [
        datetime(
            2026,
            10,
            24,
        ),
        datetime(
            2026,
            10,
            22,
        ),
    ]


def test_service_propagates_repository_error(
    monkeypatch,
):
    import app.services.tasks_service as service

    async def get_open_until(
        *,
        end_date,
    ):
        raise RuntimeError(
            "PostgreSQL unavailable"
        )

    monkeypatch.setattr(
        service
        .scheduled_tasks_repository,
        "get_open_until",
        get_open_until,
    )

    with pytest.raises(
        RuntimeError,
        match="PostgreSQL unavailable",
    ):
        asyncio.run(
            service.get_upcoming_tasks()
        )