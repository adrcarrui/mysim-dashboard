import {
  useMemo,
} from "react"

import type {
  Task,
} from "../../types/task"

import "./TasksList.css"


interface TasksListProps {
  tasks: Task[]
}


function getStatusClass(
  statusId: number
): string {
  switch (statusId) {
    case 199:
      return "tasks-list__status--pending"

    case 200:
      return "tasks-list__status--progress"

    case 2542:
      return "tasks-list__status--not-done"

    default:
      return ""
  }
}


function getShortDescription(
  description: string | null
): string {
  if (!description) {
    return "No description available"
  }

  const maxLength = 220

  if (
    description.length <=
    maxLength
  ) {
    return description
  }

  return (
    description
      .slice(
        0,
        maxLength
      )
      .trim() + "..."
  )
}


function formatDate(
  value: string
): string {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-"
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  )
}


function formatTime(
  value: string
): string {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-"
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )
}


export function TasksList({
  tasks,
}: TasksListProps) {

  const sortedTasks =
    useMemo(
      () =>
        [...tasks].sort(
          (a, b) =>
            new Date(
              a.planned_date
            ).getTime()
            -
            new Date(
              b.planned_date
            ).getTime()
        ),
      [tasks]
    )


  if (
    sortedTasks.length === 0
  ) {
    return (
      <div className="tasks-list__empty">
        No scheduled tasks found.
      </div>
    )
  }


  return (
    <div className="tasks-list">

      {sortedTasks.map(
        (task) => (
          <article
            key={
              task.scheduled_task_id
            }
            className="tasks-list__item"
          >

            <div className="tasks-list__header">

              <div className="tasks-list__heading">

                <strong className="tasks-list__code">
                  Task #{task.scheduled_task_id}
                </strong>

                <span className="tasks-list__id">
                  {task.task_code}
                </span>

              </div>


              <span
                className={`
                  tasks-list__status
                  ${getStatusClass(
                    task.status_id
                  )}
                `}
              >
                {task.status}
              </span>

            </div>


            <p className="tasks-list__description">
              {getShortDescription(
                task.description
              )}
            </p>


            {task.remarks && (
              <p className="tasks-list__remarks">
                {task.remarks}
              </p>
            )}


            <div className="tasks-list__meta">

              <div className="tasks-list__meta-item">

                <span>
                  Planned
                </span>

                <strong>
                  {formatDate(
                    task.planned_date
                  )}
                </strong>

              </div>


              <div className="tasks-list__meta-item">

                <span>
                  Time
                </span>

                <strong>
                  {formatTime(
                    task.planned_date
                  )}
                </strong>

              </div>


              {task.frequency && (
                <div className="tasks-list__meta-item">

                  <span>
                    Frequency
                  </span>

                  <strong>
                    {task.frequency}
                  </strong>

                </div>
              )}


              {task.tolerance_status && (
                <div className="tasks-list__meta-item">

                  <span>
                    Tolerance
                  </span>

                  <strong>
                    {task.tolerance_status}
                  </strong>

                </div>
              )}

            </div>

          </article>
        )
      )}

    </div>
  )
}