import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getOpenJobs,
} from "../../api/jobs"

import type {
  Job,
} from "../../types/job"

import {
  DeviceJobCard,
} from "../../components/DeviceJobCard"

import {
  JobDeviceModal,
} from "../../components/JobDeviceModal"

import a400mImage
  from "../../assets/devices/a400m.png"

import mrttImage
  from "../../assets/devices/mrtt.png"

import c295Ts03Image
  from "../../assets/devices/c295-ts03.png"

import c295Image
  from "../../assets/devices/c295.png"

import cn235Image
  from "../../assets/devices/cn235.png"

import "./Jobs.css"


const FFS_DEVICES = [
  {
    rawName: "FFS A400M",
    label: "A400M",
    image: a400mImage,
  },
  {
    rawName: "FFS A330 MRTT",
    label: "MRTT",
    image: mrttImage,
  },
  {
    rawName: "FFS C295 TS03",
    label: "C295 TS03",
    image: c295Ts03Image,
  },
  {
    rawName: "FFS C295 EA03",
    label: "C295",
    image: c295Image,
  },
  {
    rawName: "FFS CN235",
    label: "CN235",
    image: cn235Image,
  },
] as const


const FFS_DEVICE_SET = new Set(
  FFS_DEVICES.map(
    (device) =>
      device.rawName
  )
)


interface DeviceSummary {
  device: string
  total: number
  overdue: number
  today: number
  upcoming: number
}


function buildDeviceSummary(
  device: string,
  jobs: Job[],
): DeviceSummary {
  const deviceJobs =
    jobs.filter(
      (job) =>
        job.device_name ===
        device
    )

  return {
    device,

    total:
      deviceJobs.length,

    overdue:
      deviceJobs.filter(
        (job) =>
          job.days_remaining !== null &&
          job.days_remaining < 0
      ).length,

    today:
      deviceJobs.filter(
        (job) =>
          job.days_remaining === 0
      ).length,

    upcoming:
      deviceJobs.filter(
        (job) =>
          job.days_remaining !== null &&
          job.days_remaining > 0
      ).length,
  }
}


export function Jobs() {
  const [
    jobs,
    setJobs,
  ] = useState<Job[]>([])

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

    async function loadJobs() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await getOpenJobs()

        if (!cancelled) {
          setJobs(data)
        }
      } catch (err) {
        console.error(
          "Error loading jobs:",
          err
        )

        if (!cancelled) {
          setError(
            "Unable to load open jobs."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadJobs()

    return () => {
      cancelled = true
    }
  }, [])


  const ffsSummaries =
    useMemo(
      () =>
        FFS_DEVICES.map(
          (device) => ({
            ...device,

            summary:
              buildDeviceSummary(
                device.rawName,
                jobs,
              ),
          })
        ),
      [jobs]
    )


  const otherDevices =
    useMemo(
      () =>
        Array.from(
          new Set(
            jobs
              .map(
                (job) =>
                  job.device_name
              )
              .filter(
                (
                  device
                ): device is string =>
                  Boolean(device) &&
                  !FFS_DEVICE_SET.has(
                    device
                  )
              )
          )
        ),
      [jobs]
    )


  const otherSummaries =
    useMemo(
      () =>
        otherDevices
          .map(
            (device) =>
              buildDeviceSummary(
                device,
                jobs,
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
        jobs,
      ]
    )


  const selectedDeviceJobs =
    useMemo(
      () => {
        if (!selectedDevice) {
          return []
        }

        return jobs.filter(
          (job) =>
            job.device_name ===
            selectedDevice
        )
      },
      [
        jobs,
        selectedDevice,
      ]
    )


  const selectedDeviceLabel =
    useMemo(
      () => {
        if (!selectedDevice) {
          return null
        }

        const ffsDevice =
          FFS_DEVICES.find(
            (device) =>
              device.rawName ===
              selectedDevice
          )

        return (
          ffsDevice?.label ??
          selectedDevice
        )
      },
      [
        selectedDevice,
      ]
    )


  return (
    <main className="jobs-page">

      <header className="jobs-page__header">

        <div>
          <h1 className="jobs-page__title">
            Jobs
          </h1>
        </div>


        <div className="jobs-page__total">

          <strong>
            {jobs.length}
          </strong>

          <span>
            jobs
          </span>

        </div>

      </header>


      {loading && (
        <div className="jobs-page__state">
          Loading open jobs...
        </div>
      )}


      {!loading &&
        error && (
          <div
            className="
              jobs-page__state
              jobs-page__state--error
            "
          >
            {error}
          </div>
        )}


      {!loading &&
        !error &&
        jobs.length === 0 && (
          <div className="jobs-page__state">
            No open jobs found.
          </div>
        )}


      {!loading &&
        !error &&
        jobs.length > 0 && (
          <div className="jobs-page__content">

            <section className="jobs-device-section">

              <div className="jobs-device-section__header">

                <h2>
                  FFS
                </h2>

                <span>
                  Full Flight Simulators
                </span>

              </div>


              <div
                className="
                  jobs-device-grid
                  jobs-device-grid--ffs
                "
              >

                {ffsSummaries.map(
                  ({
                    rawName,
                    label,
                    image,
                  }) => {

                    const deviceJobs =
                      jobs.filter(
                        (job) =>
                          job.device_name ===
                          rawName
                      )

                    return (
                      <DeviceJobCard
                        key={rawName}

                        deviceName={
                          label
                        }

                        jobs={
                          deviceJobs
                        }

                        image={
                          image
                        }

                        onClick={() =>
                          setSelectedDevice(
                            rawName
                          )
                        }
                      />
                    )
                  }
                )}

              </div>

            </section>


            <section className="jobs-device-section">

              <div className="jobs-device-section__header">

                <h2>
                  Others
                </h2>

                <span>
                  Other training devices
                </span>

              </div>


              <div className="jobs-device-grid">

                {otherSummaries.map(
                  (summary) => {

                    const deviceJobs =
                      jobs.filter(
                        (job) =>
                          job.device_name ===
                          summary.device
                      )

                    return (
                      <DeviceJobCard
                        key={
                          summary.device
                        }

                        deviceName={
                          summary.device
                        }

                        jobs={
                          deviceJobs
                        }

                        onClick={() =>
                          setSelectedDevice(
                            summary.device
                          )
                        }
                      />
                    )
                  }
                )}

              </div>

            </section>

          </div>
        )}


      <JobDeviceModal
        device={
          selectedDeviceLabel
        }

        jobs={
          selectedDeviceJobs
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