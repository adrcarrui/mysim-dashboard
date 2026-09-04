import type {
  Job,
} from "../../types/job"

import "./JobsList.css"


interface JobsListProps {
  jobs: Job[]
}


function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "-"
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    "es-ES",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  )
}


function getUrgencyLabel(
  job: Job,
): string {
  if (
    job.days_remaining === null
  ) {
    return "No target date"
  }

  if (
    job.days_remaining < 0
  ) {
    return "Overdue"
  }

  if (
    job.days_remaining === 0
  ) {
    return "Today"
  }

  if (
    job.days_remaining === 1
  ) {
    return "Tomorrow"
  }

  return "Upcoming"
}


export function JobsList({
  jobs,
}: JobsListProps) {

  if (
    jobs.length === 0
  ) {
    return (
      <div className="jobs-list__empty">
        No jobs found.
      </div>
    )
  }


  const sortedJobs =
    [...jobs].sort(
      (a, b) => {
        if (
          !a.target_date &&
          !b.target_date
        ) {
          return 0
        }

        if (!a.target_date) {
          return 1
        }

        if (!b.target_date) {
          return -1
        }

        return (
          new Date(
            a.target_date
          ).getTime()
          -
          new Date(
            b.target_date
          ).getTime()
        )
      }
    )


  return (
    <div className="jobs-list">

      {sortedJobs.map(
        (job) => {

          const urgency =
            getUrgencyLabel(
              job
            )

          return (
            <article
              key={job.id}
              className="jobs-list__item"
            >

              <div className="jobs-list__header">

                <div className="jobs-list__heading">

                  <strong className="jobs-list__number">
                    {job.job_number}
                  </strong>


                  {job.alias && (
                    <span className="jobs-list__alias">
                      {job.alias}
                    </span>
                  )}

                </div>


                <span
                  className={`
                    jobs-list__urgency
                    jobs-list__urgency--${job.urgency ?? "unknown"}
                  `}
                >
                  {urgency}
                </span>

              </div>


              {job.description && (
                <p className="jobs-list__description">
                  {job.description}
                </p>
              )}


              <div className="jobs-list__meta">

                <div className="jobs-list__meta-item">

                  <span>
                    Target
                  </span>

                  <strong>
                    {formatDate(
                      job.target_date
                    )}
                  </strong>

                </div>


                <div className="jobs-list__meta-item">

                  <span>
                    Priority
                  </span>

                  <strong>
                    {job.priority ?? "-"}
                  </strong>

                </div>


                {job.days_remaining !== null && (
                  <div className="jobs-list__meta-item">

                    <span>
                      Days
                    </span>

                    <strong>
                      {job.days_remaining}
                    </strong>

                  </div>
                )}


                {job.related_maintenance_task_id && (
                  <div className="jobs-list__meta-item">

                    <span>
                      Maintenance task
                    </span>

                    <strong>
                      {
                        job.related_maintenance_task_id
                      }
                    </strong>

                  </div>
                )}

              </div>

            </article>
          )
        }
      )}

    </div>
  )
}