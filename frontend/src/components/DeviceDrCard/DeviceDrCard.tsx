import {
  useMemo,
} from "react"

import type {
  Dr,
} from "../../types/dr"

import "./DeviceDrCard.css"


interface DeviceDrCardProps {
  deviceName: string
  drs: Dr[]
  image?: string
  variant?: "ffs" | "other"
  onClick: () => void
}


function formatShortDate(
  value: string | null
): string {
  if (!value) {
    return "—"
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—"
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
    }
  ).format(date)
}


export function DeviceDrCard({
  deviceName,
  drs,
  image,
  variant = "other",
  onClick,
}: DeviceDrCardProps) {
  const sortedDrs =
    useMemo(
      () =>
        [...drs].sort(
          (a, b) => {
            const aTime =
              a.reported_date
                ? new Date(
                    a.reported_date
                  ).getTime()
                : 0

            const bTime =
              b.reported_date
                ? new Date(
                    b.reported_date
                  ).getTime()
                : 0

            return (
              bTime -
              aTime
            )
          }
        ),
      [drs]
    )


  const latestDr =
    sortedDrs[0]


  const repeatedCount =
    drs.filter(
      (dr) =>
        (dr.repetitions ?? 0) >
        1
    ).length


  return (
    <button
      type="button"
      className={`
        device-dr-card
        device-dr-card--${variant}
      `}
      onClick={onClick}
    >
      {image && (
        <div className="device-dr-card__image-wrapper">
          <img
            className="device-dr-card__image"
            src={image}
            alt=""
            aria-hidden="true"
          />
        </div>
      )}


      <div className="device-dr-card__top">
        <div className="device-dr-card__heading">
          <span className="device-dr-card__device">
            {deviceName}
          </span>
        </div>

        <span className="device-dr-card__total">
          {drs.length}
        </span>
      </div>


      <div className="device-dr-card__metrics">
        <div className="device-dr-card__metric">
          <span className="device-dr-card__metric-label">
            Latest
          </span>

          <strong className="device-dr-card__metric-value">
            {formatShortDate(
              latestDr
                ?.reported_date ??
                null
            )}
          </strong>
        </div>


        <div className="device-dr-card__metric">
          <span className="device-dr-card__metric-label">
            Repeated
          </span>

          <strong className="device-dr-card__metric-value">
            {repeatedCount}
          </strong>
        </div>
      </div>
    </button>
  )
}