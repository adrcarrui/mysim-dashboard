from datetime import datetime

from pydantic import BaseModel


class Task(BaseModel):
    id: int
    task_id: str
    device: str
    description: str
    planned_date: datetime

    status_id: int
    status: str

    performed_by_id: int | None = None
    performance_remarks: str | None = None