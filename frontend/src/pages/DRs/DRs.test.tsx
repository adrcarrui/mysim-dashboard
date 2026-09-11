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

import { getOpenDrs } from "../../api/drs"
import type { Dr } from "../../types/dr"
import { DRs } from "./DRs"

vi.mock("../../api/drs", () => ({
  getOpenDrs: vi.fn(),
}))

interface DeviceDrCardMockProps {
  deviceName: string
  drs: Dr[]
  variant?: "ffs" | "other"
  onClick: () => void
}

vi.mock("../../components/DeviceDrCard", () => ({
  DeviceDrCard: ({
    deviceName,
    drs,
    variant,
    onClick,
  }: DeviceDrCardMockProps) => (
    <button type="button" onClick={onClick}>
      {deviceName}: {drs.length} DRs ({variant})
    </button>
  ),
}))

interface DrDeviceModalMockProps {
  deviceName: string
  drs: Dr[]
  onClose: () => void
}

vi.mock("../../components/DrDeviceModal", () => ({
  DrDeviceModal: ({
    deviceName,
    drs,
    onClose,
  }: DrDeviceModalMockProps) => (
    <div role="dialog" aria-label={`DRs for ${deviceName}`}>
      <span>{drs.length} DRs in modal</span>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}))

const mockedGetOpenDrs = vi.mocked(getOpenDrs)

function createDr(
  id: number,
  deviceId: number | null,
  deviceName: string | null,
): Dr {
  return {
    id,
    device_id: deviceId,
    device_name: deviceName,
  } as Dr
}

describe("DRs page", () => {
  beforeEach(() => {
    mockedGetOpenDrs.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the loading state while DRs are requested", async () => {
    mockedGetOpenDrs.mockReturnValue(
      new Promise<Dr[]>(() => undefined),
    )

    render(<DRs />)

    expect(screen.getByText("Loading open DRs...")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedGetOpenDrs).toHaveBeenCalledOnce()
    })
  })

  it("groups and normalizes DRs by device", async () => {
    mockedGetOpenDrs.mockResolvedValue([
      createDr(1, 10, "FFS A400M"),
      createDr(2, 11, "A400M simulator"),
      createDr(3, 20, "ARMS"),
    ])

    render(<DRs />)

    expect(
      await screen.findByRole("button", {
        name: "A400M: 2 DRs (ffs)",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "ARMS: 1 DRs (other)",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("opens the modal with the selected device DRs", async () => {
    const user = userEvent.setup()

    mockedGetOpenDrs.mockResolvedValue([
      createDr(1, 10, "FFS A400M"),
      createDr(2, 10, "FFS A400M"),
      createDr(3, 20, "ARMS"),
    ])

    render(<DRs />)

    await user.click(
      await screen.findByRole("button", {
        name: "A400M: 2 DRs (ffs)",
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "DRs for A400M" }),
    ).toBeInTheDocument()
    expect(screen.getByText("2 DRs in modal")).toBeInTheDocument()
  })

  it("shows an error when the API request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockedGetOpenDrs.mockRejectedValue(new Error("Backend unavailable"))

    render(<DRs />)

    expect(
      await screen.findByText("Unable to load open DRs."),
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no DRs", async () => {
    mockedGetOpenDrs.mockResolvedValue([])

    render(<DRs />)

    expect(
      await screen.findByText("No open DRs found."),
    ).toBeInTheDocument()
  })
})
