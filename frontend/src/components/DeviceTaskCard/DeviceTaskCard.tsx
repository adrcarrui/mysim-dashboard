import "./DeviceTaskCard.css";

interface DeviceTaskCardProps {
  device: string;

  total: number;

  outOfTolerance: number;
  inTolerance: number;
  upcoming: number;

  onClick: () => void;
}

function getDeviceClass(
  device: string
) {
  switch (device) {
    case "A400M":
      return "device-task-card--a400m";

    case "C295":
      return "device-task-card--c295";

    case "C295 TS03":
      return "device-task-card--c295-ts03";

    case "CN235":
      return "device-task-card--cn235";

    case "MRTT":
      return "device-task-card--mrtt";

    default:
      return "";
  }
}

export function DeviceTaskCard({
  device,
  total,
  outOfTolerance,
  inTolerance,
  upcoming,
  onClick,
}: DeviceTaskCardProps) {
  return (
    <button
      type="button"
      className={[
        "device-task-card",
        getDeviceClass(device),
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <div className="device-task-card__header">
        <strong>
          {device}
        </strong>

        <span className="device-task-card__total">
          {total}
        </span>
      </div>

      <div className="device-task-card__label">
      </div>

      <div className="device-task-card__stats">
        <div className="device-task-card__stat device-task-card__stat--critical">
          <span className="device-task-card__dot" />

          <strong>
            {outOfTolerance}
          </strong>

          <span>
            out of tolerance
          </span>
        </div>

        <div className="device-task-card__stat device-task-card__stat--warning">
          <span className="device-task-card__dot" />

          <strong>
            {inTolerance}
          </strong>

          <span>
            in tolerance
          </span>
        </div>

        <div className="device-task-card__stat device-task-card__stat--normal">
          <span className="device-task-card__dot" />

          <strong>
            {upcoming}
          </strong>

          <span>
            upcoming
          </span>
        </div>
      </div>
    </button>
  );
}