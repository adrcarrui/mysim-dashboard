from typing import Any

from sqlalchemy import select, update, func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.device import (
    Device,
    MySimEntityCache,
)


class DevicesRepository:
    @staticmethod
    def _to_values(
        device: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "mysim_id": int(device["id"]),
            "name": device.get("name"),
            "code": device.get("prefix"),
            "enabled": device.get("enabled"),
            "raw_data": device,
            "is_present_in_mysim": True,
        }

    async def _upsert_devices(
        self,
        session: AsyncSession,
        devices: list[dict[str, Any]],
    ) -> None:
        if not devices:
            return

        values = [
            self._to_values(device)
            for device in devices
        ]

        statement = insert(Device).values(values)

        statement = statement.on_conflict_do_update(
            index_elements=[Device.mysim_id],
            set_={
                "name": statement.excluded.name,
                "code": statement.excluded.code,
                "enabled": statement.excluded.enabled,
                "raw_data": statement.excluded.raw_data,
                "is_present_in_mysim": True,
                "updated_at": func.now(),
                "synced_at": func.now(),
            },
        )

        await session.execute(statement)

    async def synchronize(
        self,
        response: dict[str, Any],
        devices: list[dict[str, Any]],
    ) -> int:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(
                    update(Device).values(
                        is_present_in_mysim=False,
                    )
                )

                await self._upsert_devices(
                    session,
                    devices,
                )

                cache_statement = (
                    insert(MySimEntityCache)
                    .values(
                        entity="device",
                        raw_response=response,
                    )
                )

                cache_statement = (
                    cache_statement
                    .on_conflict_do_update(
                        index_elements=[
                            MySimEntityCache.entity
                        ],
                        set_={
                            "raw_response": (
                                cache_statement
                                .excluded
                                .raw_response
                            ),
                            "synced_at": func.now(),
                        },
                    )
                )

                await session.execute(
                    cache_statement
                )

        return len(devices)

    async def upsert_one(
        self,
        device: dict[str, Any],
    ) -> None:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                await self._upsert_devices(
                    session,
                    [device],
                )

    async def get_name(
        self,
        mysim_id: int,
    ) -> str | None:
        async with AsyncSessionLocal() as session:
            statement = (
                select(Device.name)
                .where(
                    Device.mysim_id == mysim_id,
                    Device.is_present_in_mysim.is_(True),
                )
            )

            return await session.scalar(statement)

    async def get_all(
        self,
        include_missing: bool = False,
    ) -> list[dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            statement = select(Device)

            if not include_missing:
                statement = statement.where(
                    Device
                    .is_present_in_mysim
                    .is_(True)
                )

            statement = statement.order_by(
                Device.name,
                Device.mysim_id,
            )

            result = await session.scalars(
                statement
            )

            return [
                {
                    "mysimId": device.mysim_id,
                    "name": device.name,
                    "code": device.code,
                    "enabled": device.enabled,
                    "isPresentInMySim": (
                        device.is_present_in_mysim
                    ),
                    "syncedAt": (
                        device.synced_at.isoformat()
                    ),
                    "rawData": device.raw_data,
                }
                for device in result.all()
            ]

    async def get_raw_response(
        self,
    ) -> dict[str, Any] | None:
        async with AsyncSessionLocal() as session:
            statement = (
                select(
                    MySimEntityCache.raw_response
                )
                .where(
                    MySimEntityCache.entity
                    == "device"
                )
            )

            return await session.scalar(statement)


    async def get_name_map(
        self,
    ) -> dict[int, str]:
        async with AsyncSessionLocal() as session:
            statement = (
                select(
                    Device.mysim_id,
                    Device.name,
                )
                .where(
                    Device.is_present_in_mysim.is_(True),
                    Device.name.is_not(None),
                )
            )

            result = await session.execute(
                statement
            )

            return {
                int(mysim_id): name
                for mysim_id, name in result.all()
                if name
            }

    async def get_last_sync(
        self,
    ):
        async with AsyncSessionLocal() as session:
            statement = (
                select(
                    MySimEntityCache.synced_at
                )
                .where(
                    MySimEntityCache.entity
                    == "device"
                )
            )

            return await session.scalar(statement)

devices_repository = DevicesRepository()