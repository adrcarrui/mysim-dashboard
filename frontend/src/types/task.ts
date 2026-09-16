export type TaskPlanningCategory =
  | "out_of_tolerance"
  | "backlog"
  | "today"
  | "upcoming"
  | "unknown_tolerance"


export type TaskToleranceStatus =
  | "out_of_tolerance"
  | "in_tolerance"
  | "upcoming"
  | "unknown_tolerance"


export interface Task {
  scheduled_task_id: number
  maintenance_task_id: number

  schedule_code: string

  device: string
  device_id: number | null

  task_code: string

  preventive_manual_version:
    | string
    | null

  description: string | null

  frequency_id: number | null
  frequency: string | null
  frequency_num_of_days:
    | number
    | null

  planned_date: string

  tolerance_start: string | null
  tolerance_end: string | null

  tolerance_status:
    | TaskToleranceStatus
    | null

  planning_category:
    | TaskPlanningCategory
    | null

  status: string
  status_id: number

  remarks: string | null
  done_at: string | null
  performed_by: number | null
  performance_remarks:
    | string
    | null
}