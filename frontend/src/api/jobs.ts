import type {
  Job,
} from "../types/job"


const API_BASE_URL =
  "http://localhost:8000"


export async function getOpenJobs():
Promise<Job[]> {

  const response =
    await fetch(
      `${API_BASE_URL}/api/jobs/open`
    )


  if (!response.ok) {
    throw new Error(
      "Error loading open jobs"
    )
  }


  return response.json()
}


export async function getExpiringJobs(
  days = 7
): Promise<Job[]> {

  const response =
    await fetch(
      `${API_BASE_URL}/api/jobs/expiring?days=${days}`
    )


  if (!response.ok) {
    throw new Error(
      "Error loading expiring jobs"
    )
  }


  return response.json()
}


export async function getOverdueJobs():
Promise<Job[]> {

  const response =
    await fetch(
      `${API_BASE_URL}/api/jobs/overdue`
    )


  if (!response.ok) {
    throw new Error(
      "Error loading overdue jobs"
    )
  }


  return response.json()
}