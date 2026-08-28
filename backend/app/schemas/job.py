from datetime import datetime

from pydantic import BaseModel


class Job(BaseModel):
    id: int
    job_number: str

    target_date: datetime | None = None

    description: str | None = None
    alias: str | None = None

    device_id: int | None = None
    priority_id: int | None = None
    status_id: int | None = None

    assigned_to_id: int | None = None

    related_maintenance_task_id: int | None = None