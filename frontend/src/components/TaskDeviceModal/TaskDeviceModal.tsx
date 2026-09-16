import {
  useMemo,
  useState,
} from "react"

import type {
  Task,
} from "../../types/task"

import {
  TasksList,
} from "../TasksList"

import "./TaskDeviceModal.css"


interface TaskDeviceModalProps {
  device: string | null
  tasks: Task[]
  onClose: () => void
}


type TaskFilter =
  | "all"
  | "out_of_tolerance"
  | "backlog"
  | "today"
  | "upcoming"
  | "unknown_tolerance"


function matchesFilter(
  task: Task,
  filter: TaskFilter,
): boolean {
  if (
    filter === "all"
  ) {
    return true
  }

  return (
    task.planning_category === filter
  )
}


const FILTERS: Array<{
  value: TaskFilter
  label: string
}> = [
  { value: "all", label: "All" },
  {
    value: "out_of_tolerance",
    label: "Out of tolerance",
  },
  { value: "backlog", label: "Backlog" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  {
    value: "unknown_tolerance",
    label: "Unknown tolerance",
  },
]


export function TaskDeviceModal({
  device,
  tasks,
  onClose,
}: TaskDeviceModalProps) {

  const [
    activeFilter,
    setActiveFilter,
  ] = useState<TaskFilter>(
    "all"
  )


  const counts =
    useMemo(
      () => ({
        all:
          tasks.length,

        out_of_tolerance:
          tasks.filter(
            (task) =>
              task.planning_category ===
              "out_of_tolerance"
          ).length,

        backlog:
          tasks.filter(
            (task) =>
              task.planning_category ===
              "backlog"
          ).length,

        today:
          tasks.filter(
            (task) =>
              task.planning_category ===
              "today"
          ).length,

        upcoming:
          tasks.filter(
            (task) =>
              task.planning_category ===
              "upcoming"
          ).length,

        unknown_tolerance:
          tasks.filter(
            (task) =>
              task.planning_category ===
              "unknown_tolerance"
          ).length,
      }),
      [tasks]
    )


  const filteredTasks =
    useMemo(
      () =>
        tasks.filter(
          (task) =>
            matchesFilter(
              task,
              activeFilter
            )
        ),
      [
        tasks,
        activeFilter,
      ]
    )


  if (!device) {
    return null
  }


  return (
    <div
      className="task-device-modal__overlay"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Tasks for ${device}`}
    >

      <div
        className="task-device-modal"
        onMouseDown={
          (event) =>
            event.stopPropagation()
        }
      >

        <header className="task-device-modal__header">

          <div className="task-device-modal__header-top">

            <div className="task-device-modal__title-row">

              <h2>
                {device}
              </h2>

              <span className="task-device-modal__task-count">
                {tasks.length} tasks
              </span>

            </div>


            <button
              type="button"
              className="task-device-modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>

          </div>


          <div className="task-device-modal__filters">

            {FILTERS.map(
              (filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`
                    task-device-modal__filter
                    task-device-modal__filter--${filter.value.replaceAll(
                      "_",
                      "-"
                    )}
                    ${
                      activeFilter === filter.value
                        ? "task-device-modal__filter--active"
                        : ""
                    }
                  `}
                  onClick={() =>
                    setActiveFilter(
                      filter.value
                    )
                  }
                  aria-pressed={
                    activeFilter === filter.value
                  }
                >
                  <span>{filter.label}</span>
                  <strong>
                    {counts[filter.value]}
                  </strong>
                </button>
              )
            )}

          </div>

        </header>


        <div className="task-device-modal__content">

          <TasksList
            tasks={
              filteredTasks
            }
          />

        </div>

      </div>

    </div>
  )
}
