import { useEffect, useState } from "react"

import {
  getExpiringJobs,
  getOverdueJobs,
} from "../api/jobs"

import { getOpenDrs } from "../api/drs"
import { getOpenActions } from "../api/actions"
import { getUpcomingTasks } from "../api/tasks"

import type { Job } from "../types/job"
import type { Dr } from "../types/dr"
import type { Action } from "../types/action"
import type { Task } from "../types/task"

import { JobsCarousel } from "../components/jobs/JobsCarousel"
import { DrsCarousel } from "../components/drs/DrsCarousel"
import { ActionsCarousel } from "../components/actions/ActionsCarousel"
import { TasksCarousel } from "../components/tasks/TasksCarousel"

import "../styles/dashboard.css"


export function Dashboard() {
  const [expiringJobs, setExpiringJobs] = useState<Job[]>([])
  const [overdueJobs, setOverdueJobs] = useState<Job[]>([])
  const [openDrs, setOpenDrs] = useState<Dr[]>([])
  const [openActions, setOpenActions] = useState<Action[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [
          expiring,
          overdue,
          drs,
          actions,
          upcomingTasks,
        ] = await Promise.all([
          getExpiringJobs(7),
          getOverdueJobs(),
          getOpenDrs(),
          getOpenActions(),
          getUpcomingTasks(7),
        ])

        console.log("Expiring jobs:", expiring.length)
        console.log("Overdue jobs:", overdue.length)
        console.log("Open DRs:", drs.length)
        console.log("Open Actions:", actions.length)
        console.log("Upcoming Tasks:", upcomingTasks.length)

        setExpiringJobs(expiring)
        setOverdueJobs(overdue)
        setOpenDrs(drs)
        setOpenActions(actions)
        setTasks(upcomingTasks)
      } catch (error) {
        console.error("Dashboard load error:", error)
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

      <DrsCarousel
        title={`OPEN DISCREPANCY REPORTS (${openDrs.length})`}
        drs={openDrs}
      />

      <ActionsCarousel
        title={`OPEN ACTIONS (${openActions.length})`}
        actions={openActions}
      />

      <TasksCarousel
        title={`SCHEDULED TASKS (${tasks.length})`}
        tasks={tasks}
      />

      <JobsCarousel
        title="JOBS EXPIRING"
        jobs={expiringJobs}
      />

      <JobsCarousel
        title="OVERDUE JOBS"
        jobs={overdueJobs}
      />
    </main>
  )
}