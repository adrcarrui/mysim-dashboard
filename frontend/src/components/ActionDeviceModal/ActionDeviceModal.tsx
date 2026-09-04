import {
  useMemo,
  useState,
} from "react"

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


type ActionFilter =
  | "all"
  | "open"
  | "ongoing"


function matchesFilter(
  action: Action,
  filter: ActionFilter,
): boolean {
  if (
    filter === "all"
  ) {
    return true
  }

  if (
    filter === "open"
  ) {
    return (
      action.status_id === 19
    )
  }

  return (
    action.status_id === 20
  )
}


export function ActionDeviceModal({
  device,
  actions,
  onClose,
}: ActionDeviceModalProps) {

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<ActionFilter>(
    "all"
  )


  const counts =
    useMemo(
      () => ({
        all:
          actions.length,

        open:
          actions.filter(
            (action) =>
              action.status_id === 19
          ).length,

        ongoing:
          actions.filter(
            (action) =>
              action.status_id === 20
          ).length,
      }),
      [actions]
    )


  const filteredActions =
    useMemo(
      () =>
        actions.filter(
          (action) =>
            matchesFilter(
              action,
              activeFilter
            )
        ),
      [
        actions,
        activeFilter,
      ]
    )


  if (!device) {
    return null
  }


  return (
    <div
      className="action-device-modal__overlay"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Actions for ${device}`}
    >

      <div
        className="action-device-modal"
        onMouseDown={
          (event) =>
            event.stopPropagation()
        }
      >

        <header className="action-device-modal__header">

          <div className="action-device-modal__header-top">

            <div className="action-device-modal__title-row">

              <h2>
                {device}
              </h2>

              <span className="action-device-modal__action-count">
                {actions.length} actions
              </span>

            </div>


            <button
              type="button"
              className="action-device-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>

          </div>


          <div className="action-device-modal__filters">

            <button
              type="button"
              className={`
                action-device-modal__filter
                action-device-modal__filter--all
                ${
                  activeFilter === "all"
                    ? "action-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "all"
                )
              }
            >
              <span>
                All
              </span>

              <strong>
                {counts.all}
              </strong>
            </button>


            <button
              type="button"
              className={`
                action-device-modal__filter
                action-device-modal__filter--open
                ${
                  activeFilter === "open"
                    ? "action-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "open"
                )
              }
            >
              <span>
                Open
              </span>

              <strong>
                {counts.open}
              </strong>
            </button>


            <button
              type="button"
              className={`
                action-device-modal__filter
                action-device-modal__filter--ongoing
                ${
                  activeFilter === "ongoing"
                    ? "action-device-modal__filter--active"
                    : ""
                }
              `}
              onClick={() =>
                setActiveFilter(
                  "ongoing"
                )
              }
            >
              <span>
                On going
              </span>

              <strong>
                {counts.ongoing}
              </strong>
            </button>

          </div>

        </header>


        <div className="action-device-modal__content">

          <ActionsList
            actions={
              filteredActions
            }
          />

        </div>

      </div>

    </div>
  )
}