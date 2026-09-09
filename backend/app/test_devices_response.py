import asyncio
import json
from pathlib import Path

from app.services.mysim_client import mysim_client


async def main() -> None:
    response = await mysim_client.get(
        entity="device",
    )

    output_path = Path(
        "devices_response.json"
    )

    output_path.write_text(
        json.dumps(
            response,
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    devices = (
        response
        .get("data", {})
        .get("data", [])
    )

    print(
        f"Devices received: {len(devices)}"
    )
    print(
        f"Response saved in: {output_path.resolve()}"
    )


if __name__ == "__main__":
    asyncio.run(main())