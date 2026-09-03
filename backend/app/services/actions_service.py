from datetime import date, timedelta
from html import unescape
from html.parser import HTMLParser

from app.schemas.action import Action
from app.services.mysim_client import mysim_client
from app.services.devices_service import devices_service


DONE_STATUS_ID = 22

SHIFT_MAP = {
    1960: "Not assigned",
    1961: "Morning",
    1962: "Evening",
    1963: "Night",
}

STATUS_MAP = {
    19: "Open",
    20: "On going",
    22: "Done",
}

ACCOUNT_MAP = {
    59: "Mantenimiento",
    3232: "Gaspar Flores Lara",
    3612: "Rafael Rivera Castillo",
    3637: "Operaciones",
    3792: "Javier Pinto Marin",
    3926: "Cody Gerard Fitzgerald",
    3970: "Alejandro Perez Perez",
    4036: "Maria Vallecillos",
    4255: "Alejandro Puerta Delgado",
    4353: "Carlos Domínguez Nicolás",
}

async def debug_shift_entity(
    shift_id: int | None,
):
    if shift_id is None:
        return

    possible_entities = [
        "Shift",
        "shift",
        "ActionShift",
        "ShiftToBeDone",
    ]

    for entity in possible_entities:
        try:
            payload = await mysim_client.get(
                entity=entity,
                extra_query=f"t.id={shift_id}",
            )

            rows = (
                payload
                .get("data", {})
                .get("data", [])
            )

            print(
                f"SHIFT DEBUG {entity}:",
                rows[:1],
            )

        except Exception as exc:
            print(
                f"SHIFT DEBUG ERROR {entity}:",
                exc,
            )

class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str):
        text = data.strip()

        if text:
            self.parts.append(text)

    def get_text(self) -> str:
        return " ".join(self.parts)


def clean_html(
    value: str | None,
) -> str | None:
    if not value:
        return None

    value = unescape(value)

    parser = HTMLTextExtractor()
    parser.feed(value)

    return parser.get_text().strip() or None


async def get_account_name(
    account_id: int | None,
    cache: dict[int, str | None],
) -> str | None:
    if account_id is None:
        return None

    # Primero miramos el mapa conocido
    if account_id in ACCOUNT_MAP:
        return ACCOUNT_MAP[account_id]

    # Luego la caché de esta ejecución
    if account_id in cache:
        return cache[account_id]

    payload = await mysim_client.get(
        entity="Accounts",
        extra_query=f"t.id={account_id}",
    )

    rows = (
        payload
        .get("data", {})
        .get("data", [])
    )

    name = None

    if rows:
        row = rows[0]

        name = (
            row.get("name")
            or row.get("displayName")
            or row.get("username")
            or row.get("email")
        )

    cache[account_id] = name

    return name


class ActionsService:

    async def get_open_actions(
        self,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[Action]:

        # Si no se proporcionan fechas:
        # hoy -> hoy + 7 días
        if from_date is None:
            from_date = date.today().isoformat()

        if to_date is None:
            to_date = (
                date.today()
                + timedelta(days=7)
            ).isoformat()

        extra_query = (
            f"t.date>='{from_date}' "
            f"AND t.date<'{to_date}'"
        )

        print(
            "ACTION QUERY:",
            extra_query,
        )

        payload = await mysim_client.get(
            entity="action",
            extra_query=extra_query,
        )

        rows = (
            payload
            .get("data", {})
            .get("data", [])
        )

        print(
            "ACTIONS RECEIVED:",
            len(rows),
        )

        # Caché de Accounts para IDs no incluidos
        # en ACCOUNT_MAP
        account_cache: dict[
            int,
            str | None,
        ] = {}

        actions: list[Action] = []

        shift_debug_done = False

        for row in rows:

            status_id = row.get("status")

            # Excluir Actions Done
            if status_id == DONE_STATUS_ID:
                continue

            device_id = row.get("device")

            performed_by_id = row.get(
                "performedBy"
            )

            assigned_to_id = row.get(
                "asignedTo"
            )

            shift_to_be_done_id = row.get(
                "shiftToBeDone"
            )
            if (
                not shift_debug_done
                and shift_to_be_done_id is not None
            ):
                await debug_shift_entity(
                    shift_to_be_done_id
                )

                shift_debug_done = True

            # Resolver nombre del dispositivo
            # usando el servicio común de Devices.
            device_name = await devices_service.get_name(
                device_id
            )

            # Resolver estado
            status_name = STATUS_MAP.get(
                status_id
            )

            # Resolver nombre de quien realiza
            # la Action.
            performed_by_name = (
                await get_account_name(
                    performed_by_id,
                    account_cache,
                )
            )

            # Resolver nombre del usuario/grupo
            # asignado.
            assigned_to_name = (
                await get_account_name(
                    assigned_to_id,
                    account_cache,
                )
            )

            # Todavía no hemos identificado la entidad
            # correspondiente a shiftToBeDone.
            shift_to_be_done_name = SHIFT_MAP.get(
                shift_to_be_done_id
            )

            action = Action(
                id=(
                    str(row.get("id"))
                    if row.get("id") is not None
                    else None
                ),

                action_id=row.get(
                    "actionId"
                ),

                device_id=device_id,
                device=device_name,

                status_id=status_id,
                status=status_name,

                performed_by_id=performed_by_id,
                performed_by=performed_by_name,

                assigned_to_id=assigned_to_id,
                assigned_to=assigned_to_name,

                shift_to_be_done_id=shift_to_be_done_id,
                shift_to_be_done=shift_to_be_done_name,

                date=row.get("date"),

                description=clean_html(
                    row.get(
                        "actionDescription"
                    )
                ),

                last_updated=row.get(
                    "lastUpdated"
                ),
            )

            actions.append(action)

        # Ordenar por fecha y Action ID
        actions.sort(
            key=lambda action: (
                action.date or "",
                action.action_id or "",
            )
        )

        print(
            "OPEN ACTIONS:",
            len(actions),
        )

        if actions:
            print(
                "FIRST NORMALIZED ACTION:",
                actions[0].model_dump(),
            )

        print(
            "ACCOUNT CACHE:",
            account_cache,
        )

        return actions


actions_service = ActionsService()