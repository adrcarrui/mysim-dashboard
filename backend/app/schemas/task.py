from datetime import datetime

from pydantic import BaseModel


class Task(BaseModel):
    scheduled_task_id: int
    maintenance_task_id: int

    schedule_code: str

    device: str
    task_code: str

    device_id: int | None = None
    preventive_manual_version: str | None = None
    planning_category: str | None = None
    unknown_tolerance_reason: str | None = None

    description: str | None = None

    frequency_id: int | None = None
    frequency: str | None = None
    frequency_num_of_days: int | None = None

    planned_date: datetime

    tolerance_start: datetime | None = None
    tolerance_end: datetime | None = None
    tolerance_status: str | None = None

    status: str
    status_id: int

    remarks: str | None = None
    done_at: datetime | None = None
    performed_by: int | None = None
    performance_remarks: str | None = None
