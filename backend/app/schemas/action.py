from pydantic import BaseModel, ConfigDict


class Action(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None

    actionId: str | None = None
    date: str | None = None
    actionDescription: str | None = None

    performedBy: int | None = None
    asignedTo: int | None = None

    status: int | None = None
    device: int | None = None

    performedDatetime: str | None = None
    lastUpdated: str | None = None

    # Campos preparados para el dashboard
    deviceName: str | None = None