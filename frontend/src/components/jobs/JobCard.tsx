import type { Job } from "../../types/job"

type Props = {
  job: Job
}

export function JobCard({ job }: Props) {
  return (
    <div className="job-card">
      <div className="job-card__header">
        <span className="job-number">
          {job.job_number}
        </span>

        <span className={`urgency ${job.urgency}`}>
          {job.urgency ?? "unknown"}
        </span>
      </div>

      <div className="job-device">
        {job.device_name ?? "Unknown device"}
      </div>

      <div className="job-description">
        {job.description ?? "No description"}
      </div>

      <div className="job-meta">
        <span>
          Target:{" "}
          {job.target_date
            ? new Date(job.target_date).toLocaleDateString()
            : "-"}
        </span>

        <span>
          Priority: {job.priority ?? "-"}
        </span>
      </div>
    </div>
  )
}