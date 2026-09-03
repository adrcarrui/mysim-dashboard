import type { Action } from "../types/action"

const API_BASE_URL = "http://localhost:8000"

type GetOpenActionsParams = {
  fromDate?: string
  toDate?: string
}

export async function getOpenActions(
  params: GetOpenActionsParams = {}
): Promise<Action[]> {
  const searchParams = new URLSearchParams()

  if (params.fromDate) {
    searchParams.set("from_date", params.fromDate)
  }

  if (params.toDate) {
    searchParams.set("to_date", params.toDate)
  }

  const queryString = searchParams.toString()

  const url = queryString
    ? `${API_BASE_URL}/api/actions/open?${queryString}`
    : `${API_BASE_URL}/api/actions/open`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Error loading open actions: ${response.status}`
    )
  }

  return response.json()
}