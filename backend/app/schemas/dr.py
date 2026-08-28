from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DrOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int

    dr_id: str | None = None

    reported_date: datetime | None = None
    closing_date: datetime | None = None

    customer_description: str | None = None
    fault_description: str | None = None

    detected_by_id: int | None = None
    repetitions: int | None = None

    manufacturer_id_number: str | None = None
    ata: int | None = None

    close_remarks: str | None = None
    root_cause_analysis: str | None = None

    not_our: bool | None = None

    priority_id: int | None = None
    status_id: int | None = None
    severity_id: int | None = None

    affected_system_id: int | None = None

    device_id: int | None = None
    device_name: str | None = None

    last_updated: datetime | None = None