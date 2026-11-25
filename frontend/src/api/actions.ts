import { apiFetch } from "./client";
import type { Action } from "../types/action";

const API_BASE_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`;

type GetOpenActionsParams = {
  fromDate?: string;
  toDate?: string;
};

export async function getOpenActions(
  params: GetOpenActionsParams = {},
): Promise<Action[]> {
  const searchParams = new URLSearchParams();

  if (params.fromDate) {
    searchParams.set("from_date", params.fromDate);
  }

  if (params.toDate) {
    searchParams.set("to_date", params.toDate);
  }

  const queryString = searchParams.toString();

  const url =
    `${API_BASE_URL}/api/actions/open` +
    (queryString ? `?${queryString}` : "");

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
      `Error cargando Actions: HTTP ${response.status}. ${detail}`,
    );
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "La respuesta de Actions no contiene una lista",
    );
  }

  return data as Action[];
}