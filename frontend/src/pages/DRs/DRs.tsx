import {
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  getOpenDrs,
} from "../../api/drs"

import type {
  Dr,
} from "../../types/dr"

import {
  DeviceDrCard,
} from "../../components/DeviceDrCard"

import {
  DrDeviceModal,
} from "../../components/DrDeviceModal"

import "./DRs.css"


interface DeviceGroup {
  key: string
  deviceName: string
  deviceId: number | null
  drs: Dr[]
  image?: string
}


const FFS_ORDER = [
  "A400M",
  "MRTT",
  "C295 TS03",
  "C295",
  "CN235",
]


const DEVICE_IMAGES: Record<string, string> = {
  A400M: new URL(
    "../../assets/devices/a400m.png",
    import.meta.url
  ).href,

  MRTT: new URL(
    "../../assets/devices/mrtt.png",
    import.meta.url
  ).href,

  "C295 TS03": new URL(
    "../../assets/devices/c295-ts03.png",
    import.meta.url
  ).href,

  C295: new URL(
    "../../assets/devices/c295.png",
    import.meta.url
  ).href,

  CN235: new URL(
    "../../assets/devices/cn235.png",
    import.meta.url
  ).href,
}


function normalizeDeviceName(
  value: string | null
): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
}


function getFfsKey(
  deviceName: string | null
): string | null {
  const name =
    normalizeDeviceName(
      deviceName
    )

  /*
   * TS03 debe comprobarse antes
   * que C295.
   */
  if (
    name.includes("C295") &&
    name.includes("TS03")
  ) {
    return "C295 TS03"
  }

  if (
    name.includes("A400M")
  ) {
    return "A400M"
  }

  if (
    name.includes("MRTT")
  ) {
    return "MRTT"
  }

  if (
    name.includes("C295")
  ) {
    return "C295"
  }

  if (
    name.includes("CN235")
  ) {
    return "CN235"
  }

  return null
}


function buildDeviceGroups(
  drs: Dr[]
): DeviceGroup[] {
  const map =
    new Map<
      string,
      DeviceGroup
    >()

  for (const dr of drs) {
    const deviceName =
      dr.device_name?.trim() ||
      "Unknown device"

    const key =
      dr.device_id !== null
        ? `id-${dr.device_id}`
        : `name-${deviceName}`

    const existing =
      map.get(key)

    if (existing) {
      existing.drs.push(dr)
      continue
    }

    map.set(
      key,
      {
        key,
        deviceName,
        deviceId:
          dr.device_id,
        drs: [dr],
      }
    )
  }

  return Array.from(
    map.values()
  )
}


export function DRs() {
  const [
    drs,
    setDrs,
  ] = useState<Dr[]>([])

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
  ] =
    useState<DeviceGroup | null>(
      null
    )


  useEffect(() => {
    let cancelled = false

    async function loadDrs() {
      try {
        setLoading(true)
        setError(null)

        const data =
          await getOpenDrs()

        if (!cancelled) {
          setDrs(data)
        }
      } catch (err) {
        console.error(
          "Error loading DRs:",
          err
        )

        if (!cancelled) {
          setError(
            "Unable to load open DRs."
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDrs()

    return () => {
      cancelled = true
    }
  }, [])


  const {
    ffsGroups,
    otherGroups,
  } = useMemo(() => {
    const allGroups =
      buildDeviceGroups(drs)

    const ffsMap =
      new Map<
        string,
        DeviceGroup
      >()

    const others:
      DeviceGroup[] = []


    for (
      const group
      of allGroups
    ) {
      const ffsKey =
        getFfsKey(
          group.deviceName
        )

      if (!ffsKey) {
        others.push(group)
        continue
      }

      const existing =
        ffsMap.get(ffsKey)

      if (existing) {
        existing.drs.push(
          ...group.drs
        )

        if (
          existing.deviceId ===
            null &&
          group.deviceId !== null
        ) {
          existing.deviceId =
            group.deviceId
        }

        continue
      }

      ffsMap.set(
        ffsKey,
        {
          ...group,
          key: `ffs-${ffsKey}`,
          deviceName:
            ffsKey,
          image:
            DEVICE_IMAGES[
              ffsKey
            ],
        }
      )
    }


    const sortedFfs =
      FFS_ORDER
        .map(
          (deviceName) =>
            ffsMap.get(
              deviceName
            )
        )
        .filter(
          (
            group
          ): group is DeviceGroup =>
            Boolean(group)
        )


    const sortedOthers =
      [...others].sort(
        (a, b) => {
          const countDifference =
            b.drs.length -
            a.drs.length

          if (
            countDifference !== 0
          ) {
            return countDifference
          }

          return (
            a.deviceName.localeCompare(
              b.deviceName
            )
          )
        }
      )


    return {
      ffsGroups:
        sortedFfs,

      otherGroups:
        sortedOthers,
    }
  }, [drs])


  return (
    <div className="drs-page">
      {/* =========================
          PAGE HEADER
          ========================= */}
      <header className="drs-page__header">
        <h1 className="drs-page__title">
          DRs
        </h1>

        <div className="drs-page__total">
          <span className="drs-page__total-value">
            {drs.length}
          </span>

          <span className="drs-page__total-label">
            open drs
          </span>
        </div>
      </header>


      {/* =========================
          STATES
          ========================= */}
      {loading && (
        <div className="drs-page__state">
          Loading open DRs...
        </div>
      )}


      {!loading &&
        error && (
          <div
            className="
              drs-page__state
              drs-page__state--error
            "
          >
            {error}
          </div>
        )}


      {!loading &&
        !error &&
        drs.length === 0 && (
          <div className="drs-page__state">
            No open DRs found.
          </div>
        )}


      {/* =========================
          CONTENT
          ========================= */}
      {!loading &&
        !error &&
        drs.length > 0 && (
          <div className="drs-page__content">

            {/* =====================
                FFS
                ===================== */}
            <section className="drs-section">
              <div className="drs-section__heading">
                <h2 className="drs-section__title">
                  FFS
                </h2>

                <span className="drs-section__subtitle">
                  Full Flight Simulators
                </span>
              </div>

              <div className="drs-section__separator" />


              <div className="drs-page__ffs-grid">
                {ffsGroups.map(
                  (group) => (
                    <DeviceDrCard
                      key={
                        group.key
                      }
                      deviceName={
                        group.deviceName
                      }
                      drs={
                        group.drs
                      }
                      image={
                        group.image
                      }
                      variant="ffs"
                      onClick={() =>
                        setSelectedDevice(
                          group
                        )
                      }
                    />
                  )
                )}
              </div>
            </section>


            {/* =====================
                OTHERS
                ===================== */}
            <section className="drs-section">
              <div className="drs-section__heading">
                <h2 className="drs-section__title">
                  Others
                </h2>

                <span className="drs-section__subtitle">
                  Other training devices
                </span>
              </div>

              <div className="drs-section__separator" />


              <div className="drs-page__others-grid">
                {otherGroups.map(
                  (group) => (
                    <DeviceDrCard
                      key={
                        group.key
                      }
                      deviceName={
                        group.deviceName
                      }
                      drs={
                        group.drs
                      }
                      variant="other"
                      onClick={() =>
                        setSelectedDevice(
                          group
                        )
                      }
                    />
                  )
                )}
              </div>
            </section>
          </div>
        )}


      {/* =========================
          MODAL
          ========================= */}
      {selectedDevice && (
        <DrDeviceModal
          deviceName={
            selectedDevice.deviceName
          }
          drs={
            selectedDevice.drs
          }
          onClose={() =>
            setSelectedDevice(
              null
            )
          }
        />
      )}
    </div>
  )
}