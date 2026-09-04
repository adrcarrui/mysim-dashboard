import logging

from datetime import (
    date,
    datetime,
    time,
    timedelta,
)

from html import unescape
from html.parser import HTMLParser

from app.schemas.job import Job

from app.services.devices_service import (
    devices_service,
)

from app.services.mysim_client import (
    mysim_client,
)


logger = logging.getLogger(__name__)


PRIORITY_MAP = {
    18: 1,
    17: 2,
    16: 3,
    15: 4,
    232: 5,
}


class HTMLTextExtractor(
    HTMLParser
):
    def __init__(self):
        super().__init__()

        self.parts: list[str] = []

    def handle_data(
        self,
        data: str,
    ):
        text = data.strip()

        if text:
            self.parts.append(
                text
            )

    def get_text(
        self,
    ) -> str:
        return " ".join(
            self.parts
        )


def clean_html(
    value: str | None,
) -> str | None:
    if not value:
        return None

    value = unescape(
        value
    )

    parser = HTMLTextExtractor()

    parser.feed(
        value
    )

    return (
        parser
        .get_text()
        .strip()
        or None
    )


def parse_mysim_datetime(
    value: str | None,
) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value
        )

    except (
        ValueError,
        TypeError,
    ):
        return None


def get_job_urgency(
    target_date: datetime | None,
) -> tuple[
    int | None,
    str | None,
]:
    if target_date is None:
        return (
            None,
            None,
        )

    days_remaining = (
        target_date.date()
        - date.today()
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

    return (
        days_remaining,
        urgency,
    )


class JobsService:

    async def _build_job(
        self,
        raw: dict,
    ) -> Job | None:

        job_id = raw.get(
            "id"
        )

        job_number = raw.get(
            "jobNumber"
        )

        if (
            job_id is None
            or not job_number
        ):
            logger.warning(
                (
                    "Skipping invalid Job: "
                    "id=%r jobNumber=%r"
                ),
                job_id,
                job_number,
            )

            return None


        target_date = (
            parse_mysim_datetime(
                raw.get(
                    "targetDate"
                )
            )
        )


        (
            days_remaining,
            urgency,
        ) = get_job_urgency(
            target_date
        )


        device_id = raw.get(
            "device"
        )


        device_name = (
            await
            devices_service.get_name(
                device_id
            )
        )


        priority_id = raw.get(
            "priority"
        )


        return Job(
            id=job_id,

            job_number=
                job_number,

            target_date=
                target_date,

            description=
                clean_html(
                    raw.get(
                        "jobDescription"
                    )
                ),

            alias=
                raw.get(
                    "alias"
                ),

            device_id=
                device_id,

            device_name=
                device_name,

            priority_id=
                priority_id,

            priority=
                PRIORITY_MAP.get(
                    priority_id
                ),

            status_id=
                raw.get(
                    "status"
                ),

            assigned_to_id=
                raw.get(
                    "asignedTo"
                ),

            related_maintenance_task_id=
                raw.get(
                    "relatedMaintenanceTask"
                ),

            days_remaining=
                days_remaining,

            urgency=
                urgency,
        )


    async def _get_jobs(
        self,
        extra_query: str,
    ) -> list[Job]:

        logger.info(
            "JOB QUERY: %s",
            extra_query,
        )


        response = (
            await
            mysim_client.get(
                entity="Job",
                extra_query=extra_query,
            )
        )


        if (
            response.get("status")
            == 404
        ):
            return []


        raw_jobs = (
            response
            .get(
                "data",
                {},
            )
            .get(
                "data",
                [],
            )
        )


        logger.info(
            "JOBS RECEIVED: %s",
            len(
                raw_jobs
            ),
        )


        jobs: list[Job] = []


        for raw in raw_jobs:

            job = await self._build_job(
                raw
            )

            if job is None:
                continue

            jobs.append(
                job
            )


        jobs.sort(
            key=lambda job: (
                job.target_date
                is None,

                job.target_date
                or datetime.max,
            )
        )


        return jobs


    async def get_open_jobs(
        self,
    ) -> list[Job]:

        query = (
            "t.closingDate IS NULL"
        )

        return await self._get_jobs(
            query
        )


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
            (
                today
                + timedelta(
                    days=days + 1
                )
            ),
            time.min,
        )


        start_str = start.strftime(
            "%Y-%m-%d"
        )

        end_str = end.strftime(
            "%Y-%m-%d"
        )


        query = (
            f"t.targetDate>='{start_str}' "
            f"AND t.targetDate<'{end_str}' "
            f"AND t.closingDate IS NULL"
        )


        return await self._get_jobs(
            query
        )


    async def get_overdue_jobs(
        self,
    ) -> list[Job]:

        today = (
            date.today()
            .strftime(
                "%Y-%m-%d"
            )
        )


        query = (
            f"t.targetDate<'{today}' "
            f"AND t.closingDate IS NULL"
        )


        jobs = await self._get_jobs(
            query
        )


        '''
        Esta comprobación realmente ya
        la hace la query, pero dejamos
        fuera cualquier registro extraño
        que llegue sin targetDate.
        '''
        return [
            job
            for job in jobs
            if (
                job.target_date
                is not None
            )
        ]


jobs_service = JobsService()