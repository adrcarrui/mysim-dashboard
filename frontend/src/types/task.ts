export interface Task {
  scheduled_task_id: number;
  maintenance_task_id: number;

  schedule_code: string;

  device: string;
  task_code: string;

  description: string | null;

  frequency_id: number | null;
  frequency: string | null;
  frequency_num_of_days: number | null;

  planned_date: string;

  tolerance_start: string | null;
  tolerance_end: string | null;
  tolerance_status:
    | "out_of_tolerance"
    | "in_tolerance"
    | "upcoming"
    | "unknown_tolerance"
    | null;

  status: string;
  status_id: number;

  remarks: string | null;
  done_at: string | null;
  performed_by: number | null;
  performance_remarks: string | null;
}