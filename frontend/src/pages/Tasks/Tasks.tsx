import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getUpcomingTasks,
} from "../../api/tasks"

import type {
  Task,
} from "../../types/task"

import {
  DeviceTaskCard,
} from "../../components/DeviceTaskCard"

import {
  TaskDeviceModal,
} from "../../components/TaskDeviceModal"

import "./Tasks.css"


const FFS_DEVICE_LIST = [
  "A400M",
  "MRTT",
  "C295 TS03",
  "C295",
  "CN235",
]


const FFS_DEVICES = new Set(
  FFS_DEVICE_LIST
)


interface DeviceSummary {
  device: string
  total: number
  outOfTolerance: number
  inTolerance: number
  upcoming: number
}


function buildDeviceSummary(
  device: string,
  tasks: Task[],
): DeviceSummary {
  const deviceTasks =
    tasks.filter(
      (task) =>
        task.device === device
    )

  return {
    device,

    total:
      deviceTasks.length,

    outOfTolerance:
      deviceTasks.filter(
        (task) =>
          task.tolerance_status ===
          "out_of_tolerance"
      ).length,

    inTolerance:
      deviceTasks.filter(
        (task) =>
          task.tolerance_status ===
          "in_tolerance"
      ).length,

    upcoming:
      deviceTasks.filter(
        (task) =>
          task.tolerance_status ===
          "upcoming"
      ).length,
  }
}


export function Tasks() {
  const [
    tasks,
    setTasks,
  ] = useState<Task[]>([])

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  )

  const [
    selectedDevice,
    setSelectedDevice,
  ] = useState<string | null>(
    null
  )


  useEffect(() => {
    let cancelled = false

    async function loadTasks() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await getUpcomingTasks(7)

        if (!cancelled) {
          setTasks(data)
        }
      } catch (err) {
        console.error(
          "Error loading tasks:",
          err
        )

        if (!cancelled) {
          setError(
            "Unable to load scheduled tasks."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTasks()

    return () => {
      cancelled = true
    }
  }, [])


  const ffsSummaries =
    useMemo(
      () =>
        FFS_DEVICE_LIST.map(
          (device) =>
            buildDeviceSummary(
              device,
              tasks,
            )
        ),
      [tasks]
    )


  const otherDevices =
    useMemo(
      () =>
        Array.from(
          new Set(
            tasks
              .map(
                (task) =>
                  task.device
              )
              .filter(
                (device) =>
                  !FFS_DEVICES.has(
                    device
                  )
              )
          )
        ),
      [tasks]
    )


  const otherSummaries =
    useMemo(
      () =>
        otherDevices
          .map(
            (device) =>
              buildDeviceSummary(
                device,
                tasks,
              )
          )
          .sort(
            (a, b) => {
              if (
                b.outOfTolerance !==
                a.outOfTolerance
              ) {
                return (
                  b.outOfTolerance -
                  a.outOfTolerance
                )
              }

              return (
                a.device.localeCompare(
                  b.device
                )
              )
            }
          ),
      [
        otherDevices,
        tasks,
      ]
    )


  const selectedDeviceTasks =
    useMemo(() => {
      if (!selectedDevice) {
        return []
      }

      return tasks.filter(
        (task) =>
          task.device ===
          selectedDevice
      )
    }, [
      tasks,
      selectedDevice,
    ])


  return (
    <main className="tasks-page">

      <header className="tasks-page__header">

        <div>
          <h1 className="tasks-page__title">
            Scheduled Tasks
          </h1>
        </div>


        <div className="tasks-page__total">

          <strong>
            {tasks.length}
          </strong>

          <span>
            tasks
          </span>

        </div>

      </header>


      {loading && (
        <div className="tasks-page__state">
          Loading scheduled tasks...
        </div>
      )}


      {!loading &&
        error && (
          <div
            className="
              tasks-page__state
              tasks-page__state--error
            "
          >
            {error}
          </div>
        )}


      {!loading &&
        !error &&
        tasks.length === 0 && (
          <div className="tasks-page__state">
            No scheduled tasks found.
          </div>
        )}


      {!loading &&
        !error &&
        tasks.length > 0 && (
          <div className="tasks-page__content">

            <section className="tasks-device-section">

              <div className="tasks-device-section__header">

                <h2>
                  FFS
                </h2>

                <span>
                  Full Flight Simulators
                </span>

              </div>


              <div className="tasks-device-grid tasks-device-grid--ffs">

                {ffsSummaries.map(
                  (summary) => (
                    <DeviceTaskCard
                      key={
                        summary.device
                      }

                      device={
                        summary.device
                      }

                      total={
                        summary.total
                      }

                      outOfTolerance={
                        summary.outOfTolerance
                      }

                      inTolerance={
                        summary.inTolerance
                      }

                      upcoming={
                        summary.upcoming
                      }

                      onClick={() =>
                        setSelectedDevice(
                          summary.device
                        )
                      }
                    />
                  )
                )}

              </div>

            </section>


            <section className="tasks-device-section">

              <div className="tasks-device-section__header">

                <h2>
                  Others
                </h2>

                <span>
                  Other training devices
                </span>

              </div>


              <div className="tasks-device-grid">

                {otherSummaries.map(
                  (summary) => (
                    <DeviceTaskCard
                      key={
                        summary.device
                      }

                      device={
                        summary.device
                      }

                      total={
                        summary.total
                      }

                      outOfTolerance={
                        summary.outOfTolerance
                      }

                      inTolerance={
                        summary.inTolerance
                      }

                      upcoming={
                        summary.upcoming
                      }

                      onClick={() =>
                        setSelectedDevice(
                          summary.device
                        )
                      }
                    />
                  )
                )}

              </div>

            </section>

          </div>
        )}


      <TaskDeviceModal
        device={
          selectedDevice
        }

        tasks={
          selectedDeviceTasks
        }

        onClose={() =>
          setSelectedDevice(
            null
          )
        }
      />

    </main>
  )
}