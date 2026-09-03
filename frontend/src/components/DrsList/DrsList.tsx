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


interface DrGroup {
  key: string
  label: string
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
    return "—"
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
    return "—"
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date)
}


function getDateKey(
  value: string | null
): string {
  const date =
    parseDate(value)

  if (!date) {
    return "unknown"
  }

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    )

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    )

  return `${year}-${month}-${day}`
}


function getDateLabel(
  value: string | null
): string {
  const date =
    parseDate(value)

  if (!date) {
    return "Unknown date"
  }

  const today =
    new Date()

  today.setHours(
    0,
    0,
    0,
    0
  )

  const target =
    new Date(date)

  target.setHours(
    0,
    0,
    0,
    0
  )

  const differenceDays =
    Math.round(
      (
        target.getTime() -
        today.getTime()
      ) /
        86_400_000
    )


  if (
    differenceDays === 0
  ) {
    return "Today"
  }


  if (
    differenceDays === -1
  ) {
    return "Yesterday"
  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
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


function buildGroups(
  drs: Dr[]
): DrGroup[] {
  const sorted =
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
    )


  const groups =
    new Map<
      string,
      DrGroup
    >()


  for (
    const dr
    of sorted
  ) {
    const key =
      getDateKey(
        dr.reported_date
      )

    const existing =
      groups.get(key)

    if (existing) {
      existing.drs.push(dr)
      continue
    }

    groups.set(
      key,
      {
        key,
        label:
          getDateLabel(
            dr.reported_date
          ),
        drs: [dr],
      }
    )
  }


  return Array.from(
    groups.values()
  )
}


export function DrsList({
  drs,
}: DrsListProps) {
  const groups =
    useMemo(
      () =>
        buildGroups(drs),
      [drs]
    )


  if (
    drs.length === 0
  ) {
    return (
      <div className="drs-list__empty">
        No open DRs for this
        device.
      </div>
    )
  }


  return (
    <div className="drs-list">
      {groups.map(
        (group) => (
          <section
            key={
              group.key
            }
            className="drs-list__group"
          >
            <header className="drs-list__group-header">
              <h3 className="drs-list__group-title">
                {group.label}
              </h3>

              <span className="drs-list__group-count">
                {
                  group.drs
                    .length
                }
              </span>
            </header>


            <div className="drs-list__items">
              {group.drs.map(
                (dr) => (
                  <article
                    key={
                      dr.id
                    }
                    className="drs-list__item"
                  >
                    <div className="drs-list__item-accent" />


                    <div className="drs-list__main">
                      <div className="drs-list__top">
                        <div className="drs-list__identity">
                          <span className="drs-list__id">
                            {
                              dr.dr_id ||
                              `DR ${dr.id}`
                            }
                          </span>

                          <span className="drs-list__time">
                            {formatTime(
                              dr.reported_date
                            )}
                          </span>
                        </div>


                        {dr.repetitions !==
                          null &&
                          dr.repetitions >
                            1 && (
                          <span className="drs-list__repetitions">
                            {
                              dr.repetitions
                            }
                            × repeated
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


                      {dr.customer_description &&
                        dr.fault_description &&
                        dr.customer_description.trim() !==
                          dr.fault_description.trim() && (
                          <p className="drs-list__customer-description">
                            {
                              dr.customer_description
                            }
                          </p>
                        )}


                      <div className="drs-list__meta">
                        <div className="drs-list__meta-item">
                          <span className="drs-list__meta-label">
                            Reported
                          </span>

                          <span className="drs-list__meta-value">
                            {formatDate(
                              dr.reported_date
                            )}
                          </span>
                        </div>


                        {dr.ata !==
                          null && (
                          <div className="drs-list__meta-item">
                            <span className="drs-list__meta-label">
                              ATA
                            </span>

                            <span className="drs-list__meta-value">
                              {
                                dr.ata
                              }
                            </span>
                          </div>
                        )}


                        {dr.priority_id !==
                          null && (
                          <div className="drs-list__meta-item">
                            <span className="drs-list__meta-label">
                              Priority
                            </span>

                            <span className="drs-list__meta-value">
                              {
                                dr.priority_id
                              }
                            </span>
                          </div>
                        )}


                        {dr.severity_id !==
                          null && (
                          <div className="drs-list__meta-item">
                            <span className="drs-list__meta-label">
                              Severity
                            </span>

                            <span className="drs-list__meta-value">
                              {
                                dr.severity_id
                              }
                            </span>
                          </div>
                        )}


                        {dr.status_id !==
                          null && (
                          <div className="drs-list__meta-item">
                            <span className="drs-list__meta-label">
                              Status
                            </span>

                            <span className="drs-list__meta-value">
                              {
                                dr.status_id
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        )
      )}
    </div>
  )
}