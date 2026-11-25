import { apiFetch } from "./client";
import type { Job } from "../types/job";

const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`;

async function loadJobs(path: string): Promise<Job[]> {
  const response = await apiFetch(
    `${API_BASE_URL}${path}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

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
      `Error cargando Jobs: HTTP ${response.status}. ${detail}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "La respuesta de Jobs no contiene una lista",
    );
  }

  return data as Job[];
}

export async function getOpenJobs(): Promise<Job[]> {
  return loadJobs("/api/jobs/open");
}

export async function getExpiringJobs(
  days = 7,
): Promise<Job[]> {
  return loadJobs(
    `/api/jobs/expiring?days=${encodeURIComponent(String(days))}`,
  );
}

export async function getOverdueJobs(): Promise<Job[]> {
  return loadJobs("/api/jobs/overdue");
}