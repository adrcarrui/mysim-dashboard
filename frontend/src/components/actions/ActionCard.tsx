import type { Action } from "../../types/action"

type Props = {
  action: Action
}

function htmlToText(value?: string | null) {
  if (!value) {
    return ""
  }

  const element = document.createElement("div")
  element.innerHTML = value

  return element.textContent ?? element.innerText ?? ""
}

function getStatusLabel(status?: number | null) {
  switch (status) {
    case 19:
      return "OPEN"

    case 20:
      return "IN PROGRESS"

    case 22:
      return "DONE"

    default:
      return `STATUS ${status ?? "-"}`
  }
}

export function ActionCard({
  action,
}: Props) {
  return (
    <div className="job-card">
      <div className="job-card__header">
        <span className="job-number">
          {action.action_id ?? `Action ${action.id ?? "-"}`}
        </span>

        <span className="urgency">
          {getStatusLabel(action.status_id)}
        </span>
      </div>

      <div className="job-device">
        {action.device ?? "Unknown device"}
      </div>

      <div className="job-description">
        {htmlToText(action.description) ||
          "No description"}
      </div>

      <div className="job-meta">
        <span>
          Date: {action.date ?? "-"}
        </span>

        <span>
          Status: {action.status ?? "-"}
        </span>
      </div>
    </div>
  )
}
