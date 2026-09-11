import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { getOpenActions } from "../../api/actions"
import type { Action } from "../../types/action"
import { Actions } from "./Actions"

vi.mock("../../api/actions", () => ({
  getOpenActions: vi.fn(),
}))

interface DeviceActionCardMockProps {
  device: string
  total: number
  open: number
  ongoing: number
  today: number
  onClick: () => void
}

vi.mock("../../components/DeviceActionCard", () => ({
  DeviceActionCard: ({
    device,
    total,
    open,
    ongoing,
    today,
    onClick,
  }: DeviceActionCardMockProps) => (
    <button type="button" onClick={onClick}>
      {device}: {total} total, {open} open, {ongoing} ongoing, {today} today
    </button>
  ),
}))

interface ActionDeviceModalMockProps {
  device: string | null
  actions: Action[]
  onClose: () => void
}

vi.mock("../../components/ActionDeviceModal", () => ({
  ActionDeviceModal: ({
    device,
    actions,
    onClose,
  }: ActionDeviceModalMockProps) => {
    if (!device) {
      return null
    }

    return (
      <div role="dialog" aria-label={`Actions for ${device}`}>
        <span>{actions.length} actions in modal</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    )
  },
}))

const mockedGetOpenActions = vi.mocked(getOpenActions)

function createAction(
  device: string,
  statusId: number,
  status: string,
  date: string | null = null,
): Action {
  return {
    device,
    status_id: statusId,
    status,
    date,
  } as Action
}

function getTodayAtNoon(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day} 12:00:00`
}

describe("Actions page", () => {
  beforeEach(() => {
    mockedGetOpenActions.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the loading state while actions are requested", async () => {
    mockedGetOpenActions.mockReturnValue(
      new Promise<Action[]>(() => undefined),
    )

    render(<Actions />)

    expect(screen.getByText("Loading actions...")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedGetOpenActions).toHaveBeenCalledOnce()
    })
  })

  it("groups actions and calculates their status totals", async () => {
    mockedGetOpenActions.mockResolvedValue([
      createAction("FFS A400M", 19, "Open", getTodayAtNoon()),
      createAction("FFS A400M", 20, "On going"),
      createAction("ARMS", 19, "Open"),
    ])

    render(<Actions />)

    expect(
      await screen.findByRole("button", {
        name: "FFS A400M: 2 total, 1 open, 1 ongoing, 1 today",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "ARMS: 1 total, 1 open, 0 ongoing, 0 today",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("opens the modal with the selected device actions", async () => {
    const user = userEvent.setup()

    mockedGetOpenActions.mockResolvedValue([
      createAction("FFS A400M", 19, "Open"),
      createAction("FFS A400M", 20, "On going"),
      createAction("ARMS", 19, "Open"),
    ])

    render(<Actions />)

    await user.click(
      await screen.findByRole("button", {
        name: "FFS A400M: 2 total, 1 open, 1 ongoing, 0 today",
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Actions for FFS A400M" }),
    ).toBeInTheDocument()
    expect(screen.getByText("2 actions in modal")).toBeInTheDocument()
  })

  it("shows an error when the API request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockedGetOpenActions.mockRejectedValue(new Error("Backend unavailable"))

    render(<Actions />)

    expect(
      await screen.findByText("Unable to load actions."),
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no actions", async () => {
    mockedGetOpenActions.mockResolvedValue([])

    render(<Actions />)

    expect(
      await screen.findByText("No actions found."),
    ).toBeInTheDocument()
  })
})
