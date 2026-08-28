import type { Task } from '../types/task'

const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`

export async function getUpcomingTasks(
  days = 7,
): Promise<Task[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/tasks/upcoming?days=${days}`
  )

  if (!response.ok) {
    throw new Error(
      `Error loading tasks: ${response.status}`
    )
  }

  return response.json()
}