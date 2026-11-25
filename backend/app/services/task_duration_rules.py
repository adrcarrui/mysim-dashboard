"""Resolve planning durations from the ITC maintenance annexes and mySim."""
import csv
import re
from pathlib import Path

from app.services.task_tolerance_rules import normalize_manual_issue

# Device IDs are the stable keys for the five FFS manuals.
DEVICE_NAMES = {1: "CN235", 2: "C295", 10: "A400M", 16: "MRTT", 21: "C295 TS03"}
CODE_PREFIXES = {
    "CN235": r"(?:FFS[- ]?)?(?:CN235|235)",
    "C295": r"(?:FFS[- ]?)?(?:C295|295)",
    "A400M": r"(?:(?:FFS|FFS-1G)[- ]?)?A400M",
    "MRTT": r"(?:(?:FFS|FFS/FFMS)[- ]?)?(?:MRTT|MT_MRTT1)",
    "C295 TS03": r"(?:FFS[- ]?)?(?:C295[- ]TS03|295_2|295/2|TS03)",
    "GEN": r"GEN",
}
TASK_CODES = {
    device: re.compile(rf"(?:(?:MP[- ]+)?{prefix}[- ]+)?(\d+(?:\.\d+)?)")
    for device, prefix in CODE_PREFIXES.items()
}


def _normalize_code(device: str, value: object) -> str | None:
    if not isinstance(value, str):
        return None
    match = TASK_CODES[device].fullmatch(value.strip().upper())
    if match is None:
        return None
    return ".".join(str(int(part)) for part in match[1].split("."))


def _load_catalog() -> dict[tuple[str, str], tuple[str, int, str]]:
    catalog = {}
    with Path(__file__).with_name("task_duration_catalog.csv").open(
        encoding="utf-8", newline=""
    ) as source:
        for row in csv.DictReader(source):
            device = row["device"]
            code = row["task_code"]
            issue = row["issue"]
            reference = f"MPFSTDO · Anexo {row['annex']} · Issue {issue} · p. {row['page']} · {code}"
            value = (issue, int(row["minutes"]), reference)
            for identifier in (code, row["reference_number"]):
                key = _normalize_code(device, identifier)
                if key is None:
                    continue
                if (device, key) in catalog:
                    raise ValueError(f"Duplicate maintenance task duration: {device} {key}")
                catalog[device, key] = value
    return catalog


CATALOG = _load_catalog()
DURATION = re.compile(r"(\d{1,3})\s*[:.Hh]\s*([0-5]\d)(?::00)?")


def get_task_duration(
    *,
    device_id: int | None,
    device: str,
    manual_version: str | None,
    task_id: object,
    task_code: str,
    estimated_time: object,
) -> tuple[int | None, str | None]:
    catalog_device = DEVICE_NAMES.get(device_id)
    if catalog_device is None and (
        device == "GEN"
        or (isinstance(task_id, str) and task_id.strip().upper().startswith("GEN-"))
    ):
        catalog_device = "GEN"
    if catalog_device is None and device_id is None and device in CODE_PREFIXES:
        catalog_device = device

    if catalog_device:
        issue = normalize_manual_issue(manual_version)
        for identifier in (task_id, task_code):
            key = _normalize_code(catalog_device, identifier)
            entry = CATALOG.get((catalog_device, key)) if key is not None else None
            if entry and (not manual_version or issue == entry[0]):
                return entry[1], entry[2]

    if isinstance(estimated_time, str):
        match = DURATION.fullmatch(estimated_time.strip())
        if match:
            minutes = int(match[1]) * 60 + int(match[2])
            if 0 < minutes <= 10080:
                return minutes, "mySim · estimatedTime"

    return None, None
