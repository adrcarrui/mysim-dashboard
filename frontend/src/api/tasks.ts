// frontend/src/api/tasks.ts

import type { Task } from "../types/task";

const API_BASE_URL = "http://localhost:8000/api";


export async function getUpcomingTasks(
  days = 7
): Promise<Task[]> {
  const response = await fetch(
    `${API_BASE_URL}/tasks/upcoming?days=${days}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load tasks: ${response.status}`
    );
  }

  return response.json();
}