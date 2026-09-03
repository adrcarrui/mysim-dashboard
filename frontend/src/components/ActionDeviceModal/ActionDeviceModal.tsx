import type {
  Action,
} from "../../types/action"

import {
  ActionsList,
} from "../ActionsList"

import "./ActionDeviceModal.css"


interface ActionDeviceModalProps {
  device: string | null

  actions: Action[]

  onClose: () => void
}


export function ActionDeviceModal({
  device,
  actions,
  onClose,
}: ActionDeviceModalProps) {
  if (!device) {
    return null
  }

  return (
    <div
      className="action-device-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Actions for ${device}`}
    >
      <div
        className="action-device-modal__backdrop"
        onClick={onClose}
      />

      <div className="action-device-modal__panel">

        <header className="action-device-modal__header">

          <div className="action-device-modal__heading">

            <h2>
              {device}
            </h2>

            <div className="action-device-modal__count">

              <strong>
                {actions.length}
              </strong>

              <span>
                active actions
              </span>

            </div>

          </div>


          <button
            type="button"
            className="action-device-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>

        </header>


        <div className="action-device-modal__content">

          <ActionsList
            actions={actions}
            groupByDevice={false}
          />

        </div>

      </div>
    </div>
  )
}