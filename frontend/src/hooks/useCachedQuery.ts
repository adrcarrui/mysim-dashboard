import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchCachedData,
  readDataCache,
} from "../api/dataCache";

type QueryState<T> = {
  request: object;
  data: T | undefined;
  error: string | null;
  refreshing: boolean;
};

export function useCachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 120_000,
) {
  const request = useMemo(() => ({ key, loader, ttl }), [key, loader, ttl]);
  const [state, setState] = useState<QueryState<T> | null>(null);

  const mounted = useRef(false);
  const sequence = useRef(0);

  const load = useCallback(
    (force = false) => {
      const requestSequence = ++sequence.current;
      const { key, loader, ttl } = request;
      const cached = readDataCache<T>(key);
      const isCurrent = () => mounted.current && requestSequence === sequence.current;

      async function fetchQuery() {
        return fetchCachedData(key, loader, ttl, force);
      }

      return fetchQuery()
        .then((data) => {
          if (isCurrent()) {
            setState({ request, data, error: null, refreshing: false });
          }
        })
        .catch((err: unknown) => {
          if (isCurrent()) {
            setState({
              request,
              data: cached?.data,
              error: err instanceof Error
                ? err.message
                : "No se pudieron cargar los datos",
              refreshing: false,
            });
          }
        });
    },
    [request],
  );

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, [load]);

  const current =
    state?.request === request
      ? state
      : {
          data: readDataCache<T>(key)?.data,
          error: null,
          refreshing: true,
        };

  return {
    data: current.data,
    error: current.error,
    loading:
      current.data === undefined &&
      current.error === null,
    refreshing: current.refreshing,
    refresh: () => {
      setState({
        request,
        data: readDataCache<T>(key)?.data,
        error: null,
        refreshing: true,
      });
      void load(true);
    },
  };
}