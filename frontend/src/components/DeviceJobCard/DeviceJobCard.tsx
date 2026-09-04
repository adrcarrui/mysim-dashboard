import type {
  Job,
} from "../../types/job"

import "./DeviceJobCard.css"


interface DeviceJobCardProps {
  deviceName: string
  jobs: Job[]
  image?: string
  onClick?: () => void
}


export function DeviceJobCard({
  deviceName,
  jobs,
  image,
  onClick,
}: DeviceJobCardProps) {

  const overdue =
    jobs.filter(
      (job) =>
        job.days_remaining !== null &&
        job.days_remaining < 0
    ).length


  const today =
    jobs.filter(
      (job) =>
        job.days_remaining === 0
    ).length


  const upcoming =
    jobs.filter(
      (job) =>
        job.days_remaining !== null &&
        job.days_remaining > 0
    ).length


  return (
    <button
      type="button"
      className="device-job-card"
      onClick={onClick}
    >

      <div className="device-job-card__header">

        <h3 className="device-job-card__name">
          {deviceName}
        </h3>


        <span className="device-job-card__count">
          {jobs.length}
        </span>

      </div>


      <div className="device-job-card__summary">

        <div className="device-job-card__row">

          <span
            className="
              device-job-card__dot
              device-job-card__dot--overdue
            "
          />

          <strong>
            {overdue}
          </strong>

          <span
            className="
              device-job-card__label
              device-job-card__label--overdue
            "
          >
            overdue
          </span>

        </div>


        <div className="device-job-card__row">

          <span
            className="
              device-job-card__dot
              device-job-card__dot--today
            "
          />

          <strong>
            {today}
          </strong>

          <span
            className="
              device-job-card__label
              device-job-card__label--today
            "
          >
            due today
          </span>

        </div>


        <div className="device-job-card__row">

          <span
            className="
              device-job-card__dot
              device-job-card__dot--upcoming
            "
          />

          <strong>
            {upcoming}
          </strong>

          <span
            className="
              device-job-card__label
              device-job-card__label--upcoming
            "
          >
            upcoming
          </span>

        </div>

      </div>


      {image && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="device-job-card__image"
        />
      )}

    </button>
  )
}