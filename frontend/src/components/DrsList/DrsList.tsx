import {
  useMemo,
} from "react"

import type {
  Dr,
} from "../../types/dr"

import "./DrsList.css"


interface DrsListProps {
  drs: Dr[]
}


function parseDate(
  value: string | null
): Date | null {
  if (!value) {
    return null
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date
}


function formatDate(
  value: string | null
): string {
  const date =
    parseDate(value)

  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(date)
}


function formatTime(
  value: string | null
): string {
  const date =
    parseDate(value)

  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date)
}


function getDescription(
  dr: Dr
): string {
  return (
    dr.fault_description?.trim() ||
    dr.customer_description?.trim() ||
    "No description"
  )
}


export function DrsList({
  drs,
}: DrsListProps) {

  const sortedDrs =
    useMemo(
      () =>
        [...drs].sort(
          (a, b) => {
            const aTime =
              parseDate(
                a.reported_date
              )?.getTime() ??
              0

            const bTime =
              parseDate(
                b.reported_date
              )?.getTime() ??
              0

            return (
              bTime -
              aTime
            )
          }
        ),
      [drs]
    )


  if (
    sortedDrs.length === 0
  ) {
    return (
      <div className="drs-list__empty">
        No open DRs for this device.
      </div>
    )
  }


  return (
    <div className="drs-list">

      {sortedDrs.map(
        (dr) => (
          <article
            key={dr.id}
            className="drs-list__item"
          >

            <div className="drs-list__header">

              <div className="drs-list__heading">

                <div className="drs-list__identity">

                  <strong className="drs-list__id">
                    {
                      dr.dr_id ||
                      `DR ${dr.id}`
                    }
                  </strong>

                  <span className="drs-list__time">
                    {formatTime(
                      dr.reported_date
                    )}
                  </span>

                </div>


                {dr.customer_description &&
                  dr.fault_description &&
                  dr.customer_description.trim() !==
                    dr.fault_description.trim() && (
                    <span className="drs-list__alias">
                      {
                        dr.customer_description
                      }
                    </span>
                  )}

              </div>


              {dr.repetitions !== null &&
                dr.repetitions > 1 && (
                  <span className="drs-list__repetitions">
                    {dr.repetitions}× repeated
                  </span>
                )}

            </div>


            <p className="drs-list__description">
              {
                getDescription(
                  dr
                )
              }
            </p>


            <div className="drs-list__meta">

              <div className="drs-list__meta-item">

                <span>
                  Reported
                </span>

                <strong>
                  {formatDate(
                    dr.reported_date
                  )}
                </strong>

              </div>


              {dr.ata !== null && (
                <div className="drs-list__meta-item">

                  <span>
                    ATA
                  </span>

                  <strong>
                    {dr.ata}
                  </strong>

                </div>
              )}


              {dr.priority_id !== null && (
                <div className="drs-list__meta-item">

                  <span>
                    Priority
                  </span>

                  <strong>
                    {dr.priority_id}
                  </strong>

                </div>
              )}


              {dr.severity_id !== null && (
                <div className="drs-list__meta-item">

                  <span>
                    Severity
                  </span>

                  <strong>
                    {dr.severity_id}
                  </strong>

                </div>
              )}


              {dr.status_id !== null && (
                <div className="drs-list__meta-item">

                  <span>
                    Status
                  </span>

                  <strong>
                    {dr.status_id}
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