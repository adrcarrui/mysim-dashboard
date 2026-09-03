from pydantic import BaseModel


class Action(BaseModel):
    id: str | None = None
    action_id: str | None = None

    device_id: int | None = None
    device: str | None = None

    status_id: int | None = None
    status: str | None = None

    performed_by_id: int | None = None
    performed_by: str | None = None

    assigned_to_id: int | None = None
    assigned_to: str | None = None

    shift_to_be_done_id: int | None = None
    shift_to_be_done: str | None = None

    date: str | None = None
    description: str | None = None
    last_updated: str | None = None