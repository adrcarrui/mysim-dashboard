export type Action = {
  id: string | null
  action_id: string | null

  device_id: number | null
  device: string | null

  status_id: number | null
  status: string | null

  performed_by_id: number | null
  performed_by: string | null

  assigned_to_id: number | null
  assigned_to: string | null

  shift_to_be_done_id: number | null
  shift_to_be_done: string | null

  date: string | null
  description: string | null
  last_updated: string | null
}