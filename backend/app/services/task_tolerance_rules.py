"""Documented rules for the simulator manuals reviewed in September 2026."""
from datetime import datetime, time, timedelta
import re

VALIDATED_ISSUES = {1: "L", 2: "N", 10: "E", 16: "I", 21: "E"}
COMMON_TOLERANCES = {
    "daily": timedelta(hours=12), "weekly": timedelta(days=1),
    "biweekly": timedelta(days=2), "monthly": timedelta(days=7),
    "quarterly": timedelta(days=21), "semiannual": timedelta(days=28),
    **{key: timedelta(days=35) for key in (
        "annual", "biennial", "triannual", "quadrennial",
        "quinquennial", "5years", "10years",
    )},
}


def normalize_manual_issue(value: str | None) -> str | None:
    if not value:
        return None
    match = re.fullmatch(
        r"(?:ISSUE\s+)?([A-Z]+)(?:\s*\([^)]*\))?", value.strip().upper()
    )
    return match.group(1) if match else None


def normalize_frequency(value: str | None) -> str:
    return re.sub(r"[\s_-]+", "", (value or "").lower())


def get_unknown_tolerance_reason(
    *, device_id, manual_version, frequency, has_planned_time=True
) -> str | None:
    """Explain why no documented tolerance window can be calculated."""
    if not normalize_frequency(frequency):
        return "missing_frequency"

    expected_issue = VALIDATED_ISSUES.get(device_id)
    if expected_issue is None:
        return "unmapped_device"

    if not manual_version:
        return "missing_manual_version"

    if normalize_manual_issue(manual_version) != expected_issue:
        return "missing_tolerance_rule"

    key = normalize_frequency(frequency)
    if key == "daily" and not has_planned_time:
        return "missing_planned_time"

    if key == "28days":
        return None if device_id == 21 else "missing_tolerance_rule"

    if key not in COMMON_TOLERANCES:
        return "unsupported_frequency"

    return None


def get_documented_tolerance(*, device_id, manual_version, frequency):
    expected = VALIDATED_ISSUES.get(device_id)
    if expected is None or normalize_manual_issue(manual_version) != expected:
        return None
    key = normalize_frequency(frequency)
    if key == "28days":
        return timedelta(days=2) if device_id == 21 else None
    return COMMON_TOLERANCES.get(key)


def get_documented_window(
    *, planned_date, device_id, manual_version, frequency, has_planned_time=True
):
    tolerance = get_documented_tolerance(
        device_id=device_id, manual_version=manual_version, frequency=frequency
    )
    if tolerance is None:
        return None, None
    if normalize_frequency(frequency) == "daily":
        if not has_planned_time:
            return None, None
        return planned_date - tolerance, planned_date + tolerance
    return (
        datetime.combine((planned_date - tolerance).date(), time.min,
                         tzinfo=planned_date.tzinfo),
        datetime.combine((planned_date + tolerance).date(), time.max,
                         tzinfo=planned_date.tzinfo),
    )


def get_planning_category(*, now, planned_date, tolerance_end, frequency):
    if tolerance_end is None:
        return "unknown_tolerance"
    if now > tolerance_end:
        return "out_of_tolerance"
    if normalize_frequency(frequency) == "daily":
        if now > planned_date:
            return "backlog"
    elif now.date() > planned_date.date():
        return "backlog"
    return "today" if now.date() == planned_date.date() else "upcoming"