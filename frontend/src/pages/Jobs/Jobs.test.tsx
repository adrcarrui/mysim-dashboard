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

import { getOpenJobs } from "../../api/jobs"
import type { Job } from "../../types/job"
import { Jobs } from "./Jobs"

vi.mock("../../api/jobs", () => ({
  getOpenJobs: vi.fn(),
}))

interface DeviceJobCardMockProps {
  deviceName: string
  jobs: Job[]
  onClick?: () => void
}

vi.mock("../../components/DeviceJobCard", () => ({
  DeviceJobCard: ({
    deviceName,
    jobs,
    onClick,
  }: DeviceJobCardMockProps) => {
    const overdue = jobs.filter(
      (job) => job.days_remaining !== null && job.days_remaining < 0,
    ).length
    const today = jobs.filter(
      (job) => job.days_remaining === 0,
    ).length
    const upcoming = jobs.filter(
      (job) => job.days_remaining !== null && job.days_remaining > 0,
    ).length

    return (
      <button type="button" onClick={onClick}>
        {deviceName}: {jobs.length} total, {overdue} overdue, {today} today, {upcoming} upcoming
      </button>
    )
  },
}))

interface JobDeviceModalMockProps {
  device: string | null
  jobs: Job[]
  onClose: () => void
}

vi.mock("../../components/JobDeviceModal", () => ({
  JobDeviceModal: ({
    device,
    jobs,
    onClose,
  }: JobDeviceModalMockProps) => {
    if (!device) {
      return null
    }

    return (
      <div role="dialog" aria-label={`Jobs for ${device}`}>
        <span>{jobs.length} jobs in modal</span>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    )
  },
}))

const mockedGetOpenJobs = vi.mocked(getOpenJobs)

function createJob(
  id: number,
  deviceName: string | null,
  daysRemaining: number | null,
): Job {
  return {
    id,
    device_name: deviceName,
    days_remaining: daysRemaining,
  } as Job
}

describe("Jobs page", () => {
  beforeEach(() => {
    mockedGetOpenJobs.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the loading state while jobs are requested", async () => {
    mockedGetOpenJobs.mockReturnValue(
      new Promise<Job[]>(() => undefined),
    )

    render(<Jobs />)

    expect(screen.getByText("Loading open jobs...")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedGetOpenJobs).toHaveBeenCalledOnce()
    })
  })

  it("groups jobs and calculates their urgency totals", async () => {
    mockedGetOpenJobs.mockResolvedValue([
      createJob(1, "FFS A400M", -2),
      createJob(2, "FFS A400M", 0),
      createJob(3, "ARMS", 4),
    ])

    render(<Jobs />)

    expect(
      await screen.findByRole("button", {
        name: "A400M: 2 total, 1 overdue, 1 today, 0 upcoming",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: "ARMS: 1 total, 0 overdue, 0 today, 1 upcoming",
      }),
    ).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("opens the modal with the selected device jobs", async () => {
    const user = userEvent.setup()

    mockedGetOpenJobs.mockResolvedValue([
      createJob(1, "FFS A400M", -2),
      createJob(2, "FFS A400M", 3),
      createJob(3, "ARMS", 0),
    ])

    render(<Jobs />)

    await user.click(
      await screen.findByRole("button", {
        name: "A400M: 2 total, 1 overdue, 0 today, 1 upcoming",
      }),
    )

    expect(
      screen.getByRole("dialog", { name: "Jobs for A400M" }),
    ).toBeInTheDocument()
    expect(screen.getByText("2 jobs in modal")).toBeInTheDocument()
  })

  it("shows an error when the API request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockedGetOpenJobs.mockRejectedValue(new Error("Backend unavailable"))

    render(<Jobs />)

    expect(
      await screen.findByText("Unable to load open jobs."),
    ).toBeInTheDocument()
  })

  it("shows the empty state when there are no jobs", async () => {
    mockedGetOpenJobs.mockResolvedValue([])

    render(<Jobs />)

    expect(
      await screen.findByText("No open jobs found."),
    ).toBeInTheDocument()
  })
})
