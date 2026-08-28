import type { Dr } from "../../types/dr"

type Props = {
  dr: Dr
}

export function DrCard({ dr }: Props) {
  function formatDate(value: string | null) {
    if (!value) {
      return "-"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString()
  }

  function getSeverityLabel(
    severityId: number | null
  ) {
    switch (severityId) {
      case 126:
        return "HIGH IMPACT"

      case 127:
        return "LOW IMPACT"

      default:
        return "UNKNOWN"
    }
  }

  return (
    <div className="job-card">
      <div className="job-card__header">
        <span className="job-number">
          {dr.dr_id ?? `DR ${dr.id}`}
        </span>

        <span className="urgency">
          {getSeverityLabel(dr.severity_id)}
        </span>
      </div>

      <div className="job-device">
        {dr.device_name ?? "Unknown device"}
      </div>

      <div className="job-description">
        {dr.customer_description ??
          dr.fault_description ??
          "No description"}
      </div>

      <div className="job-meta">
        <span>
          Reported: {formatDate(dr.reported_date)}
        </span>

        <span>
          Repetitions: {dr.repetitions ?? 0}
        </span>

        <span>
          ATA: {dr.ata ?? "-"}
        </span>
      </div>
    </div>
  )
}