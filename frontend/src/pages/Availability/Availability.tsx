import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import type {
  CSSProperties,
} from "react";

import {
  CalendarClock,
  Clock3,
  RefreshCw,
  X,
} from "lucide-react";

import {
  getAvailability,
} from "../../api/availability";
import type {
  AvailabilityCacheMetadata,
} from "../../api/availability";

import {
  getRecommendations,
} from "../../api/recommendations";

import type {
  DeviceAvailability,
} from "../../types/availability";

import type {
  DeviceRecommendations,
  RecommendedWindow,
  TaskRecommendation,
} from "../../types/recommendation";

import a400mImage from "../../assets/devices/a400m.png";
import mrttImage from "../../assets/devices/mrtt.png";
import c295Ts03Image from "../../assets/devices/c295-ts03.png";
import c295Ea03Image from "../../assets/devices/c295.png";
import cn235Image from "../../assets/devices/cn235.png";

import "./Availability.css";


const FFS_DEVICE_ORDER = [
  "FFS A400M",
  "FFS A330 MRTT",
  "FFS C295 TS03",
  "FFS C295 EA03",
  "FFS CN235",
];


const FFS_DEVICE_IMAGES: Record<
  string,
  string
> = {
  "FFS A400M":
    a400mImage,

  "FFS A330 MRTT":
    mrttImage,

  "FFS C295 TS03":
    c295Ts03Image,

  "FFS C295 EA03":
    c295Ea03Image,

  "FFS CN235":
    cn235Image,
};


function formatDateInput(
  date: Date,
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return (
    `${year}-${month}-${day}`
  );
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


function formatDay(
  value: string,
): string {
  return new Date(value)
    .toLocaleDateString(
      "es-ES",
      {
        weekday: "short",
        day: "2-digit",
        month: "short",
      },
    );
}


function formatShortDate(
  value: string,
): string {
  return new Date(value)
    .toLocaleDateString(
      "es-ES",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
}


function formatDuration(
  minutes: number,
): string {
  const hours =
    Math.floor(
      minutes / 60,
    );

  const remainingMinutes =
    minutes % 60;


  if (minutes === 1440) {
    return "All day";
  }


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


function normalizeDeviceName(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}


function getDisplayDeviceName(
  deviceName: string,
): string {
  return deviceName.replace(
    /^FFS\s+/i,
    "",
  );
}


function getFfsOrder(
  deviceName: string,
): number {
  const normalized =
    normalizeDeviceName(
      deviceName,
    );

  return FFS_DEVICE_ORDER.findIndex(
    (device) =>
      normalizeDeviceName(
        device,
      ) === normalized,
  );
}


function isFfsDevice(
  deviceName: string,
): boolean {
  return (
    getFfsOrder(
      deviceName,
    ) !== -1
  );
}


function groupIntervalsByDay(
  intervals:
    DeviceAvailability[
      "available"
    ],
): Array<
  [
    string,
    DeviceAvailability[
      "available"
    ],
  ]
> {
  const groups = new Map<
    string,
    DeviceAvailability[
      "available"
    ]
  >();


  for (
    const interval
    of intervals
  ) {
    const date =
      new Date(
        interval.start,
      );


    const key = [
      date.getFullYear(),

      String(
        date.getMonth() + 1,
      ).padStart(
        2,
        "0",
      ),

      String(
        date.getDate(),
      ).padStart(
        2,
        "0",
      ),
    ].join("-");


    const current =
      groups.get(key) ?? [];


    current.push(
      interval,
    );


    groups.set(
      key,
      current,
    );
  }


  return Array.from(
    groups.entries(),
  );
}


function getToleranceLabel(
  value: string,
): string {
  if (
    value ===
    "within_tolerance"
  ) {
    return "Within tolerance";
  }


  if (
    value ===
    "overdue"
  ) {
    return "Overdue";
  }


  if (
    value ===
    "unknown"
  ) {
    return "Unknown tolerance";
  }


  return value.replaceAll(
    "_",
    " ",
  );
}


function formatRecommendedWindow(
  window: RecommendedWindow,
): string {
  if (
    window.durationMinutes
    === 1440
  ) {
    return (
      `${formatShortDate(
        window.start,
      )} · All day`
    );
  }


  const startDate =
    new Date(
      window.start,
    );

  const endDate =
    new Date(
      window.end,
    );


  const sameDay =
    startDate.toDateString()
    ===
    endDate.toDateString();


  if (sameDay) {
    return (
      `${formatShortDate(
        window.start,
      )} · ` +
      `${formatTime(
        window.start,
      )} - ` +
      `${formatTime(
        window.end,
      )}`
    );
  }


  return (
    `${formatShortDate(
      window.start,
    )} ` +
    `${formatTime(
      window.start,
    )} - ` +
    `${formatShortDate(
      window.end,
    )} ` +
    `${formatTime(
      window.end,
    )}`
  );
}


interface RecommendationTaskProps {
  task:
    TaskRecommendation;
}


function RecommendationTask({
  task,
}: RecommendationTaskProps) {
  if (!task.bestWindow) {
    return null;
  }


  return (
    <article
      className="availability-task"
    >
      <div
        className="availability-task__header"
      >
        <div
          className="availability-task__heading"
        >
          <span
            className="availability-task__code"
          >
            Task {task.taskCode}
          </span>


          <h3>
            {
              task.description
              ?? "Maintenance task"
            }
          </h3>
        </div>


        <span
          className={
            task
              .bestWindow
              .windowToleranceStatus
            === "overdue"
              ? (
                "availability-task__status " +
                "availability-task__status--overdue"
              )
              : (
                "availability-task__status"
              )
          }
        >
          {getToleranceLabel(
            task
              .bestWindow
              .windowToleranceStatus,
          )}
        </span>
      </div>


      <div
        className="availability-task__planned"
      >
        <span>
          Planned
        </span>


        <strong>
          {formatShortDate(
            task.plannedDate,
          )}

          {" · "}

          {formatTime(
            task.plannedDate,
          )}
        </strong>
      </div>


      <div
        className="availability-task__best-window"
      >
        <div
          className="availability-task__best-window-title"
        >
          <Clock3
            size={15}
            strokeWidth={1.8}
          />


          <span>
            Best window
          </span>
        </div>


        <strong>
          {formatRecommendedWindow(
            task.bestWindow,
          )}
        </strong>


        <div
          className="availability-task__best-window-meta"
        >
          <span>
            {formatDuration(
              task
                .bestWindow
                .durationMinutes,
            )}
          </span>


          <span>
            Score:
            {" "}
            {task.bestWindow.score}
          </span>
        </div>
      </div>


      <div
        className="availability-task__meta"
      >
        <span>
          Status:
          {" "}
          <strong>
            {task.status}
          </strong>
        </span>


        {task.frequency && (
          <span>
            Frequency:
            {" "}
            <strong>
              {task.frequency}
            </strong>
          </span>
        )}


        <span>
          Duration:
          {" "}
          <strong>
            {
              task.durationMinutes
              === null
                ? "Unknown"
                : formatDuration(
                    task.durationMinutes,
                  )
            }
          </strong>
        </span>
      </div>


      {task
        .alternativeWindows
        .length > 0 && (
        <div
          className="availability-task__alternatives"
        >
          <h4>
            Alternative windows
          </h4>


          {task
            .alternativeWindows
            .map(
              (
                window,
                index,
              ) => (
                <div
                  key={
                    `${window.start}-${index}`
                  }
                  className="availability-task__alternative"
                >
                  <Clock3
                    size={14}
                    strokeWidth={1.8}
                  />


                  <div>
                    <strong>
                      {formatRecommendedWindow(
                        window,
                      )}
                    </strong>


                    <span>
                      {formatDuration(
                        window
                          .durationMinutes,
                      )}

                      {" · Score "}

                      {window.score}
                    </span>
                  </div>
                </div>
              ),
            )}
        </div>
      )}
    </article>
  );
}


interface TaskModalProps {
  device:
    DeviceAvailability;

  recommendations:
    DeviceRecommendations
    | undefined;

  onClose:
    () => void;
}


function TaskModal({
  device,
  recommendations,
  onClose,
}: TaskModalProps) {
  const tasks =
    recommendations
      ?.tasks
      ?? [];


  useEffect(
    () => {
      function handleKeyDown(
        event: KeyboardEvent,
      ) {
        if (
          event.key === "Escape"
        ) {
          onClose();
        }
      }


      const previousOverflow =
        document.body.style.overflow;


      document.body.style.overflow =
        "hidden";


      window.addEventListener(
        "keydown",
        handleKeyDown,
      );


      return () => {
        document.body.style.overflow =
          previousOverflow;

        window.removeEventListener(
          "keydown",
          handleKeyDown,
        );
      };
    },
    [onClose],
  );


  return createPortal(
    <div
      className="availability-modal-overlay"
      onMouseDown={
        onClose
      }
    >
      <section
        className="availability-modal"
        onMouseDown={(
          event,
        ) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-label={
          `Recommended maintenance for ${device.deviceName}`
        }
      >
        <header
          className="availability-modal__header"
        >
          <div>
            <span
              className="availability-modal__eyebrow"
            >
              Recommended maintenance
            </span>


            <h2>
              {getDisplayDeviceName(
                device.deviceName,
              )}
            </h2>


            <p>
              {tasks.length}
              {" "}
              {
                tasks.length === 1
                  ? "recommended task"
                  : "recommended tasks"
              }
            </p>
          </div>


          <button
            type="button"
            className="availability-modal__close"
            onClick={
              onClose
            }
            aria-label="Close"
          >
            <X
              size={20}
              strokeWidth={1.8}
            />
          </button>
        </header>


        <div
          className="availability-modal__body"
        >
          {tasks.length === 0 ? (
            <div
              className="availability-modal__empty"
            >
              No maintenance
              recommendations for this
              period.
            </div>
          ) : (
            tasks.map(
              (task) => (
                <RecommendationTask
                  key={
                    task
                      .scheduledTaskId
                  }
                  task={task}
                />
              ),
            )
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}


interface AvailabilityCardProps {
  device:
    DeviceAvailability;

  recommendations:
    DeviceRecommendations
    | undefined;

  onOpenTasks:
    () => void;
}


function AvailabilityCard({
  device,
  recommendations,
  onOpenTasks,
}: AvailabilityCardProps) {
  const groupedAvailable =
    groupIntervalsByDay(
      device.available,
    );


  const deviceImage =
    FFS_DEVICE_IMAGES[
      device.deviceName
    ];


  const taskCount =
    recommendations
      ?.tasks
      .length
      ?? 0;


  const cardStyle:
    CSSProperties | undefined =
    deviceImage
      ? ({
          "--device-image":
            `url(${deviceImage})`,
        } as CSSProperties)
      : undefined;


  return (
    <article
      className={
        deviceImage
          ? (
            "availability-card " +
            "availability-card--with-image"
          )
          : "availability-card"
      }
      style={cardStyle}
    >
      <div
        className="availability-card__header"
      >
        <div>
          <h2>
            {getDisplayDeviceName(
              device.deviceName,
            )}
          </h2>
        </div>


        <CalendarClock
          size={22}
          strokeWidth={1.8}
        />
      </div>


      <div
        className="availability-card__tasks-row"
      >
        <button
          type="button"
          className="availability-card__tasks-button"
          onClick={
            onOpenTasks
          }
        >
          <span>
            Tasks
          </span>
        </button>
      </div>


      <div
        className="availability-card__summary"
      >
        <div
          className="
            availability-card__summary-item
            availability-card__summary-item--available
          "
        >
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


        <div
          className="availability-card__summary-item"
        >
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


      <div
        className="availability-card__windows"
      >
        <h3>
          Free windows
        </h3>


        {device.available.length ===
        0 ? (
          <div
            className="availability-card__no-slots"
          >
            No availability
          </div>
        ) : (
          groupedAvailable.map(
            ([
              day,
              intervals,
            ]) => (
              <div
                key={day}
                className="availability-day"
              >
                <div
                  className="availability-day__title"
                >
                  {formatDay(
                    intervals[0]
                      .start,
                  )}
                </div>


                {intervals.map(
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
                        strokeWidth={
                          1.8
                        }
                      />


                      <div>
                        <strong>
                          {formatTime(
                            interval.start,
                          )}

                          {" - "}

                          {formatTime(
                            interval.end,
                          )}
                        </strong>


                        <span>
                          {formatDuration(
                            interval
                              .durationMinutes,
                          )}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ),
          )
        )}
      </div>
    </article>
  );
}


export function Availability() {
  const today = useMemo(
    () => new Date(),
    [],
  );


  const tomorrow = useMemo(
    () => {
      const value =
        new Date(today);

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
    formatDateInput(
      today,
    ),
  );


  const [
    toDate,
    setToDate,
  ] = useState(
    formatDateInput(
      tomorrow,
    ),
  );


  const [
    devices,
    setDevices,
  ] = useState<
    DeviceAvailability[]
  >([]);


  const [
    recommendations,
    setRecommendations,
  ] = useState<
    DeviceRecommendations[]
  >([]);


  const [
    selectedDevice,
    setSelectedDevice,
  ] = useState<
    DeviceAvailability
    | null
  >(null);


  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );


  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [cacheMetadata, setCacheMetadata] =
    useState<AvailabilityCacheMetadata | null>(null);

  const [refreshNonce, setRefreshNonce] =
    useState(0);

  const forceRefreshRef = useRef(false);


  useEffect(() => {
    let cancelled = false;


    async function load() {
      const forceRefresh = forceRefreshRef.current;
      forceRefreshRef.current = false;

      try {
        setLoading(
          true,
        );

        setError(
          null,
        );


        const [
          availabilityData,
          recommendationData,
        ] = await Promise.all([
          getAvailability(
            fromDate,
            toDate,
            forceRefresh,
          ),

          getRecommendations(
            fromDate,
            toDate,
            5,
          ),
        ]);


        if (!cancelled) {
          setDevices(
            availabilityData.data,
          );

          setCacheMetadata(
            availabilityData.cache,
          );

          setRecommendations(
            recommendationData
              .devices,
          );
        }
      } catch (err) {
        console.error(
          "Error loading availability:",
          err,
        );


        if (!cancelled) {
          setError(
            "Unable to load availability.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false,
          );
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
    refreshNonce,
  ]);


  const recommendationsByDevice =
    useMemo(
      () => {
        const map =
          new Map<
            number,
            DeviceRecommendations
          >();


        for (
          const recommendation
          of recommendations
        ) {
          map.set(
            recommendation.deviceId,
            recommendation,
          );
        }


        return map;
      },
      [recommendations],
    );


  const ffsDevices =
    useMemo(
      () =>
        devices
          .filter(
            (device) =>
              isFfsDevice(
                device.deviceName,
              ),
          )
          .sort(
            (a, b) =>
              getFfsOrder(
                a.deviceName,
              ) -
              getFfsOrder(
                b.deviceName,
              ),
          ),
      [devices],
    );


  const otherDevices =
    useMemo(
      () =>
        devices
          .filter(
            (device) =>
              !isFfsDevice(
                device.deviceName,
              ),
          )
          .sort(
            (a, b) =>
              a.deviceName.localeCompare(
                b.deviceName,
              ),
          ),
      [devices],
    );


  return (
    <main
      className="availability-page"
    >
      <header
        className="availability-page__header"
      >
        <div>
          <h1
            className="availability-page__title"
          >
            Availability
          </h1>

          {cacheMetadata && (
            <div className="availability-page__cache-info">
              <span className={`availability-page__cache-badge availability-page__cache-badge--${cacheMetadata.status.toLowerCase()}`}>
                {cacheMetadata.status}
              </span>
              <span>
                Source: {cacheMetadata.source === "mysim" ? "mySIM" : "PostgreSQL"}
              </span>
              <span>
                Last checked: {new Date(cacheMetadata.checkedAt).toLocaleTimeString("es-ES")}
              </span>
            </div>
          )}
        </div>


        <div
          className="availability-page__filters"
        >
          <label>
            <span>
              From
            </span>


            <input
              type="date"
              value={fromDate}
              onChange={(
                event,
              ) =>
                setFromDate(
                  event
                    .target
                    .value,
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
              onChange={(
                event,
              ) =>
                setToDate(
                  event
                    .target
                    .value,
                )
              }
            />
          </label>

          <button
            type="button"
            className="availability-page__refresh"
            disabled={loading}
            onClick={() => {
              forceRefreshRef.current = true;
              setRefreshNonce((value) => value + 1);
            }}
          >
            <RefreshCw
              size={16}
              className={loading ? "availability-page__refresh-icon--loading" : undefined}
            />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {cacheMetadata?.stale && (
        <div className="availability-page__stale-warning" role="status">
          mySIM is unavailable. Showing the latest cached availability data.
        </div>
      )}


      {loading && (
        <div
          className="availability-page__state"
        >
          Loading availability...
        </div>
      )}


      {!loading &&
        error && (
          <div
            className="
              availability-page__state
              availability-page__state--error
            "
          >
            {error}
          </div>
        )}


      {!loading &&
        !error &&
        devices.length === 0 && (
          <div
            className="availability-page__state"
          >
            No devices found.
          </div>
        )}


      {!loading &&
        !error &&
        devices.length > 0 && (
          <div
            className="availability-page__content"
          >
            <section
              className="availability-device-section"
            >
              <div
                className="availability-device-section__header"
              >
                <h2>
                  FFS
                </h2>


                <span>
                  Full Flight Simulators
                </span>
              </div>


              <div
                className="
                  availability-grid
                  availability-grid--ffs
                "
              >
                {ffsDevices.map(
                  (device) => (
                    <AvailabilityCard
                      key={
                        device.deviceId
                      }
                      device={
                        device
                      }
                      recommendations={
                        recommendationsByDevice
                          .get(
                            device.deviceId,
                          )
                      }
                      onOpenTasks={
                        () =>
                          setSelectedDevice(
                            device,
                          )
                      }
                    />
                  ),
                )}
              </div>
            </section>


            {otherDevices.length >
              0 && (
              <section
                className="availability-device-section"
              >
                <div
                  className="availability-device-section__header"
                >
                  <h2>
                    Others
                  </h2>


                  <span>
                    Other training devices
                  </span>
                </div>


                <div
                  className="availability-grid"
                >
                  {otherDevices.map(
                    (
                      device,
                    ) => (
                      <AvailabilityCard
                        key={
                          device.deviceId
                        }
                        device={
                          device
                        }
                        recommendations={
                          recommendationsByDevice
                            .get(
                              device.deviceId,
                            )
                        }
                        onOpenTasks={
                          () =>
                            setSelectedDevice(
                              device,
                            )
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            )}
          </div>
        )}


      {selectedDevice && (
        <TaskModal
          device={
            selectedDevice
          }
          recommendations={
            recommendationsByDevice.get(
              selectedDevice
                .deviceId,
            )
          }
          onClose={
            () =>
              setSelectedDevice(
                null,
              )
          }
        />
      )}
    </main>
  );
}