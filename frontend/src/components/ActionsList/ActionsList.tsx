import {
  useMemo,
} from "react"

import type {
  Action,
} from "../../types/action"

import "./ActionsList.css"


interface ActionsListProps {
  actions: Action[]
}


function getStatusClass(
  statusId: number | null,
): string {
  switch (statusId) {
    case 19:
      return "actions-list__status--open"

    case 20:
      return "actions-list__status--ongoing"

    default:
      return ""
  }
}


function getShortDescription(
  description: string | null,
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
  value: string | null,
): string {
  if (!value) {
    return "-"
  }

  const date =
    new Date(
      value.replace(
        " ",
        "T"
      )
    )

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
  value: string | null,
): string {
  if (!value) {
    return "-"
  }

  const date =
    new Date(
      value.replace(
        " ",
        "T"
      )
    )

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


export function ActionsList({
  actions,
}: ActionsListProps) {

  const sortedActions =
    useMemo(
      () =>
        [...actions].sort(
          (a, b) =>
            (
              a.date ?? ""
            ).localeCompare(
              b.date ?? ""
            )
        ),
      [actions]
    )


  if (
    sortedActions.length === 0
  ) {
    return (
      <div className="actions-list__empty">
        No actions found.
      </div>
    )
  }


  return (
    <div className="actions-list">

      {sortedActions.map(
        (action) => (
          <article
            key={
              action.id ??
              action.action_id ??
              ""
            }
            className="actions-list__item"
          >

            <div className="actions-list__header">

              <div className="actions-list__heading">

                <strong className="actions-list__id">
                  {
                    action.action_id ??
                    "Action"
                  }
                </strong>

                <span className="actions-list__date">
                  {formatDate(
                    action.date
                  )}
                  {" · "}
                  {formatTime(
                    action.date
                  )}
                </span>

              </div>


              <span
                className={`
                  actions-list__status
                  ${getStatusClass(
                    action.status_id
                  )}
                `}
              >
                {
                  action.status ??
                  "-"
                }
              </span>

            </div>


            <p className="actions-list__description">
              {getShortDescription(
                action.description
              )}
            </p>


            <div className="actions-list__meta">

              <div className="actions-list__meta-item">

                <span>
                  Assigned
                </span>

                <strong>
                  {
                    action.assigned_to ??
                    "-"
                  }
                </strong>

              </div>


              <div className="actions-list__meta-item">

                <span>
                  Open by
                </span>

                <strong>
                  {
                    action.performed_by ??
                    "-"
                  }
                </strong>

              </div>


              <div className="actions-list__meta-item">

                <span>
                  Shift
                </span>

                <strong>
                  {
                    action.shift_to_be_done ??
                    "-"
                  }
                </strong>

              </div>

            </div>

          </article>
        )
      )}

    </div>
  )
}