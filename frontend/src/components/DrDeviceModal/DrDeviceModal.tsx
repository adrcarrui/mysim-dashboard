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
      document.body.style.overflow

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
      className="dr-device-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dr-device-modal-title"
      onMouseDown={onClose}
    >

      <div
        className="dr-device-modal"
        onMouseDown={
          (event) =>
            event.stopPropagation()
        }
      >

        <header className="dr-device-modal__header">

          <div className="dr-device-modal__header-top">

            <div className="dr-device-modal__title-row">

              <h2
                id="dr-device-modal-title"
              >
                {deviceName}
              </h2>


              <span className="dr-device-modal__dr-count">
                {drs.length} DRs
              </span>

            </div>


            <button
              type="button"
              className="dr-device-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>

          </div>

        </header>


        <div className="dr-device-modal__content">

          <DrsList
            drs={drs}
          />

        </div>

      </div>

    </div>
  )
}