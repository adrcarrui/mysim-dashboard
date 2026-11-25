import asyncio
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.services.task_duration_rules import get_task_duration
from app.services import tasks_service


@pytest.mark.parametrize(
    ("device_id", "device", "issue", "task_id", "code", "minutes", "annex"),
    [
        (1, "CN235", "L", "CN235-000828", "000828", 480, "IV"),
        (2, "C295", "N", "C295-00200", "00200", 480, "V"),
        (10, "A400M", "Issue E (30/06/2026)", None, "2.1", 10, "VI"),
        (None, "GEN", "AA", "GEN-00333", "00333", 30, "VII"),
        (16, "MRTT", "I", None, "1.1", 30, "XIX"),
        (21, "C295 TS03", "E", "MP-FFSC295-TS03-000743", "000743", 120, "XXVIII"),
    ],
)
def test_documented_minutes_for_each_annex(device_id, device, issue, task_id, code, minutes, annex):
    result, source = get_task_duration(
        device_id=device_id, device=device, manual_version=issue,
        task_id=task_id, task_code=code, estimated_time="00:01",
    )
    assert result == minutes
    assert f"Anexo {annex} ·" in source


@pytest.mark.parametrize(
    ("device_id", "device", "issue", "code", "estimated", "result"),
    [
        (21, "C295 TS03", "F", "4.1", "01:15:00", (75, "mySim · estimatedTime")),
        (21, "C295 TS03", "E", "00200", None, (None, None)),
        (10, "A400M", "E", "7.2", None, (None, None)),
        (16, "MRTT", "I", "4.6", None, (None, None)),
        (None, "GEN", "AA", "00204", "00:00", (None, None)),
        (None, "GEN", "AA", "000", 30, (None, None)),
    ],
)
def test_no_automatic_duration_for_unusable_rows(device_id, device, issue, code, estimated, result):
    assert get_task_duration(
        device_id=device_id, device=device, manual_version=issue,
        task_id=None, task_code=code, estimated_time=estimated,
    ) == result


def test_upcoming_tasks_exposes_duration_without_changing_frequency(monkeypatch):
    monkeypatch.setattr(tasks_service.scheduled_tasks_repository, "get_open_until", AsyncMock(
        return_value=[{
            "id": 1001, "task": 2001, "status": 199,
            "scheduleTaskCod": "2026-11-295-00200",
            "plannedDate": datetime.now().strftime("%Y-%m-%d"),
        }],
    ))
    monkeypatch.setattr(tasks_service.maintenance_tasks_service, "get_many", AsyncMock(
        return_value={2001: {
            "device": 2, "frequency": 3001, "taskId": "295-00200",
            "preventiveManualVersion": "N",
        }},
    ))
    monkeypatch.setattr(tasks_service.task_frequencies_service, "get_many", AsyncMock(
        return_value={3001: {"name": "28 days", "num_of_days": 28}},
    ))

    [task] = asyncio.run(tasks_service.get_upcoming_tasks())
    assert task.estimated_duration_minutes == 480
    assert "Anexo V" in task.duration_reference
    assert task.frequency == "28 days"
    assert task.frequency_num_of_days == 28
