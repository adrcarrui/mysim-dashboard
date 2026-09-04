import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getOpenActions,
} from "../../api/actions"

import type {
  Action,
} from "../../types/action"

import {
  DeviceActionCard,
} from "../../components/DeviceActionCard"

import {
  ActionDeviceModal,
} from "../../components/ActionDeviceModal"

import "./Actions.css"


const FFS_DEVICE_LIST = [
  "FFS A400M",
  "FFS A330 MRTT",
  "FFS C295 TS03",
  "FFS C295 EA03",
  "FFS CN235",
]


const FFS_DEVICES = new Set(
  FFS_DEVICE_LIST
)


interface DeviceSummary {
  device: string
  total: number
  open: number
  ongoing: number
  today: number
}


function isToday(
  value: string | null,
): boolean {
  if (!value) {
    return false
  }

  const actionDate =
    new Date(
      value.replace(
        " ",
        "T"
      )
    )

  if (
    Number.isNaN(
      actionDate.getTime()
    )
  ) {
    return false
  }

  const today =
    new Date()

  return (
    actionDate.getFullYear() ===
      today.getFullYear() &&
    actionDate.getMonth() ===
      today.getMonth() &&
    actionDate.getDate() ===
      today.getDate()
  )
}


function buildDeviceSummary(
  device: string,
  actions: Action[],
): DeviceSummary {
  const deviceActions =
    actions.filter(
      (action) =>
        action.device ===
        device
    )

  return {
    device,

    total:
      deviceActions.length,

    open:
      deviceActions.filter(
        (action) =>
          action.status ===
          "Open"
      ).length,

    ongoing:
      deviceActions.filter(
        (action) =>
          action.status ===
          "On going"
      ).length,

    today:
      deviceActions.filter(
        (action) =>
          isToday(
            action.date
          )
      ).length,
  }
}


export function Actions() {
  const [
    actions,
    setActions,
  ] = useState<Action[]>([])

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

    async function loadActions() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await getOpenActions()

        if (!cancelled) {
          setActions(data)
        }
      } catch (err) {
        console.error(
          "Error loading actions:",
          err
        )

        if (!cancelled) {
          setError(
            "Unable to load actions."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadActions()

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
              actions,
            )
        ),
      [actions]
    )


  const otherDevices =
    useMemo(
      () =>
        Array.from(
          new Set(
            actions
              .map(
                (action) =>
                  action.device
              )
              .filter(
                (
                  device
                ): device is string =>
                  Boolean(device) &&
                  !FFS_DEVICES.has(
                    device
                  )
              )
          )
        ),
      [actions]
    )


  const otherSummaries =
    useMemo(
      () =>
        otherDevices
          .map(
            (device) =>
              buildDeviceSummary(
                device,
                actions,
              )
          )
          .sort(
            (a, b) => {
              if (
                b.total !==
                a.total
              ) {
                return (
                  b.total -
                  a.total
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
        actions,
      ]
    )


  const selectedDeviceActions =
    useMemo(() => {
      if (!selectedDevice) {
        return []
      }

      return actions.filter(
        (action) =>
          action.device ===
          selectedDevice
      )
    }, [
      actions,
      selectedDevice,
    ])


  return (
    <main className="actions-page">

      <header className="actions-page__header">

        <div>
          <h1 className="actions-page__title">
            Actions
          </h1>
        </div>


        <div className="actions-page__total">

          <strong>
            {actions.length}
          </strong>

          <span>
            actions
          </span>

        </div>

      </header>


      {loading && (
        <div className="actions-page__state">
          Loading actions...
        </div>
      )}


      {!loading &&
        error && (
          <div
            className="
              actions-page__state
              actions-page__state--error
            "
          >
            {error}
          </div>
        )}


      {!loading &&
        !error &&
        actions.length === 0 && (
          <div className="actions-page__state">
            No actions found.
          </div>
        )}


      {!loading &&
        !error &&
        actions.length > 0 && (
          <div className="actions-page__content">

            <section className="actions-device-section">

              <div className="actions-device-section__header">

                <h2>
                  FFS
                </h2>

                <span>
                  Full Flight Simulators
                </span>

              </div>


              <div className="actions-device-grid actions-device-grid--ffs">

                {ffsSummaries.map(
                  (summary) => (
                    <DeviceActionCard
                      key={
                        summary.device
                      }

                      device={
                        summary.device
                      }

                      total={
                        summary.total
                      }

                      open={
                        summary.open
                      }

                      ongoing={
                        summary.ongoing
                      }

                      today={
                        summary.today
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


            <section className="actions-device-section">

              <div className="actions-device-section__header">

                <h2>
                  Others
                </h2>

                <span>
                  Other training devices
                </span>

              </div>


              <div className="actions-device-grid">

                {otherSummaries.map(
                  (summary) => (
                    <DeviceActionCard
                      key={
                        summary.device
                      }

                      device={
                        summary.device
                      }

                      total={
                        summary.total
                      }

                      open={
                        summary.open
                      }

                      ongoing={
                        summary.ongoing
                      }

                      today={
                        summary.today
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


      <ActionDeviceModal
        device={
          selectedDevice
        }

        actions={
          selectedDeviceActions
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