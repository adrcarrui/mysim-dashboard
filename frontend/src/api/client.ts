import { setDataCacheSession } from "./dataCache";

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    setDataCacheSession(null);

    window.dispatchEvent(
      new Event("mysim:session-invalid"),
    );
  }

  return response;
}