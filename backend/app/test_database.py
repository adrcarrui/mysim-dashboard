import asyncio

from sqlalchemy import text

from app.database import engine


async def main() -> None:
    async with engine.connect() as connection:
        database = await connection.scalar(
            text("SELECT current_database()")
        )
        user = await connection.scalar(
            text("SELECT current_user")
        )
        devices = await connection.scalar(
            text("SELECT COUNT(*) FROM devices")
        )

        print(f"Database: {database}")
        print(f"User: {user}")
        print(f"Devices: {devices}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())