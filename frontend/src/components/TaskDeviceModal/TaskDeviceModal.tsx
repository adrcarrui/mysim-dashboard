import type {
  Task,
} from "../../types/task";

import {
  TasksList,
} from "../TasksList";

import "./TaskDeviceModal.css";


interface TaskDeviceModalProps {
  device: string | null;

  tasks: Task[];

  onClose: () => void;
}


export function TaskDeviceModal({
  device,
  tasks,
  onClose,
}: TaskDeviceModalProps) {
  if (!device) {
    return null;
  }

  return (
    <div
      className="task-device-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Tasks for ${device}`}
    >
      <div
        className="task-device-modal__backdrop"
        onClick={onClose}
      />

      <div className="task-device-modal__panel">
        <header className="task-device-modal__header">
          <div className="task-device-modal__heading">
            <h2>
              {device}
            </h2>

            <div className="task-device-modal__count">
              <strong>
                {tasks.length}
              </strong>

              <span>
                active tasks
              </span>
            </div>
          </div>

          <button
            type="button"
            className="task-device-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="task-device-modal__content">
          <TasksList
            tasks={tasks}
            groupByDevice={false}
          />
        </div>
      </div>
    </div>
  );
}