import { useEffect, useState } from "react"

import {
  getExpiringJobs,
  getOverdueJobs,
} from "../../api/jobs"

import { getOpenDrs } from "../../api/drs"
import { getOpenActions } from "../../api/actions"
import { getUpcomingTasks } from "../../api/tasks"

import type { Job } from "../../types/job"
import type { Dr } from "../../types/dr"
import type { Action } from "../../types/action"
import type { Task } from "../../types/task"

import { JobsCarousel } from "../../components/jobs/JobsCarousel"
import { DrsCarousel } from "../../components/drs/DrsCarousel"
import { ActionsCarousel } from "../../components/actions/ActionsCarousel"
import { TasksCarousel } from "../../components/tasks/TasksCarousel"

import "./Dashboard.css"


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
        const results = await Promise.allSettled([
          getExpiringJobs(7),
          getOverdueJobs(),
          getOpenDrs(),
          getOpenActions(),
          getUpcomingTasks(7),
        ])

        const [
          expiringResult,
          overdueResult,
          drsResult,
          actionsResult,
          tasksResult,
        ] = results

        if (expiringResult.status === "fulfilled") {
          console.log(
            "Expiring jobs:",
            expiringResult.value.length
          )

          setExpiringJobs(expiringResult.value)
        } else {
          console.error(
            "Expiring jobs error:",
            expiringResult.reason
          )
        }

        if (overdueResult.status === "fulfilled") {
          console.log(
            "Overdue jobs:",
            overdueResult.value.length
          )

          setOverdueJobs(overdueResult.value)
        } else {
          console.error(
            "Overdue jobs error:",
            overdueResult.reason
          )
        }

        if (drsResult.status === "fulfilled") {
          console.log(
            "Open DRs:",
            drsResult.value.length
          )

          setOpenDrs(drsResult.value)
        } else {
          console.error(
            "DRs error:",
            drsResult.reason
          )
        }

        if (actionsResult.status === "fulfilled") {
          console.log(
            "Open Actions:",
            actionsResult.value.length
          )

          setOpenActions(actionsResult.value)
        } else {
          console.error(
            "Actions error:",
            actionsResult.reason
          )
        }

        if (tasksResult.status === "fulfilled") {
          console.log(
            "Upcoming Tasks:",
            tasksResult.value.length
          )

          setTasks(tasksResult.value)
        } else {
          console.error(
            "Tasks error:",
            tasksResult.reason
          )
        }

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
        title={`JOBS EXPIRING (${expiringJobs.length})`}
        jobs={expiringJobs}
      />

      <JobsCarousel
        title={`OVERDUE JOBS (${overdueJobs.length})`}
        jobs={overdueJobs}
      />
    </main>
  )
}