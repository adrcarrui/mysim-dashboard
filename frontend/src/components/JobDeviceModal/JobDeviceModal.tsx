import {
  useMemo,
  useState,
} from "react"

import type {
  Job,
} from "../../types/job"

import {
  JobsList,
} from "../JobsList"

import "./JobDeviceModal.css"


interface JobDeviceModalProps {
  device: string | null
  jobs: Job[]
  onClose: () => void
}


type JobFilter =
  | "all"
  | "overdue"
  | "today"
  | "upcoming"


function matchesFilter(
  job: Job,
  filter: JobFilter,
): boolean {
  if (
    filter === "all"
  ) {
    return true
  }

  if (
    job.days_remaining === null
  ) {
    return false
  }

  if (
    filter === "overdue"
  ) {
    return (
      job.days_remaining < 0
    )
  }

  if (
    filter === "today"
  ) {
    return (
      job.days_remaining === 0
    )
  }

  return (
    job.days_remaining > 0
  )
}


export function JobDeviceModal({
  device,
  jobs,
  onClose,
}: JobDeviceModalProps) {

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<JobFilter>(
    "all"
  )


  const counts =
    useMemo(
      () => ({
        all:
          jobs.length,

        overdue:
          jobs.filter(
            (job) =>
              job.days_remaining !== null &&
              job.days_remaining < 0
          ).length,

        today:
          jobs.filter(
            (job) =>
              job.days_remaining === 0
          ).length,

        upcoming:
          jobs.filter(
            (job) =>
              job.days_remaining !== null &&
              job.days_remaining > 0
          ).length,
      }),
      [jobs]
    )


  const filteredJobs =
    useMemo(
      () =>
        jobs.filter(
          (job) =>
            matchesFilter(
              job,
              activeFilter
            )
        ),
      [
        jobs,
        activeFilter,
      ]
    )


  if (!device) {
    return null
  }


  return (
    <div
      className="job-device-modal__overlay"
      onMouseDown={onClose}
    >

      <div
        className="job-device-modal"
        onMouseDown={
          (event) =>
            event.stopPropagation()
        }
      >

        <header className="job-device-modal__header">

          <div className="job-device-modal__header-top">

            <div className="job-device-modal__title-row">

              <h2>
                {device}
              </h2>

              <span className="job-device-modal__job-count">
                {jobs.length} jobs
              </span>

            </div>


            <button
              type="button"
              className="job-device-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>

          </div>


          <div className="job-device-modal__filters">

            <button
              type="button"
              className={`
                job-device-modal__filter
                job-device-modal__filter--all
                ${
                  activeFilter === "all"
                    ? "job-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "all"
                )
              }
            >

              <span>
                All
              </span>

              <strong>
                {counts.all}
              </strong>

            </button>


            <button
              type="button"
              className={`
                job-device-modal__filter
                job-device-modal__filter--overdue
                ${
                  activeFilter === "overdue"
                    ? "job-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "overdue"
                )
              }
            >

              <span>
                Overdue
              </span>

              <strong>
                {counts.overdue}
              </strong>

            </button>


            <button
              type="button"
              className={`
                job-device-modal__filter
                job-device-modal__filter--today
                ${
                  activeFilter === "today"
                    ? "job-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "today"
                )
              }
            >

              <span>
                Today
              </span>

              <strong>
                {counts.today}
              </strong>

            </button>


            <button
              type="button"
              className={`
                job-device-modal__filter
                job-device-modal__filter--upcoming
                ${
                  activeFilter === "upcoming"
                    ? "job-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "upcoming"
                )
              }
            >

              <span>
                Upcoming
              </span>

              <strong>
                {counts.upcoming}
              </strong>

            </button>

          </div>

        </header>


        <div className="job-device-modal__content">

          <JobsList
            jobs={
              filteredJobs
            }
          />

        </div>

      </div>

    </div>
  )
}