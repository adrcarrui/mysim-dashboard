from datetime import datetime

from pydantic import BaseModel


class AvailabilityInterval(BaseModel):
    start: datetime
    end: datetime
    durationMinutes: int


class DeviceAvailability(BaseModel):
    deviceId: int
    deviceName: str

    totalOccupiedMinutes: int
    totalAvailableMinutes: int

    occupied: list[AvailabilityInterval]
    available: list[AvailabilityInterval]