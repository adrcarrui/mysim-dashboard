from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
import logging

from app.schemas.availability import (
    AvailabilityInterval,
    DeviceAvailability,
)
from app.services.devices_service import (
    devices_service,
)
from app.services.mysim_client import (
    mysim_client,
)


logger = logging.getLogger(__name__)


SLOTS_VIEW_GUID = (
    "F23C3B3-30DE-22E5-924E-5D988E1A98F"
)

PAGE_SIZE = 100


class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(
        self,
        data: str,
    ):
        text = data.strip()

        if text:
            self.parts.append(
                text
            )

    def get_text(self) -> str:
        return " ".join(
            self.parts
        )


def clean_html(
    value: str | None,
) -> str | None:
    if not value:
        return None

    parser = HTMLTextExtractor()

    parser.feed(
        unescape(value)
    )

    text = (
        parser
        .get_text()
        .strip()
    )

    return text or None


def parse_datetime(
    value: str | None,
) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.strptime(
            value,
            "%Y-%m-%d %H:%M:%S",
        )

    except ValueError:
        logger.warning(
            "Invalid mySlots datetime: %s",
            value,
        )

        return None


def duration_minutes(
    start: datetime,
    end: datetime,
) -> int:
    return int(
        (
            end - start
        ).total_seconds()
        / 60
    )


async def get_slots_rows(
    *,
    window_start: datetime,
    window_end: datetime,
) -> list[dict]:
    """
    Obtiene todos los registros de mySlots
    dentro de la ventana solicitada.

    Se pagina para no depender del límite
    de DataTables.
    """

    start_timestamp = int(
        window_start.timestamp()
    )

    end_timestamp = int(
        window_end.timestamp()
    )

    rows: list[dict] = []

    offset = 0

    while True:
        params = {
            "modeColumn": "true",
            "id": "0",
            "viewGuid": (
                SLOTS_VIEW_GUID
            ),
            "start": offset,
            "length": PAGE_SIZE,
            "calendarDate": (
                "slotInit"
            ),
            "endCalendarDate": (
                "slotEnd"
            ),
            "resourceId": (
                "trainingDevice"
            ),
            "colorColumn": (
                "status"
            ),
            "startDate": (
                start_timestamp
            ),
            "endDate": (
                end_timestamp
            ),
        }

        response = (
            await mysim_client
            .get_datatable(
                "Slots",
                params=params,
            )
        )

        page_rows = response.get(
            "data",
            [],
        )

        if not isinstance(
            page_rows,
            list,
        ):
            page_rows = []

        rows.extend(
            page_rows
        )

        total = response.get(
            "recordsFiltered"
        )

        if total is None:
            total = response.get(
                "recordsTotal",
                len(rows),
            )

        try:
            total = int(total)

        except (
            TypeError,
            ValueError,
        ):
            total = len(rows)

        logger.info(
            "mySlots page: "
            "offset=%s rows=%s total=%s",
            offset,
            len(page_rows),
            total,
        )

        if not page_rows:
            break

        if len(rows) >= total:
            break

        offset += PAGE_SIZE

    logger.info(
        "mySlots total rows received: %s",
        len(rows),
    )

    return rows


def merge_intervals(
    intervals: list[
        tuple[
            datetime,
            datetime,
        ]
    ],
) -> list[
    tuple[
        datetime,
        datetime,
    ]
]:
    """
    Une intervalos que se solapan.

    Ejemplo:

    08:00-12:00
    11:00-15:00

    pasa a:

    08:00-15:00
    """

    if not intervals:
        return []

    intervals = sorted(
        intervals,
        key=lambda item: item[0],
    )

    merged: list[
        tuple[
            datetime,
            datetime,
        ]
    ] = []

    current_start = (
        intervals[0][0]
    )

    current_end = (
        intervals[0][1]
    )

    for (
        start,
        end,
    ) in intervals[1:]:
        if start <= current_end:
            current_end = max(
                current_end,
                end,
            )

            continue

        merged.append(
            (
                current_start,
                current_end,
            )
        )

        current_start = start
        current_end = end

    merged.append(
        (
            current_start,
            current_end,
        )
    )

    return merged


def calculate_available(
    *,
    occupied: list[
        tuple[
            datetime,
            datetime,
        ]
    ],
    window_start: datetime,
    window_end: datetime,
) -> list[
    tuple[
        datetime,
        datetime,
    ]
]:
    """
    Calcula el complemento de occupied
    dentro de la ventana solicitada.
    """

    available: list[
        tuple[
            datetime,
            datetime,
        ]
    ] = []

    cursor = window_start

    for (
        start,
        end,
    ) in occupied:
        if start > cursor:
            available.append(
                (
                    cursor,
                    start,
                )
            )

        cursor = max(
            cursor,
            end,
        )

    if cursor < window_end:
        available.append(
            (
                cursor,
                window_end,
            )
        )

    return available


async def get_device_name(
    *,
    device_id: int,
    row: dict,
) -> str:
    """
    Primero utiliza DevicesService,
    que ya existe en el proyecto.

    Como fallback usa el nombre que
    viene embebido en mySlots.
    """

    try:
        name = (
            await devices_service
            .get_name(
                device_id
            )
        )

        if name:
            return name

    except Exception:
        logger.exception(
            "Could not resolve device %s "
            "using DevicesService",
            device_id,
        )

    slot_name = clean_html(
        row.get(
            "trainingDevice"
        )
    )

    if slot_name:
        return slot_name

    return (
        f"Device {device_id}"
    )


async def get_availability(
    *,
    window_start: datetime,
    window_end: datetime,
) -> list[
    DeviceAvailability
]:
    rows = await get_slots_rows(
        window_start=window_start,
        window_end=window_end,
    )

    #
    # DEBUG TEMPORAL:
    # mostrar exactamente qué rows/devices
    # está devolviendo mySlots.
    #
    print(
        "========== AVAILABILITY RAW DEVICES =========="
    )

    for row in rows:
        print(
            "row:",
            row.get("DT_RowId"),
            "| device:",
            row.get("DT_trainingDevice"),
            "| name:",
            clean_html(
                row.get("trainingDevice")
            ),
            "| start:",
            row.get("slotInit"),
            "| end:",
            row.get("slotEnd"),
        )

    print(
        "=============================================="
    )

    rows_by_device: dict[
        int,
        list[dict],
    ] = defaultdict(list)

    representative_row: dict[
        int,
        dict,
    ] = {}

    for row in rows:
        raw_device_id = row.get(
            "DT_trainingDevice"
        )

        if raw_device_id is None:
            continue

        try:
            device_id = int(
                raw_device_id
            )

        except (
            TypeError,
            ValueError,
        ):
            logger.warning(
                "Invalid device id in "
                "mySlots row %s: %s",
                row.get(
                    "DT_RowId"
                ),
                raw_device_id,
            )

            continue

        rows_by_device[
            device_id
        ].append(
            row
        )

        representative_row.setdefault(
            device_id,
            row,
        )

    print(
        "Devices found in mySlots:",
        sorted(
            rows_by_device.keys()
        ),
    )

    result: list[
        DeviceAvailability
    ] = []

    for (
        device_id,
        device_rows,
    ) in rows_by_device.items():
        device_name = (
            await get_device_name(
                device_id=device_id,
                row=(
                    representative_row[
                        device_id
                    ]
                ),
            )
        )

        intervals: list[
            tuple[
                datetime,
                datetime,
            ]
        ] = []

        for row in device_rows:
            slot_start = (
                parse_datetime(
                    row.get(
                        "slotInit"
                    )
                )
            )

            slot_end = (
                parse_datetime(
                    row.get(
                        "slotEnd"
                    )
                )
            )

            if (
                slot_start is None
                or slot_end is None
            ):
                continue

            #
            # mySlots puede devolver slots
            # que empiezan antes o terminan
            # después de nuestra ventana.
            #
            # Los recortamos al rango solicitado.
            #
            start = max(
                slot_start,
                window_start,
            )

            end = min(
                slot_end,
                window_end,
            )

            if start >= end:
                continue

            #
            # Regla de disponibilidad:
            #
            # Si existe un slot durante este
            # intervalo, el device está ocupado.
            #
            # El status del slot no modifica
            # esta regla.
            #
            intervals.append(
                (
                    start,
                    end,
                )
            )

        occupied = (
            merge_intervals(
                intervals
            )
        )

        available = (
            calculate_available(
                occupied=occupied,
                window_start=(
                    window_start
                ),
                window_end=(
                    window_end
                ),
            )
        )

        occupied_models = [
            AvailabilityInterval(
                start=start,
                end=end,
                durationMinutes=(
                    duration_minutes(
                        start,
                        end,
                    )
                ),
            )
            for (
                start,
                end,
            )
            in occupied
        ]

        available_models = [
            AvailabilityInterval(
                start=start,
                end=end,
                durationMinutes=(
                    duration_minutes(
                        start,
                        end,
                    )
                ),
            )
            for (
                start,
                end,
            )
            in available
        ]

        total_occupied_minutes = sum(
            item.durationMinutes
            for item in occupied_models
        )

        total_available_minutes = sum(
            item.durationMinutes
            for item in available_models
        )

        print(
            "Availability:",
            device_id,
            device_name,
            "| occupied:",
            total_occupied_minutes,
            "min",
            "| available:",
            total_available_minutes,
            "min",
        )

        result.append(
            DeviceAvailability(
                deviceId=(
                    device_id
                ),
                deviceName=(
                    device_name
                ),
                totalOccupiedMinutes=(
                    total_occupied_minutes
                ),
                totalAvailableMinutes=(
                    total_available_minutes
                ),
                occupied=(
                    occupied_models
                ),
                available=(
                    available_models
                ),
            )
        )

    result.sort(
        key=lambda item: (
            item.deviceName.lower()
        )
    )

    return result