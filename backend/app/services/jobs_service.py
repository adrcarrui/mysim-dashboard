from datetime import date, datetime, time, timedelta
from html import unescape
from html.parser import HTMLParser

from app.schemas.job import Job
from app.services.mysim_client import mysim_client


PRIORITY_MAP = {
    18: 1,
    17: 2,
    16: 3,
    15: 4,
    232: 5,
}


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


def clean_html(value: str | None) -> str | None:
    if not value:
        return None

    value = unescape(value)

    parser = HTMLTextExtractor()
    parser.feed(value)

    return parser.get_text().strip() or None


class JobsService:

    async def get_expiring_jobs(
        self,
        days: int = 7,
    ) -> list[Job]:

        today = date.today()

        start = datetime.combine(
            today,
            time.min,
        )

        end = datetime.combine(
            today + timedelta(days=days + 1),
            time.min,
        )

        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")

        query = (
            f"t.targetDate>='{start_str}' "
            f"AND t.targetDate<'{end_str}' "
            f"AND t.closingDate IS NULL"
        )

        response = await mysim_client.get(
            entity="Job",
            extra_query=query,
        )

        if response.get("status") == 404:
            return []

        raw_jobs = (
            response
            .get("data", {})
            .get("data", [])
        )

        jobs: list[Job] = []

        for raw in raw_jobs:

            target_date = (
                datetime.fromisoformat(raw["targetDate"])
                if raw.get("targetDate")
                else None
            )

            days_remaining = None
            urgency = None

            if target_date:
                days_remaining = (
                    target_date.date() - date.today()
                ).days

                if days_remaining < 0:
                    urgency = "overdue"
                elif days_remaining == 0:
                    urgency = "today"
                elif days_remaining == 1:
                    urgency = "tomorrow"
                elif days_remaining <= 3:
                    urgency = "soon"
                else:
                    urgency = "upcoming"

            jobs.append(
                Job(
                    id=raw["id"],
                    job_number=raw["jobNumber"],
                    target_date=target_date,

                    description=clean_html(
                        raw.get("jobDescription")
                    ),

                    alias=raw.get("alias"),

                    device_id=raw.get("device"),

                    priority_id=raw.get("priority"),
                    priority=PRIORITY_MAP.get(
                        raw.get("priority")
                    ),

                    status_id=raw.get("status"),

                    assigned_to_id=raw.get(
                        "asignedTo"
                    ),

                    related_maintenance_task_id=raw.get(
                        "relatedMaintenanceTask"
                    ),

                    days_remaining=days_remaining,
                    urgency=urgency,
                )
            )

        jobs.sort(
            key=lambda job: (
                job.target_date is None,
                job.target_date,
            )
        )

        return jobs


jobs_service = JobsService()