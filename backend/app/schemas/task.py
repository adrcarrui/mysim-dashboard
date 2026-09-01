from datetime import datetime

from pydantic import BaseModel


class Task(BaseModel):
    scheduled_task_id: int
    maintenance_task_id: int

    schedule_code: str

    device: str
    task_code: str

    description: str | None = None

    planned_date: datetime

    status: str
    status_id: int

    remarks: str | None = None
    done_at: datetime | None = None
    performed_by: int | None = None
    performance_remarks: str | None = None