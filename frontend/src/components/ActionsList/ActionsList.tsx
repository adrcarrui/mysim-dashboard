import type {
  Action,
} from "../../types/action"

import "./ActionsList.css"


interface ActionsListProps {
  actions: Action[]
  groupByDevice?: boolean
}


interface DeviceGroup {
  device: string
  actions: Action[]
}


interface DateGroup {
  date: string
  devices: DeviceGroup[]
}


function groupActions(
  actions: Action[],
): DateGroup[] {
  const dateMap =
    new Map<
      string,
      Map<string, Action[]>
    >()

  for (const action of actions) {
    if (!action.date) {
      continue
    }

    const date =
      action.date.slice(
        0,
        10
      )

    const device =
      action.device ??
      "No device"

    if (!dateMap.has(date)) {
      dateMap.set(
        date,
        new Map()
      )
    }

    const deviceMap =
      dateMap.get(date)!

    if (!deviceMap.has(device)) {
      deviceMap.set(
        device,
        []
      )
    }

    deviceMap
      .get(device)!
      .push(action)
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
            ([device, deviceActions]) => ({
              device,

              actions:
                deviceActions.sort(
                  (a, b) =>
                    (
                      a.date ?? ""
                    ).localeCompare(
                      b.date ?? ""
                    )
                ),
            })
          ),
      })
    )
}


function getStatusClass(
  statusId: number | null,
): string {
  switch (statusId) {
    case 19:
      return "action-status--open"

    case 20:
      return "action-status--ongoing"

    default:
      return ""
  }
}


function getShortDescription(
  description: string | null,
): string {
  if (!description) {
    return "No description available"
  }

  const maxLength = 220

  if (
    description.length <=
    maxLength
  ) {
    return description
  }

  return (
    description
      .slice(
        0,
        maxLength
      )
      .trim() + "..."
  )
}


function formatTime(
  value: string | null,
): string {
  if (!value) {
    return "-"
  }

  const date = new Date(
    value.replace(" ", "T")
  )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-"
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  )
}


function formatDate(
  dateString: string,
): string {
  const date = new Date(
    `${dateString}T00:00:00`
  )

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  )
}


export function ActionsList({
  actions,
  groupByDevice = true,
}: ActionsListProps) {
  const groups =
    groupActions(actions)

  if (
    groups.length === 0
  ) {
    return (
      <div className="actions-empty">
        No actions found.
      </div>
    )
  }

  return (
    <div className="actions-list">
      {groups.map(
        (group) => (
          <section
            key={group.date}
            className="actions-date-group"
          >
            <div className="actions-date-header">
              <span className="actions-date-value">
                {formatDate(
                  group.date
                )}
              </span>

              <span className="actions-date-count">
                {
                  group.devices.reduce(
                    (
                      total,
                      device
                    ) =>
                      total +
                      device.actions.length,
                    0
                  )
                }{" "}
                actions
              </span>
            </div>

            {group.devices.map(
              (deviceGroup) => (
                <div
                  key={
                    deviceGroup.device
                  }
                  className="actions-device-group"
                >
                  {groupByDevice && (
                    <div className="actions-device-header">
                      <span className="actions-device-name">
                        {
                          deviceGroup.device
                        }
                      </span>

                      <span className="actions-device-count">
                        {
                          deviceGroup.actions
                            .length
                        }{" "}
                        actions
                      </span>
                    </div>
                  )}

                  <div className="actions-device-items">
                    {deviceGroup.actions.map(
                      (action) => (
                        <article
                          key={
                            action.id ??
                            action.action_id ??
                            ""
                          }
                          className="action-row"
                        >
                          <div className="action-row__main">
                            <div className="action-row__title">
                              {getShortDescription(
                                action.description
                              )}
                            </div>

                            <div className="action-row__meta">
                              <span>
                                {
                                  action.action_id ??
                                  "Action"
                                }
                              </span>

                              <span>
                                {
                                  formatTime(
                                    action.date
                                  )
                                }
                              </span>

                              <span>
                                Assigned:{" "}
                                {
                                  action.assigned_to ??
                                  "-"
                                }
                              </span>

                              <span>
                                Shift:{" "}
                                {
                                  action.shift_to_be_done ??
                                  "-"
                                }
                              </span>
                            </div>

                            <div className="action-row__secondary">
                              <span>
                                Open by:{" "}
                                {
                                  action.performed_by ??
                                  "-"
                                }
                              </span>
                            </div>
                          </div>

                          <div className="action-row__status">
                            <span
                              className={`action-status ${getStatusClass(
                                action.status_id
                              )}`}
                            >
                              {
                                action.status ??
                                "-"
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
  )
}