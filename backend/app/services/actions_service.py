from datetime import date, timedelta

from app.services.mysim_client import mysim_client


DONE_STATUS_ID = 22


class ActionsService:

    async def get_open_actions(
        self,
        from_date: str | None = None,
        to_date: str | None = None,
    ):
        # Si no vienen fechas desde frontend,
        # usamos hoy -> hoy + 7 días
        if from_date is None:
            from_date = date.today().isoformat()

        if to_date is None:
            to_date = (
                date.today() + timedelta(days=7)
            ).isoformat()

        extra_query = (
            f"t.date>='{from_date}' "
            f"AND t.date<'{to_date}'"
        )

        print("ACTION QUERY:", extra_query)

        payload = await mysim_client.get(
            entity="action",
            extra_query=extra_query,
        )

        rows = (
            payload
            .get("data", {})
            .get("data", [])
        )

        print("ACTIONS RECEIVED:", len(rows))

        open_rows = [
            row
            for row in rows
            if row.get("status") != DONE_STATUS_ID
        ]

        print("OPEN ACTIONS:", len(open_rows))

        return open_rows


actions_service = ActionsService()