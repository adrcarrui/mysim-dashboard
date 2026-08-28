from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DrOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int

    drId: str | None = None

    reportedDate: datetime | None = None
    closingDate: datetime | None = None

    customerDescription: str | None = None
    faultDescription: str | None = None

    detectedBy: int | None = None
    repetitions: int | None = None

    manufacturerIdNumber: str | None = None
    ata: int | None = None

    closeRemarks: str | None = None
    rootCauseAnalysis: str | None = None

    notOur: bool | None = None

    priority: int | None = None
    status: int | None = None
    severity: int | None = None

    affectedSystem: int | None = None
    device: int | None = None
    device_name: str | None = None

    lastUpdated: datetime | None = None