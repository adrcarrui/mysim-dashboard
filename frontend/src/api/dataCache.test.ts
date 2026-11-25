import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCachedData, readDataCache, setDataCacheSession } from "./dataCache";

describe("data cache", () => {
  afterEach(() => {
    setDataCacheSession(null);
    vi.useRealTimers();
  });

  it("fetches without caching when there is no session", async () => {
    const loader = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    await expect(fetchCachedData("jobs", loader)).resolves.toBe("first");
    await expect(fetchCachedData("jobs", loader)).resolves.toBe("second");
    expect(readDataCache("jobs")).toBeUndefined();
  });

  it("reuses fresh data and reloads it after expiry or a manual refresh", async () => {
    vi.useFakeTimers();
    setDataCacheSession("user-a");
    const ttl = 1_000;
    const loader = vi.fn()
      .mockResolvedValueOnce("cached")
      .mockResolvedValueOnce("after expiry")
      .mockResolvedValueOnce("after refresh");

    await expect(fetchCachedData("jobs", loader, ttl)).resolves.toBe("cached");
    await expect(fetchCachedData("jobs", loader, ttl)).resolves.toBe("cached");
    expect(loader).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ttl);
    await expect(fetchCachedData("jobs", loader, ttl)).resolves.toBe("after expiry");
    await expect(fetchCachedData("jobs", loader, ttl, true)).resolves.toBe("after refresh");
    expect(loader).toHaveBeenCalledTimes(3);
    expect(readDataCache("jobs")?.data).toBe("after refresh");
  });

  it("deduplicates pending work and isolates requests across sessions", async () => {
    let resolveOld!: (data: string) => void;
    let resolveNew!: (data: string) => void;
    const oldResponse = new Promise<string>(resolve => { resolveOld = resolve; });
    const newResponse = new Promise<string>(resolve => { resolveNew = resolve; });
    const oldLoader = vi.fn(() => oldResponse);
    const newLoader = vi.fn(() => newResponse);

    setDataCacheSession("user-a");
    const oldRequest = fetchCachedData("jobs", oldLoader);
    expect(fetchCachedData("jobs", oldLoader)).toBe(oldRequest);

    setDataCacheSession("user-b");
    const newRequest = fetchCachedData("jobs", newLoader);
    expect(newRequest).not.toBe(oldRequest);

    resolveOld("old session data");
    await expect(oldRequest).resolves.toBe("old session data");
    expect(readDataCache("jobs")).toBeUndefined();
    expect(fetchCachedData("jobs", newLoader)).toBe(newRequest);

    resolveNew("new session data");
    await expect(newRequest).resolves.toBe("new session data");
    expect(readDataCache("jobs")?.data).toBe("new session data");
    expect(oldLoader).toHaveBeenCalledTimes(1);
    expect(newLoader).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after a request fails", async () => {
    setDataCacheSession("user-a");
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce("recovered");

    await expect(fetchCachedData("jobs", loader)).rejects.toThrow("Offline");
    expect(readDataCache("jobs")).toBeUndefined();
    await expect(fetchCachedData("jobs", loader)).resolves.toBe("recovered");
    expect(readDataCache("jobs")?.data).toBe("recovered");
  });
});
