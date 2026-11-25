import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  fetchCachedData,
  readDataCache,
} from "../api/dataCache";

type QueryState<T> = {
  key: string;
  data: T | undefined;
  error: string | null;
  refreshing: boolean;
};

export function useCachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = 120_000,
) {
  const [state, setState] = useState<QueryState<T>>(() => ({
    key,
    data: readDataCache<T>(key)?.data,
    error: null,
    refreshing: false,
  }));

  const mounted = useRef(false);
  const sequence = useRef(0);

  const load = useCallback(
    async (force = false) => {
      const requestSequence = ++sequence.current;
      const cached = readDataCache<T>(key);

      setState({
        key,
        data: cached?.data,
        error: null,
        refreshing: true,
      });

      try {
        const data = await fetchCachedData(
          key,
          loader,
          ttl,
          force,
        );

        if (
          mounted.current &&
          requestSequence === sequence.current
        ) {
          setState({
            key,
            data,
            error: null,
            refreshing: false,
          });
        }
      } catch (err) {
        if (
          mounted.current &&
          requestSequence === sequence.current
        ) {
          setState({
            key,
            data: cached?.data,
            error:
              err instanceof Error
                ? err.message
                : "No se pudieron cargar los datos",
            refreshing: false,
          });
        }
      }
    },
    [key, loader, ttl],
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
    state.key === key
      ? state
      : {
          key,
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
      void load(true);
    },
  };
}