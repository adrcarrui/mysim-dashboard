import { apiFetch } from "./client";
import type { Dr } from "../types/dr";

const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`;

export async function getOpenDrs(
  deviceId?: number,
): Promise<Dr[]> {
  const params = new URLSearchParams();

  if (deviceId !== undefined) {
    params.set("device_id", String(deviceId));
  }

  const query = params.toString();

  const url =
    `${API_BASE_URL}/api/drs/open` +
    (query ? `?${query}` : "");

  const response = await apiFetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;

    try {
      const error = await response.json();

      if (typeof error.detail === "string") {
        detail = error.detail;
      }
    } catch {
      // La respuesta de error puede no ser JSON.
    }

    throw new Error(
      `Error cargando DRs: HTTP ${response.status}. ${detail}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "La respuesta de DRs no contiene una lista",
    );
  }

  return data as Dr[];
}