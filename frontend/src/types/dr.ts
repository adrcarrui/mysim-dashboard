export interface Dr {
  id: number
  dr_id: string | null

  reported_date: string | null
  closing_date: string | null

  customer_description: string | null
  fault_description: string | null

  detected_by_id: number | null
  repetitions: number | null

  manufacturer_id_number: string | null
  ata: number | null

  close_remarks: string | null
  root_cause_analysis: string | null

  not_our: boolean | null

  priority_id: number | null
  status_id: number | null
  severity_id: number | null

  affected_system_id: number | null

  device_id: number | null
  device_name: string | null

  last_updated: string | null
}