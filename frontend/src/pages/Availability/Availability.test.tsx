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

import { getAvailability } from "../../api/availability"
import { getRecommendations } from "../../api/recommendations"
import type { DeviceAvailability } from "../../types/availability"
import type {
  DeviceRecommendations,
  RecommendationsResponse,
  TaskRecommendation,
} from "../../types/recommendation"
import { Availability } from "./Availability"

vi.mock("../../api/availability", () => ({
  getAvailability: vi.fn(),
}))

vi.mock("../../api/recommendations", () => ({
  getRecommendations: vi.fn(),
}))

const mockedGetAvailability = vi.mocked(getAvailability)
const mockedGetRecommendations = vi.mocked(getRecommendations)

const cacheMetadata = {
  status: "MISS" as const,
  source: "mysim" as const,
  stale: false,
  checkedAt: "2026-09-11T12:00:00Z",
}

function createDevice(
  deviceId: number,
  deviceName: string,
): DeviceAvailability {
  return {
    deviceId,
    deviceName,
    totalOccupiedMinutes: 120,
    totalAvailableMinutes: 1320,
    occupied: [],
    available: [
      {
        start: "2026-09-11T08:00:00Z",
        end: "2026-09-11T10:00:00Z",
        durationMinutes: 120,
      },
    ],
  }
}

function createTask(): TaskRecommendation {
  return {
    scheduledTaskId: 187733,
    maintenanceTaskId: 816,
    scheduleCode: "187733-2026-A400M-000816",
    taskCode: "A400M-000816",
    device: "FFS A400M",
    description: "Weekly maintenance task",
    plannedDate: "2026-09-11T12:00:00Z",
    toleranceStart: "2026-09-10T00:00:00Z",
    toleranceEnd: "2026-09-12T23:59:59Z",
    currentToleranceStatus: "within_tolerance",
    frequency: "Weekly",
    status: "Pending",
    durationMinutes: 60,
    durationSource: "estimated",
    bestWindow: {
      start: "2026-09-11T14:00:00Z",
      end: "2026-09-11T15:00:00Z",
      durationMinutes: 60,
      score: 100,
      fitsWindow: true,
      windowToleranceStatus: "within_tolerance",
      reasons: [],
    },
    alternativeWindows: [],
  }
}

function createRecommendations(
  devices: DeviceRecommendations[] = [],
): RecommendationsResponse {
  return {
    fromDate: "2026-09-11",
    toDate: "2026-09-12",
    devices,
  }
}

describe("Availability page", () => {
  beforeEach(() => {
    mockedGetAvailability.mockReset()
    mockedGetRecommendations.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the loading state while availability is requested", async () => {
    mockedGetAvailability.mockReturnValue(
      new Promise(() => undefined),
    )
    mockedGetRecommendations.mockReturnValue(
      new Promise(() => undefined),
    )

    render(<Availability />)

    expect(screen.getByText("Loading availability...")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedGetAvailability).toHaveBeenCalledOnce()
      expect(mockedGetRecommendations).toHaveBeenCalledOnce()
    })
  })

  it("shows FFS and other devices with cache information", async () => {
    mockedGetAvailability.mockResolvedValue({
      data: [
        createDevice(1, "FFS A400M"),
        createDevice(2, "ARMS"),
      ],
      cache: cacheMetadata,
    })
    mockedGetRecommendations.mockResolvedValue(createRecommendations())

    render(<Availability />)

    expect(
      await screen.findByRole("heading", { name: "A400M" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "ARMS" }),
    ).toBeInTheDocument()
    expect(screen.getByText("MISS")).toBeInTheDocument()
    expect(screen.getByText("Source: mySIM")).toBeInTheDocument()
  })

  it("opens the maintenance recommendations modal", async () => {
    const user = userEvent.setup()
    const device = createDevice(1, "FFS A400M")

    mockedGetAvailability.mockResolvedValue({
      data: [device],
      cache: cacheMetadata,
    })
    mockedGetRecommendations.mockResolvedValue(
      createRecommendations([
        {
          deviceId: 1,
          deviceName: "FFS A400M",
          taskDeviceName: "A400M",
          tasks: [createTask()],
        },
      ]),
    )

    render(<Availability />)

    await user.click(
      await screen.findByRole("button", { name: "Tasks (1)" }),
    )

    expect(
      screen.getByRole("dialog", {
        name: "Recommended maintenance for FFS A400M",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("1 recommended task")).toBeInTheDocument()
    expect(screen.getByText("Weekly maintenance task")).toBeInTheDocument()
  })

  it("shows an error when availability cannot be loaded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockedGetAvailability.mockRejectedValue(new Error("Backend unavailable"))
    mockedGetRecommendations.mockResolvedValue(createRecommendations())

    render(<Availability />)

    expect(
      await screen.findByText("Unable to load availability."),
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no devices", async () => {
    mockedGetAvailability.mockResolvedValue({
      data: [],
      cache: cacheMetadata,
    })
    mockedGetRecommendations.mockResolvedValue(createRecommendations())

    render(<Availability />)

    expect(
      await screen.findByText("No devices found."),
    ).toBeInTheDocument()
  })
})
