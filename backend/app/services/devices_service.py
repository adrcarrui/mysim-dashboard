from app.services.mysim_client import mysim_client


class DevicesService:
    def __init__(self):
        self._cache: dict[int, str] = {}

    async def get_name(
        self,
        device_id: int | None,
    ) -> str | None:

        if device_id is None:
            return None

        if device_id in self._cache:
            return self._cache[device_id]

        query = f"t.id={device_id}"

        response = await mysim_client.get(
            entity="device",
            extra_query=query,
        )

        if response.get("status") == 404:
            return None

        devices = (
            response
            .get("data", {})
            .get("data", [])
        )

        if not devices:
            return None

        name = devices[0].get("name")

        if name:
            self._cache[device_id] = name

        return name


devices_service = DevicesService()