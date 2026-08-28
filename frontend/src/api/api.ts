import type { Dr } from "../types/dr";

const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`;


export async function getOpenDrs(
  deviceId?: number
): Promise<Dr[]> {

  const params = new URLSearchParams();

  if (deviceId !== undefined) {
    params.set("device_id", String(deviceId));
  }

  const query = params.toString();

  const url =
    `${API_BASE_URL}/api/drs/open` +
    (query ? `?${query}` : "");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Error fetching DRs: ${response.status}`
    );
  }

  return response.json();
}