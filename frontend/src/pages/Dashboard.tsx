import { useEffect, useState } from "react"

import {
  getExpiringJobs,
  getOverdueJobs,
} from "../api/jobs"

import { getOpenDrs } from "../api/drs"

import type { Job } from "../types/job"
import type { Dr } from "../types/dr"

import { JobsCarousel } from "../components/jobs/JobsCarousel"
import { DrsCarousel } from "../components/drs/DrsCarousel"

import "../styles/dashboard.css"


export function Dashboard() {
  const [expiringJobs, setExpiringJobs] = useState<Job[]>([])
  const [overdueJobs, setOverdueJobs] = useState<Job[]>([])
  const [openDrs, setOpenDrs] = useState<Dr[]>([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [expiring, overdue, drs] =
          await Promise.all([
            getExpiringJobs(7),
            getOverdueJobs(),
            getOpenDrs(),
          ])

        setExpiringJobs(expiring)
        setOverdueJobs(overdue)
        setOpenDrs(drs)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading dashboard...
      </div>
    )
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>OPERATIONS DASHBOARD</h1>
          <span>mySim Monitoring</span>
        </div>

        <div className="dashboard-date">
          {new Date().toLocaleDateString()}
        </div>
      </header>

      <JobsCarousel
        title="JOBS EXPIRING"
        jobs={expiringJobs}
      />

      <JobsCarousel
        title="OVERDUE JOBS"
        jobs={overdueJobs}
      />
<div style={{ color: "red", fontSize: "24px" }}>
  DR COUNT: {openDrs.length}
</div>
      <DrsCarousel
        title="OPEN DISCREPANCY REPORTS"
        drs={openDrs}
      />
    </main>
  )
}