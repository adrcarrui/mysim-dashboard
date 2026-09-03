import "./DeviceActionCard.css"


interface DeviceActionCardProps {
  device: string

  total: number

  open: number
  ongoing: number
  today: number

  onClick: () => void
}


function getDeviceLabel(
  device: string
): string {
  if (device === "FFS A330 MRTT") {
    return "MRTT"
  }

  if (device === "FFS C295 EA03") {
    return "C295"
  }

  return device.replace(
    "FFS ",
    ""
  )
}


function getDeviceClass(
  device: string
): string {
  switch (device) {
    case "FFS A400M":
      return "device-action-card--a400m"

    case "FFS C295 EA03":
      return "device-action-card--c295"

    case "FFS C295 TS03":
      return "device-action-card--c295-ts03"

    case "FFS CN235":
      return "device-action-card--cn235"

    case "FFS A330 MRTT":
      return "device-action-card--mrtt"

    default:
      return ""
  }
}


export function DeviceActionCard({
  device,
  total,
  open,
  ongoing,
  today,
  onClick,
}: DeviceActionCardProps) {
  return (
    <button
      type="button"
      className={[
        "device-action-card",
        getDeviceClass(device),
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <div className="device-action-card__header">

        <strong>
          {getDeviceLabel(
            device
          )}
        </strong>

        <span className="device-action-card__total">
          {total}
        </span>

      </div>


      <div className="device-action-card__label">
      </div>


      <div className="device-action-card__stats">

        <div className="device-action-card__stat device-action-card__stat--open">

          <span className="device-action-card__dot" />

          <strong>
            {open}
          </strong>

          <span>
            open
          </span>

        </div>


        <div className="device-action-card__stat device-action-card__stat--ongoing">

          <span className="device-action-card__dot" />

          <strong>
            {ongoing}
          </strong>

          <span>
            on going
          </span>

        </div>


        <div className="device-action-card__stat device-action-card__stat--today">

          <span className="device-action-card__dot" />

          <strong>
            {today}
          </strong>

          <span>
            today
          </span>

        </div>

      </div>
    </button>
  )
}