from datetime import date, datetime, time, timedelta

from app.schemas.job import Job
from app.services.mysim_client import mysim_client


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

            jobs.append(
                Job(
                    id=raw["id"],
                    job_number=raw["jobNumber"],
                    target_date=raw.get("targetDate"),
                    description=raw.get("jobDescription"),
                    alias=raw.get("alias"),
                    device_id=raw.get("device"),
                    priority_id=raw.get("priority"),
                    status_id=raw.get("status"),
                    assigned_to_id=raw.get("asignedTo"),
                    related_maintenance_task_id=raw.get(
                        "relatedMaintenanceTask"
                    ),
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