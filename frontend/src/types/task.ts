// frontend/src/types/task.ts

export interface Task {
  scheduled_task_id: number;
  maintenance_task_id: number;

  schedule_code: string;

  device: string;
  task_code: string;

  description: string | null;

  planned_date: string;

  status: string;
  status_id: number;

  remarks: string | null;
  done_at: string | null;
  performed_by: number | null;
  performance_remarks: string | null;
}