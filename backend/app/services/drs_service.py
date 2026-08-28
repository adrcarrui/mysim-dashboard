from app.services.mysim_client import mysim_client
from app.services.devices_service import devices_service
from app.schemas.dr import DrOut


async def get_open_drs(
    device_id: int | None = None,
) -> list[DrOut]:

    conditions = [
        "t.closingDate IS NULL"
    ]

    if device_id is not None:
        conditions.append(f"t.device={int(device_id)}")

    extra_query = (
        " AND ".join(conditions)
        + " ORDER BY t.reportedDate DESC"
    )

    payload = await mysim_client.get(
        entity="Dr",
        extra_query=extra_query,
    )

    rows = (
        payload
        .get("data", {})
        .get("data", [])
    )

    result: list[DrOut] = []

    for row in rows:
        current_device_id = row.get("device")

        device_name = await devices_service.get_name(
            current_device_id
        )

        row["device_name"] = device_name

        result.append(
            DrOut(
                id=row["id"],
                dr_id=row.get("drId"),
                reported_date=row.get("reportedDate"),
                closing_date=row.get("closingDate"),

                customer_description=row.get("customerDescription"),
                fault_description=row.get("faultDescription"),

                detected_by_id=row.get("detectedBy"),
                repetitions=row.get("repetitions"),

                manufacturer_id_number=row.get("manufacturerIdNumber"),
                ata=row.get("ata"),

                close_remarks=row.get("closeRemarks"),
                root_cause_analysis=row.get("rootCauseAnalysis"),

                not_our=row.get("notOur"),

                priority_id=row.get("priority"),
                status_id=row.get("status"),
                severity_id=row.get("severity"),

                affected_system_id=row.get("affectedSystem"),

                device_id=current_device_id,
                device_name=device_name,

                last_updated=row.get("lastUpdated"),
            )
)

    return result