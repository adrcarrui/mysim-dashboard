// frontend/src/api/tasks.ts
import { apiFetch } from "./client";
import type { Task } from "../types/task";

const API_BASE_URL = "http://localhost:8000/api";


export async function getUpcomingTasks(
  days = 7
): Promise<Task[]> {
  const response = await apiFetch(
    `${API_BASE_URL}/tasks/upcoming?days=${days}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load tasks: ${response.status}`
    );
  }

  return response.json();
}