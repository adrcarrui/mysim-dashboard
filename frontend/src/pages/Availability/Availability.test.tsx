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
import { getAvailability } from "../../api/availability"
import { getOpenDrs } from "../../api/drs"
import { getOpenJobs } from "../../api/jobs"
import { getRecommendations } from "../../api/recommendations"
import { getUpcomingTasks } from "../../api/tasks"
import type { Action } from "../../types/action"
import type { DeviceAvailability } from "../../types/availability"
import type {
  DeviceRecommendations,
  RecommendationsResponse,
  TaskRecommendation,
} from "../../types/recommendation"
import type { Dr } from "../../types/dr"
import type { Job } from "../../types/job"
import type { Task } from "../../types/task"
import { Availability } from "./Availability"

vi.mock("../../api/availability", () => ({
  getAvailability: vi.fn(),
}))

vi.mock("../../api/recommendations", () => ({
  getRecommendations: vi.fn(),
}))

vi.mock("../../api/jobs", () => ({ getOpenJobs: vi.fn() }))
vi.mock("../../api/drs", () => ({ getOpenDrs: vi.fn() }))

vi.mock("../../api/actions", () => ({ getOpenActions: vi.fn() }))
vi.mock("../../api/tasks", () => ({ getUpcomingTasks: vi.fn() }))

const mockedGetOpenActions = vi.mocked(getOpenActions)
const mockedGetUpcomingTasks = vi.mocked(getUpcomingTasks)
const mockedGetOpenJobs = vi.mocked(getOpenJobs)
const mockedGetOpenDrs = vi.mocked(getOpenDrs)

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
    mockedGetOpenActions.mockReset()
    mockedGetUpcomingTasks.mockReset()
    mockedGetOpenJobs.mockReset()
    mockedGetOpenDrs.mockReset()
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
      await screen.findByRole("button", { name: "Maintenance for A400M (1 recommended task)" }),
    )

    expect(
      screen.getByRole("dialog", {
        name: "Maintenance for FFS A400M",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("1 recommended task")).toBeInTheDocument()
    expect(screen.getByText("Weekly maintenance task")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "With suggested window 1" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Without suggested window 0" }))
    expect(screen.getByRole("status")).toHaveTextContent("No records match this filter.")
    expect(screen.queryByText("Weekly maintenance task")).not.toBeInTheDocument()
  })

  it("loads only the selected section and shows records for the selected device", async () => {
    const user = userEvent.setup()
    mockedGetAvailability.mockResolvedValue({
      data: [createDevice(1, "FFS A400M"), createDevice(2, "ARMS")],
      cache: cacheMetadata,
    })
    mockedGetRecommendations.mockResolvedValue(createRecommendations())
    const job: Job = {
      id: 12, job_number: "J-A400M", target_date: null, description: "Device job",
      alias: null, device_id: 1, device_name: "FFS A400M", priority_id: null,
      priority: null, status_id: null, assigned_to_id: null, related_maintenance_task_id: null,
      days_remaining: null, urgency: null,
    }
    mockedGetOpenJobs.mockResolvedValue([
      job,
      { ...job, id: 13, job_number: "J-ARMS", device_id: 2, days_remaining: -1 },
      { ...job, id: 14, job_number: "J-A400M-OVERDUE", days_remaining: -1 },
      { ...job, id: 15, job_number: "J-A400M-TODAY", days_remaining: 0 },
      { ...job, id: 16, job_number: "J-A400M-UPCOMING", days_remaining: 1 },
    ])
    const dr: Dr = {
      id: 21, dr_id: "DR-A400M", reported_date: null, closing_date: null,
      customer_description: "Device discrepancy", fault_description: null, detected_by_id: null,
      repetitions: null, manufacturer_id_number: null, ata: null, close_remarks: null,
      root_cause_analysis: null, not_our: null, priority_id: null, status_id: null,
      severity_id: null, affected_system_id: null, device_id: 1, device_name: "FFS A400M", last_updated: null,
    }
    mockedGetOpenDrs.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce([
      dr,
      { ...dr, id: 22, dr_id: "DR-ARMS", device_id: 2, device_name: "ARMS" },
      { ...dr, id: 23, dr_id: "DR-A400M-ALIAS", device_id: 300, device_name: "A400M", repetitions: 2 },
    ])
    const task: Task = {
      scheduled_task_id: 52, maintenance_task_id: 8, schedule_code: "52-2026-A400M-000008",
      device: "A400M", device_id: null, task_code: "A400M-000008", preventive_manual_version: null,
      description: "Scheduled A400M check", frequency_id: null, frequency: null, frequency_num_of_days: null,
      planned_date: "2026-11-24", tolerance_start: null, tolerance_end: null, tolerance_status: null,
      planning_category: "upcoming", status: "Pending", status_id: 199, remarks: null, done_at: null,
      performed_by: null, performance_remarks: null,
    }
    mockedGetUpcomingTasks.mockResolvedValue([
      task, { ...task, scheduled_task_id: 53, device: "ARMS", device_id: 2 },
    ])
    const action: Action = {
      id: "41", action_id: "ACTION-A400M", device_id: 1, device: "FFS A400M",
      status_id: 19, status: "Open", performed_by_id: null, performed_by: null,
      assigned_to_id: null, assigned_to: null, shift_to_be_done_id: null, shift_to_be_done: null,
      date: null, description: "Open A400M action", last_updated: null,
    }
    mockedGetOpenActions.mockResolvedValue([
      action, { ...action, id: "42", action_id: "ACTION-ARMS", device_id: 2, device: "ARMS" },
    ])

    render(<Availability />)
    await user.click(await screen.findByRole("button", { name: "Maintenance for A400M (0 recommended tasks)" }))
    expect(mockedGetOpenJobs).not.toHaveBeenCalled()
    expect(mockedGetOpenDrs).not.toHaveBeenCalled()
    expect(mockedGetUpcomingTasks).not.toHaveBeenCalled()
    expect(mockedGetOpenActions).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Maintenance history" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Open jobs" }))
    expect(await screen.findByText("J-A400M")).toBeInTheDocument()
    expect(screen.queryByText("J-ARMS")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "All 4", pressed: true })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Today 1" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upcoming 1" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Overdue 1" }))
    expect(screen.getByRole("button", { name: "Overdue 1", pressed: true })).toBeInTheDocument()
    expect(screen.getByText("J-A400M-OVERDUE")).toBeInTheDocument()
    expect(screen.queryByText("J-A400M-TODAY")).not.toBeInTheDocument()
    expect(screen.queryByText("J-A400M")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "All 4" }))
    expect(screen.getByText("J-A400M")).toBeInTheDocument()
    expect(mockedGetOpenJobs).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Open DRs" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load records for this device.")
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("DR-A400M")).toBeInTheDocument()
    expect(screen.queryByText("DR-ARMS")).not.toBeInTheDocument()
    expect(screen.getByText("DR-A400M-ALIAS")).toBeInTheDocument()
    expect(mockedGetOpenDrs).toHaveBeenLastCalledWith()
    await user.click(screen.getByRole("button", { name: "Repeated 1" }))
    expect(screen.getByText("DR-A400M-ALIAS")).toBeInTheDocument()
    expect(screen.queryByText("DR-A400M")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tasks" }))
    expect(await screen.findByText("Task #52")).toBeInTheDocument()
    expect(screen.queryByText("Task #53")).not.toBeInTheDocument()
    expect(mockedGetUpcomingTasks).toHaveBeenCalledWith(7)
    await user.click(screen.getByRole("button", { name: "Backlog 0" }))
    expect(screen.queryByText("Task #52")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Upcoming 1" }))
    expect(screen.getByText("Task #52")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Actions" }))
    expect(await screen.findByText("ACTION-A400M")).toBeInTheDocument()
    expect(screen.queryByText("ACTION-ARMS")).not.toBeInTheDocument()
    expect(mockedGetOpenActions).toHaveBeenCalledWith()
    await user.click(screen.getByRole("button", { name: "On going 0" }))
    expect(screen.queryByText("ACTION-A400M")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open 1" }))
    expect(screen.getByText("ACTION-A400M")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Maintenance for ARMS (0 recommended tasks)" }))
    expect(screen.getByRole("button", { name: "Recommended tasks", pressed: true })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Open jobs" }))
    expect(await screen.findByText("J-ARMS")).toBeInTheDocument()
    expect(screen.queryByText("J-A400M")).not.toBeInTheDocument()
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
