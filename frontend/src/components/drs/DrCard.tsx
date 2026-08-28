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
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">
          {dr.dr_id ?? `DR ${dr.id}`}
        </h3>

        <span className="text-sm text-slate-400">
          {dr.device_name ?? "Unknown"}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-300">
        {dr.customer_description ??
          dr.fault_description ??
          "Sin descripción"}
      </p>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
        <span>
          Reported: {formatDate(dr.reported_date)}
        </span>

        <span>
          Severity: {getSeverityLabel(dr.severity_id)}
        </span>

        <span>
          Repetitions: {dr.repetitions ?? 0}
        </span>

        {dr.ata !== null && (
          <span>
            ATA: {dr.ata}
          </span>
        )}
      </div>
    </div>
  )
}