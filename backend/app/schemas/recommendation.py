from datetime import datetime

from pydantic import BaseModel


class RecommendationReason(
    BaseModel
):
    code: str
    label: str
    score: int


class RecommendedWindow(
    BaseModel
):
    start: datetime
    end: datetime

    durationMinutes: int

    score: int

    fitsWindow: (
        bool | None
    ) = None

    windowToleranceStatus: str

    reasons: list[
        RecommendationReason
    ]


class TaskRecommendation(
    BaseModel
):
    scheduledTaskId: int

    maintenanceTaskId: int

    scheduleCode: str

    taskCode: str

    device: str

    description: (
        str | None
    ) = None

    plannedDate: datetime

    toleranceStart: (
        datetime | None
    ) = None

    toleranceEnd: (
        datetime | None
    ) = None

    currentToleranceStatus: str

    frequency: (
        str | None
    ) = None

    status: str

    durationMinutes: (
        int | None
    ) = None

    durationSource: str

    bestWindow: (
        RecommendedWindow
        | None
    ) = None

    alternativeWindows: list[
        RecommendedWindow
    ]


class DeviceRecommendations(
    BaseModel
):
    deviceId: int

    deviceName: str

    taskDeviceName: str

    tasks: list[
        TaskRecommendation
    ]


class RecommendationsResponse(
    BaseModel
):
    fromDate: datetime

    toDate: datetime

    devices: list[
        DeviceRecommendations
    ]