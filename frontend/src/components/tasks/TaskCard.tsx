import type { Task } from '../types/task'


interface TaskCardProps {
  task: Task
}


function getUrgency(plannedDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(plannedDate)
  target.setHours(0, 0, 0, 0)

  const diffMs =
    target.getTime() - today.getTime()

  const diffDays = Math.round(
    diffMs / 86400000
  )

  if (diffDays < 0) {
    return {
      label: 'overdue',
      className: 'overdue',
    }
  }

  if (diffDays === 0) {
    return {
      label: 'today',
      className: 'today',
    }
  }

  if (diffDays === 1) {
    return {
      label: 'tomorrow',
      className: 'tomorrow',
    }
  }

  return {
    label: `${diffDays} days`,
    className: 'upcoming',
  }
}


function getStatusLabel(task: Task) {
  switch (task.status_id) {
    case 199:
      return 'Pending'
    case 200:
      return 'In process'
    case 2542:
      return 'Not done'
    case 201:
      return 'Done'
    default:
      return task.status
  }
}


export default function TaskCard({
  task,
}: TaskCardProps) {
  const urgency = getUrgency(
    task.planned_date
  )

  const plannedDate =
    new Date(
      task.planned_date
    ).toLocaleDateString('en-GB')

  return (
    <div className="job-card">

      <div className="job-card__header">

        <span className="job-number">
          {task.task_id}
        </span>

        <span
          className={
            `urgency ${urgency.className}`
          }
        >
          {urgency.label}
        </span>

      </div>

      <div className="job-device">
        {task.device}
      </div>

      <div className="job-description">
        {task.description}
      </div>

      <div className="job-meta">

        <span>
          Planned: {plannedDate}
        </span>

        <span>
          {getStatusLabel(task)}
        </span>

      </div>

    </div>
  )
}