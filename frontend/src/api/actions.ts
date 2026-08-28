import type { Action } from "../types/action"

const API_BASE_URL = "http://localhost:8000"

export async function getOpenActions(): Promise<Action[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/actions/open`
  )

  if (!response.ok) {
    throw new Error(
      `Error loading open actions: ${response.status}`
    )
  }

  return response.json()
}