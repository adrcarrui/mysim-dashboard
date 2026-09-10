import type {
  DeviceAvailability,
} from "../types/availability";


const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000/api`;


export async function getAvailability(
  fromDate: string,
  toDate: string,
  forceRefresh = false,
): Promise<DeviceAvailability[]> {

  const params =
    new URLSearchParams({
      from_date: fromDate,
      to_date: toDate,
    });

  if (forceRefresh) {
    params.set("force_refresh", "true");
  }

  const response = await fetch(
    `${API_BASE_URL}/availability?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      `Error loading availability: ${response.status}`,
    );
  }

  return response.json();
}
