export interface Job {
  id: number
  job_number: string
  target_date: string | null

  description: string | null
  alias: string | null

  device_id: number | null
  device_name: string | null

  priority_id: number | null
  priority: number | null

  status_id: number | null
  assigned_to_id: number | null

  related_maintenance_task_id: number | null

  days_remaining: number | null
  urgency: string | null
}