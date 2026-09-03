// frontend/src/components/TasksList/TasksList.tsx

import type { Task } from "../../types/task";
import "./TasksList.css";


interface TasksListProps {
  tasks: Task[];
  groupByDevice?: boolean;
}


interface DeviceGroup {
  device: string;
  tasks: Task[];
}


interface DateGroup {
  date: string;
  label: string;
  devices: DeviceGroup[];
}


function formatDateLabel(
  dateString: string
): string {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const tomorrow = new Date(today);

  tomorrow.setDate(
    today.getDate() + 1
  );

  if (
    date.getTime() ===
    today.getTime()
  ) {
    return "Today";
  }

  if (
    date.getTime() ===
    tomorrow.getTime()
  ) {
    return "Tomorrow";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "2-digit",
      month: "short",
    }
  );
}


function groupTasks(
  tasks: Task[]
): DateGroup[] {
  const dateMap =
    new Map<
      string,
      Map<string, Task[]>
    >();

  for (const task of tasks) {
    const date =
      task.planned_date.slice(
        0,
        10
      );

    if (!dateMap.has(date)) {
      dateMap.set(
        date,
        new Map()
      );
    }

    const deviceMap =
      dateMap.get(date)!;

    if (
      !deviceMap.has(
        task.device
      )
    ) {
      deviceMap.set(
        task.device,
        []
      );
    }

    deviceMap
      .get(task.device)!
      .push(task);
  }

  return Array
    .from(
      dateMap.entries()
    )
    .sort(
      ([dateA], [dateB]) =>
        dateA.localeCompare(
          dateB
        )
    )
    .map(
      ([date, deviceMap]) => ({
        date,
        label:
          formatDateLabel(
            date
          ),

        devices: Array
          .from(
            deviceMap.entries()
          )
          .sort(
            ([deviceA], [deviceB]) =>
              deviceA.localeCompare(
                deviceB
              )
          )
          .map(
            ([device, deviceTasks]) => ({
              device,

              tasks: deviceTasks.sort(
                (a, b) =>
                  a.task_code.localeCompare(
                    b.task_code
                  )
              ),
            })
          ),
      })
    );
}


function getStatusClass(
  statusId: number
): string {
  switch (statusId) {
    case 199:
      return "task-status--pending";

    case 200:
      return "task-status--progress";

    case 2542:
      return "task-status--not-done";

    default:
      return "";
  }
}


function getShortDescription(
  description: string | null
): string {
  if (!description) {
    return "No description available";
  }

  const maxLength = 180;

  if (
    description.length <=
    maxLength
  ) {
    return description;
  }

  return (
    description
      .slice(
        0,
        maxLength
      )
      .trim() + "..."
  );
}


function formatTime(
  plannedDate: string
): string {
  const date =
    new Date(plannedDate);

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


export function TasksList({
  tasks,
  groupByDevice = true,
}: TasksListProps) {
  const groups =
    groupTasks(tasks);

  if (
    groups.length === 0
  ) {
    return (
      <div className="tasks-empty">
        No scheduled tasks found.
      </div>
    );
  }

  return (
    <div className="tasks-list">
      {groups.map(
        (group) => (
          <section
            key={group.date}
            className="tasks-date-group"
          >
            <div className="tasks-date-header">
              <div>
                <span className="tasks-date-value">
                  {new Date(
                    `${group.date}T00:00:00`
                  ).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </span>
              </div>

              <span className="tasks-date-count">
                {
                  group.devices.reduce(
                    (
                      total,
                      device
                    ) =>
                      total +
                      device.tasks.length,
                    0
                  )
                }{" "}
                tasks
              </span>
            </div>

            {group.devices.map(
              (deviceGroup) => (
                <div
                  key={
                    deviceGroup.device
                  }
                  className="tasks-device-group"
                >
                  {groupByDevice && (
                    <div className="tasks-device-header">
                      <span className="tasks-device-name">
                        {
                          deviceGroup.device
                        }
                      </span>

                      <span className="tasks-device-count">
                        {
                          deviceGroup.tasks
                            .length
                        }{" "}
                        tasks
                      </span>
                    </div>
                  )}

                  <div className="tasks-device-items">
                    {deviceGroup.tasks.map(
                      (task) => (
                        <article
                          key={
                            task.scheduled_task_id
                          }
                          className="task-row"
                        >
                          <div className="task-row__main">
                            <div className="task-row__title">
                              {getShortDescription(
                                task.description
                              )}
                            </div>

                            <div className="task-row__meta">
                              <span>
                                Task #
                                {
                                  task.scheduled_task_id
                                }
                              </span>

                              <span>
                                {
                                  task.task_code
                                }
                              </span>

                              <span>
                                {
                                  formatTime(
                                    task.planned_date
                                  )
                                }
                              </span>
                            </div>

                            {task.remarks && (
                              <div className="task-row__remarks">
                                {
                                  task.remarks
                                }
                              </div>
                            )}
                          </div>

                          <div className="task-row__status">
                            <span
                              className={`task-status ${getStatusClass(
                                task.status_id
                              )}`}
                            >
                              {
                                task.status
                              }
                            </span>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                </div>
              )
            )}
          </section>
        )
      )}
    </div>
  );
}