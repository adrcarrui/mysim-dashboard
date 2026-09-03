import {
  useEffect,
} from "react"

import type {
  Dr,
} from "../../types/dr"

import {
  DrsList,
} from "../DrsList"

import "./DrDeviceModal.css"


interface DrDeviceModalProps {
  deviceName: string
  drs: Dr[]
  onClose: () => void
}


export function DrDeviceModal({
  deviceName,
  drs,
  onClose,
}: DrDeviceModalProps) {
  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Escape"
      ) {
        onClose()
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    const previousOverflow =
      document.body.style
        .overflow

    document.body.style.overflow =
      "hidden"

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )

      document.body.style.overflow =
        previousOverflow
    }
  }, [onClose])


  return (
    <div
      className="dr-device-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dr-device-modal-title"
    >
      <button
        type="button"
        className="dr-device-modal__backdrop"
        aria-label="Close DR details"
        onClick={onClose}
      />


      <div className="dr-device-modal__panel">
        <header className="dr-device-modal__header">
          <div className="dr-device-modal__heading">
            <span className="dr-device-modal__eyebrow">
              Open DRs
            </span>

            <div className="dr-device-modal__title-row">
              <h2
                id="dr-device-modal-title"
                className="dr-device-modal__title"
              >
                {deviceName}
              </h2>

              <span className="dr-device-modal__count">
                {drs.length}
              </span>
            </div>
          </div>


          <button
            type="button"
            className="dr-device-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="
                  M6 6
                  L18 18
                  M18 6
                  L6 18
                "
              />
            </svg>
          </button>
        </header>


        <div className="dr-device-modal__body">
          <DrsList
            drs={drs}
          />
        </div>
      </div>
    </div>
  )
}