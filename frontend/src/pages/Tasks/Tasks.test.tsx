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
  onClick: () => void
}


vi.mock(
  "../../components/DeviceTaskCard",
  () => ({
    DeviceTaskCard: ({
      device,
      total,
      onClick,
    }: DeviceTaskCardMockProps) => (
      <button
        type="button"
        data-testid="device-card"
        onClick={onClick}
      >
        {device} ({total})
      </button>
    ),
  })
)


interface TaskDeviceModalMockProps {
  device: string | null
  tasks: Task[]
  onClose: () => void
}


vi.mock(
  "../../components/TaskDeviceModal",
  () => ({
    TaskDeviceModal: ({
      device,
      tasks,
      onClose,
    }: TaskDeviceModalMockProps) => {
      if (!device) {
        return null
      }

      return (
        <div
          role="dialog"
          aria-label={`${device} tasks`}
        >
          <span>
            {tasks.length} tasks in modal
          </span>

          <button
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      )
    },
  })
)


const mockedGetUpcomingTasks =
  vi.mocked(
    getUpcomingTasks
  )


function createTask(
  device: string,
  toleranceStatus:
    Task["tolerance_status"],
): Task {
  return {
    device,
    tolerance_status:
      toleranceStatus,
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
              "in_tolerance",
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
        ).toBeInTheDocument()

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
            ),

            createTask(
              "A400M",
              "upcoming",
            ),

            createTask(
              "ARMS",
              "in_tolerance",
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
                "A400M tasks",
            }
          )
        ).toBeInTheDocument()

        expect(
          screen.getByText(
            "2 tasks in modal"
          )
        ).toBeInTheDocument()
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