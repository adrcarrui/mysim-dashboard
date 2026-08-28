import type { Dr } from "../types/dr"

const API_BASE_URL = "http://localhost:8000"

export async function getOpenDrs(
  deviceId?: number
): Promise<Dr[]> {
  let url = `${API_BASE_URL}/api/drs/open`

  if (deviceId !== undefined) {
    url += `?device_id=${deviceId}`
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("Error loading open DRs")
  }

  return response.json()
}