from pathlib import Path


def get_version() -> str:
    current_file = Path(__file__).resolve()

    project_root = current_file.parents[2]

    version_file = project_root / "VERSION"

    try:
        return version_file.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "unknown"


APP_VERSION = get_version()