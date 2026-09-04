import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarClock,
  Clock3,
} from "lucide-react";

import {
  getAvailability,
} from "../../api/availability";

import type {
  DeviceAvailability,
} from "../../types/availability";

import "./Availability.css";


function formatDateInput(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}


function formatTime(
  value: string,
): string {
  return new Date(value)
    .toLocaleTimeString(
      "es-ES",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );
}


function formatDuration(
  minutes: number,
): string {
  const hours = Math.floor(
    minutes / 60,
  );

  const remainingMinutes =
    minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return (
    `${hours} h ` +
    `${remainingMinutes} min`
  );
}


function sortDevices(
  devices: DeviceAvailability[],
): DeviceAvailability[] {
  return [...devices].sort(
    (a, b) => {
      const aIsFfs =
        a.deviceName
          .toUpperCase()
          .startsWith("FFS");

      const bIsFfs =
        b.deviceName
          .toUpperCase()
          .startsWith("FFS");

      if (
        aIsFfs &&
        !bIsFfs
      ) {
        return -1;
      }

      if (
        !aIsFfs &&
        bIsFfs
      ) {
        return 1;
      }

      return a.deviceName.localeCompare(
        b.deviceName,
      );
    },
  );
}


export function Availability() {
  const today = useMemo(
    () => new Date(),
    [],
  );

  const tomorrow = useMemo(
    () => {
      const value = new Date(
        today,
      );

      value.setDate(
        value.getDate() + 1,
      );

      return value;
    },
    [today],
  );

  const [
    fromDate,
    setFromDate,
  ] = useState(
    formatDateInput(today),
  );

  const [
    toDate,
    setToDate,
  ] = useState(
    formatDateInput(tomorrow),
  );

  const [
    devices,
    setDevices,
  ] = useState<
    DeviceAvailability[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);


  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data =
          await getAvailability(
            fromDate,
            toDate,
          );

        if (!cancelled) {
          setDevices(
            sortDevices(data),
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            "Unable to load availability.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    fromDate,
    toDate,
  ]);


  if (loading) {
    return (
      <main className="availability-page">
        Loading availability...
      </main>
    );
  }


  if (error) {
    return (
      <main className="availability-page">
        <div className="availability-page__error">
          {error}
        </div>
      </main>
    );
  }


  return (
    <main className="availability-page">
      <header className="availability-page__header">
        <div>

          <h1 className="availability-page__title">
            Availability
          </h1>

        </div>

        <div className="availability-page__filters">
          <label>
            <span>
              From
            </span>

            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              To
            </span>

            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value,
                )
              }
            />
          </label>
        </div>
      </header>

      {devices.length === 0 ? (
        <div className="availability-page__empty">
          No devices found.
        </div>
      ) : (
        <div className="availability-grid">
          {devices.map(
            (device) => (
              <article
                key={device.deviceId}
                className="availability-card"
              >
                <div className="availability-card__header">
                  <div>
                    <h2>
                      {device.deviceName}
                    </h2>

                    <span>
                      Device #{device.deviceId}
                    </span>
                  </div>

                  <CalendarClock
                    size={22}
                    strokeWidth={1.8}
                  />
                </div>


                <div className="availability-card__summary">
                  <div className="availability-card__summary-item availability-card__summary-item--available">
                    <span>
                      Available
                    </span>

                    <strong>
                      {formatDuration(
                        device
                          .totalAvailableMinutes,
                      )}
                    </strong>
                  </div>

                  <div className="availability-card__summary-item">
                    <span>
                      Occupied
                    </span>

                    <strong>
                      {formatDuration(
                        device
                          .totalOccupiedMinutes,
                      )}
                    </strong>
                  </div>
                </div>


                <div className="availability-card__windows">
                  <h3>
                    Free windows
                  </h3>

                  {
                    device.available.length === 0
                      ? (
                        <div className="availability-card__no-slots">
                          No availability
                        </div>
                      )
                      : (
                        device.available.map(
                          (
                            interval,
                            index,
                          ) => (
                            <div
                              key={
                                `${interval.start}-${index}`
                              }
                              className="availability-window"
                            >
                              <Clock3
                                size={17}
                                strokeWidth={1.8}
                              />

                              <div>
                                <strong>
                                  {
                                    formatTime(
                                      interval.start,
                                    )
                                  }
                                  {" - "}
                                  {
                                    formatTime(
                                      interval.end,
                                    )
                                  }
                                </strong>

                                <span>
                                  {
                                    formatDuration(
                                      interval
                                        .durationMinutes,
                                    )
                                  }
                                </span>
                              </div>
                            </div>
                          ),
                        )
                      )
                  }
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </main>
  );
}