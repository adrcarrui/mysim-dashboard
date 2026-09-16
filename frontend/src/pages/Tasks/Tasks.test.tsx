import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  render,
  screen,
  waitFor,
} from "@testing-library/react"

import userEvent from
  "@testing-library/user-event"

import {
  getUpcomingTasks,
} from "../../api/tasks"

import type {
  Task,
} from "../../types/task"

import {
  Tasks,
} from "./Tasks"


vi.mock(
  "../../api/tasks",
  () => ({
    getUpcomingTasks:
      vi.fn(),
  })
)


interface DeviceTaskCardMockProps {
  device: string
  total: number
  outOfTolerance: number
  backlog: number
  today: number
  upcoming: number
  unknownTolerance: number
  onClick: () => void
}


vi.mock(
  "../../components/DeviceTaskCard",
  () => ({
    DeviceTaskCard: ({
      device,
      total,
      outOfTolerance,
      backlog,
      today,
      upcoming,
      unknownTolerance,
      onClick,
    }: DeviceTaskCardMockProps) => (
      <button
        type="button"
        data-testid="device-card"
        data-out-of-tolerance={outOfTolerance}
        data-backlog={backlog}
        data-today={today}
        data-upcoming={upcoming}
        data-unknown-tolerance={unknownTolerance}
        onClick={onClick}
      >
        {device} ({total})
      </button>
    ),
  })
)


const mockedGetUpcomingTasks =
  vi.mocked(
    getUpcomingTasks
  )


function createTask(
  device: string,
  planningCategory:
    Task["planning_category"],
  scheduledTaskId = 1,
  plannedDate = "2026-09-15T10:00:00",
): Task {
  return {
    scheduled_task_id:
      scheduledTaskId,

    device,

    task_code:
      String(scheduledTaskId)
        .padStart(6, "0"),

    description:
      `${planningCategory ?? "unknown"} task`,

    planned_date:
      plannedDate,

    planning_category:
      planningCategory,

    status:
      "Pending",

    status_id:
      199,

    frequency:
      "Weekly",

    remarks:
      null,
  } as Task
}


describe(
  "Tasks page",
  () => {
    beforeEach(() => {
      mockedGetUpcomingTasks
        .mockReset()
    })


    afterEach(() => {
      vi.restoreAllMocks()
    })


    it(
      "shows the loading state while tasks are requested",
      async () => {
        mockedGetUpcomingTasks
          .mockReturnValue(
            new Promise<Task[]>(
              () => undefined
            )
          )

        render(
          <Tasks />
        )

        expect(
          screen.getByText(
            "Loading scheduled tasks..."
          )
        ).toBeInTheDocument()

        await waitFor(() => {
          expect(
            mockedGetUpcomingTasks
          ).toHaveBeenCalledWith(7)
        })
      }
    )


    it(
      "groups the tasks by device",
      async () => {
        mockedGetUpcomingTasks
          .mockResolvedValue([
            createTask(
              "A400M",
              "out_of_tolerance",
            ),

            createTask(
              "A400M",
              "backlog",
            ),

            createTask(
              "ARMS",
              "upcoming",
            ),
          ])

        render(
          <Tasks />
        )

        expect(
          await screen.findByRole(
            "button",
            {
              name:
                "A400M (2)",
            }
          )
        ).toHaveAttribute(
          "data-out-of-tolerance",
          "1"
        )

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "A400M (2)",
            }
          )
        ).toHaveAttribute(
          "data-backlog",
          "1"
        )

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "ARMS (1)",
            }
          )
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            "3"
          )
        ).toBeInTheDocument()
      }
    )


    it(
      "opens the modal for the selected device",
      async () => {
        const user =
          userEvent.setup()

        mockedGetUpcomingTasks
          .mockResolvedValue([
            createTask(
              "A400M",
              "out_of_tolerance",
              11,
              "2026-09-14T10:00:00",
            ),

            createTask(
              "A400M",
              "backlog",
              12,
              "2026-09-15T10:00:00",
            ),

            createTask(
              "ARMS",
              "unknown_tolerance",
              13,
            ),
          ])

        render(
          <Tasks />
        )

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "A400M (2)",
            }
          )
        )

        expect(
          screen.getByRole(
            "dialog",
            {
              name:
                "Tasks for A400M",
            }
          )
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            "2 tasks"
          )
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Out of tolerance/i,
            }
          )
        ).toBeInTheDocument()

        expect(
          screen.getByRole(
            "button",
            {
              name:
                /Backlog/i,
            }
          )
        ).toBeInTheDocument()

        await user.click(
          screen.getByRole(
            "button",
            {
              name:
                /Backlog/i,
            }
          )
        )

        expect(
          screen.getByText(
            "backlog task"
          )
        ).toBeInTheDocument()

        expect(
          screen.queryByText(
            "out_of_tolerance task"
          )
        ).not.toBeInTheDocument()
      }
    )


    it(
      "orders modal tasks by planned date",
      async () => {
        const user =
          userEvent.setup()

        mockedGetUpcomingTasks
          .mockResolvedValue([
            createTask(
              "A400M",
              "upcoming",
              22,
              "2026-09-17T10:00:00",
            ),

            createTask(
              "A400M",
              "today",
              21,
              "2026-09-15T10:00:00",
            ),
          ])

        render(
          <Tasks />
        )

        await user.click(
          await screen.findByRole(
            "button",
            {
              name:
                "A400M (2)",
            }
          )
        )

        expect(
          screen.getAllByText(
            /^Task #/
          ).map(
            (element) =>
              element.textContent
          )
        ).toEqual([
          "Task #21",
          "Task #22",
        ])
      }
    )


    it(
      "shows an error when the API request fails",
      async () => {
        vi.spyOn(
          console,
          "error"
        ).mockImplementation(
          () => undefined
        )

        mockedGetUpcomingTasks
          .mockRejectedValue(
            new Error(
              "Backend unavailable"
            )
          )

        render(
          <Tasks />
        )

        expect(
          await screen.findByText(
            "Unable to load scheduled tasks."
          )
        ).toBeInTheDocument()
      }
    )


    it(
      "shows the empty state when there are no tasks",
      async () => {
        mockedGetUpcomingTasks
          .mockResolvedValue([])

        render(
          <Tasks />
        )

        expect(
          await screen.findByText(
            "No scheduled tasks found."
          )
        ).toBeInTheDocument()
      }
    )
  }
)