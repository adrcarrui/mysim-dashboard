import asyncio
import json
from pathlib import Path

from app.services.mysim_client import mysim_client


async def main() -> None:
    response = await mysim_client.get(
        entity="TaskFrequency",
    )

    output_path = Path(
        "task_frequencies_response.json"
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

    frequencies = (
        response
        .get("data", {})
        .get("data", [])
    )

    print(
        f"Task frequencies received: "
        f"{len(frequencies)}"
    )

    print(
        f"Response saved in: "
        f"{output_path.resolve()}"
    )


if __name__ == "__main__":
    asyncio.run(main())