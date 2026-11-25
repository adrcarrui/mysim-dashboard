type CachedValue<T> = {
  data: T;
  storedAt: number;
};

const values = new Map<string, CachedValue<unknown>>();
const pending = new Map<string, Promise<unknown>>();

let session: string | null = null;
let generation = 0;

export function setDataCacheSession(identity: string | null) {
  if (session === identity) return;

  session = identity;
  generation += 1;

  values.clear();
  pending.clear();
}

export function readDataCache<T>(
  key: string,
): CachedValue<T> | undefined {
  if (session === null) return undefined;

  return values.get(key) as CachedValue<T> | undefined;
}

export function fetchCachedData<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 120_000,
  force = false,
): Promise<T> {
  if (session === null) {
    return loader();
  }

  const cached = readDataCache<T>(key);

  if (
    !force &&
    cached &&
    Date.now() - cached.storedAt < ttl
  ) {
    return Promise.resolve(cached.data);
  }

  // Evita peticiones duplicadas para la misma consulta.
  const existing = pending.get(key);

  if (existing) {
    return existing as Promise<T>;
  }

  const startedGeneration = generation;

  const request = Promise.resolve()
    .then(loader)
    .then((data) => {
      // Una petición de la sesión anterior no rellena la caché.
      if (generation === startedGeneration) {
        values.set(key, {
          data,
          storedAt: Date.now(),
        });
      }

      return data;
    })
    .finally(() => {
      if (pending.get(key) === request) {
        pending.delete(key);
      }
    });

  pending.set(key, request);

  return request;
}