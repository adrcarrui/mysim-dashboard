from app.schemas.action import Action
from app.services.mysim_client import mysim_client
from app.services.devices_service import devices_service


DONE_STATUS_ID = 22


class ActionsService:

    async def get_open_actions(
        self,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[Action]:

        conditions: list[str] = []

        # -------------------------------------------------
        # FILTROS QUE SÍ SOPORTA extraQuery
        # -------------------------------------------------

        if from_date:
            conditions.append(
                f"t.date>='{from_date}'"
            )

        if to_date:
            conditions.append(
                f"t.date<'{to_date}'"
            )

        extra_query = None

        if conditions:
            where = " AND ".join(conditions)

            extra_query = f"""
                {where}
                ORDER BY t.date DESC
            """.strip()

        # -------------------------------------------------
        # CONSULTA A MYSIM
        # -------------------------------------------------

        payload = await mysim_client.get(
            entity="action",
            extra_query=extra_query,
        )
        rows = (
            payload
            .get("data", {})
            .get("data", [])
        )

        # -------------------------------------------------
        # FILTRAR DONE
        #
        # mySim no permite de momento:
        # t.status<>22
        # t.status!=22
        # t.status=19
        #
        # así que filtramos localmente.
        # -------------------------------------------------

        open_rows = [
            row
            for row in rows
            if row.get("status") != DONE_STATUS_ID
        ]

        # -------------------------------------------------
        # RESOLVER NOMBRE DEL DEVICE
        # -------------------------------------------------

        result: list[Action] = []

        for row in open_rows:

            device_id = row.get("device")

            device_name = await devices_service.get_name(
                device_id
            )

            enriched_row = {
                **row,
                "deviceName": device_name,
            }

            result.append(
                Action.model_validate(enriched_row)
            )

        # -------------------------------------------------
        # ORDEN LOCAL
        #
        # Necesario también cuando no mandamos extraQuery.
        # -------------------------------------------------

        result.sort(
            key=lambda action: action.date or "",
            reverse=True,
        )

        return result


actions_service = ActionsService()