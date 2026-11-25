import { useEffect, useState, type ReactNode } from "react";

import { getOpenActions } from "../../api/actions";
import { getOpenDrs } from "../../api/drs";
import { getOpenJobs } from "../../api/jobs";
import { getUpcomingTasks } from "../../api/tasks";
import { ActionsList } from "../../components/ActionsList";
import { DrsList } from "../../components/DrsList";
import { JobsList } from "../../components/JobsList";
import { TasksList } from "../../components/TasksList";
import type { Action } from "../../types/action";
import type { DeviceAvailability } from "../../types/availability";
import type { Dr } from "../../types/dr";
import type { Job } from "../../types/job";
import type { Task } from "../../types/task";
import { getFfsKey } from "../../utils/ffsDevice";

import { FilteredMaintenanceList, type MaintenanceFilter } from "./FilteredMaintenanceList";
import "./DeviceMaintenanceSections.css";

const sections = {
  recommended: "Recommended tasks",
  tasks: "Tasks",
  jobs: "Open jobs",
  drs: "Open DRs",
  actions: "Actions",
} as const;

type Section = keyof typeof sections;
type RecordSection = Exclude<Section, "recommended">;
type Records =
  | { section: "jobs"; rows: Job[] }
  | { section: "drs"; rows: Dr[] }
  | { section: "tasks"; rows: Task[] }
  | { section: "actions"; rows: Action[] };
type RecordsResult = Records | { error: string };

const sectionKeys = Object.keys(sections) as Section[];

const jobFilters: MaintenanceFilter<Job>[] = [
  { id: "overdue", label: "Overdue", tone: "danger", matches: row => row.days_remaining !== null && row.days_remaining < 0 },
  { id: "today", label: "Today", tone: "warning", matches: row => row.days_remaining === 0 },
  { id: "upcoming", label: "Upcoming", tone: "info", matches: row => row.days_remaining !== null && row.days_remaining > 0 },
];

const taskFilters: MaintenanceFilter<Task>[] = [
  { id: "out_of_tolerance", label: "Out of tolerance", tone: "danger", matches: row => row.planning_category === "out_of_tolerance" },
  { id: "backlog", label: "Backlog", tone: "warning", matches: row => row.planning_category === "backlog" },
  { id: "today", label: "Today", tone: "warning", matches: row => row.planning_category === "today" },
  { id: "upcoming", label: "Upcoming", tone: "info", matches: row => row.planning_category === "upcoming" },
  { id: "unknown_tolerance", label: "Unknown tolerance", matches: row => row.planning_category === "unknown_tolerance" },
];

const drFilters: MaintenanceFilter<Dr>[] = [
  { id: "repeated", label: "Repeated", tone: "warning", matches: row => (row.repetitions ?? 0) > 1 },
];

const actionFilters: MaintenanceFilter<Action>[] = [
  { id: "open", label: "Open", tone: "danger", matches: row => row.status_id === 19 },
  { id: "ongoing", label: "On going", tone: "info", matches: row => row.status_id === 20 },
];

function matchesDevice(
  device: DeviceAvailability,
  id: number | null,
  name: string | null,
): boolean {
  return id != null
    ? id === device.deviceId
    : name?.trim().toUpperCase() === device.deviceName.trim().toUpperCase();
}

async function loadRecords(
  section: RecordSection,
  device: DeviceAvailability,
  taskDeviceName?: string,
): Promise<Records> {
  const ffsKey = /^FFS\s/i.test(device.deviceName.trim()) ? getFfsKey(device.deviceName) : null;

  switch (section) {
    case "jobs": {
      const rows = await getOpenJobs();
      return { section, rows: rows.filter(row => row.device_id === device.deviceId) };
    }
    case "drs": {
      // Use the same open DR query and FFS grouping as the DRs page.
      const rows = await getOpenDrs();
      return {
        section,
        rows: rows.filter(row => matchesDevice(device, row.device_id, row.device_name)
          || (ffsKey !== null && getFfsKey(row.device_name) === ffsKey)),
      };
    }
    case "tasks": {
      const rows = await getUpcomingTasks(7);
      const taskGroup = taskDeviceName?.trim().toUpperCase() || ffsKey;
      return {
        section,
        rows: rows.filter(row => matchesDevice(device, row.device_id, row.device)
          || (taskGroup !== null && row.device.trim().toUpperCase() === taskGroup)),
      };
    }
    case "actions": {
      const rows = await getOpenActions();
      return { section, rows: rows.filter(row => matchesDevice(device, row.device_id, row.device)) };
    }
  }
}

function DeviceRecords({
  section,
  device,
  taskDeviceName,
}: {
  section: RecordSection;
  device: DeviceAvailability;
  taskDeviceName?: string;
}) {
  const [result, setResult] = useState<RecordsResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadRecords(section, device, taskDeviceName).then(
      data => {
        if (active) setResult(data);
      },
      () => {
        if (active) {
          setResult({ error: "Unable to load records for this device." });
        }
      },
    );
    return () => { active = false; };
  }, [section, device, taskDeviceName, attempt]);

  if (result === null) {
    return <div className="availability-modal__empty" role="status">Loading…</div>;
  }
  if ("error" in result) {
    return (
      <div className="availability-modal__empty">
        <p role="alert">{result.error}</p>
        <button type="button" className="availability-card__tasks-button" onClick={() => {
          setResult(null);
          setAttempt(value => value + 1);
        }}>
          Retry
        </button>
      </div>
    );
  }

  switch (result.section) {
    case "jobs":
      return (
        <FilteredMaintenanceList
          rows={result.rows}
          filters={jobFilters}
          renderList={rows => <JobsList jobs={rows} />}
        />
      );
    case "drs":
      return (
        <FilteredMaintenanceList
          rows={result.rows}
          filters={drFilters}
          renderList={rows => <DrsList drs={rows} />}
        />
      );
    case "tasks":
      return (
        <FilteredMaintenanceList
          rows={result.rows}
          filters={taskFilters}
          renderList={rows => <TasksList tasks={rows} />}
        />
      );
    case "actions":
      return (
        <FilteredMaintenanceList
          rows={result.rows}
          filters={actionFilters}
          renderList={rows => <ActionsList actions={rows} />}
        />
      );
  }
}

export function DeviceMaintenanceSections({
  device,
  taskDeviceName,
  children,
}: {
  device: DeviceAvailability;
  taskDeviceName?: string;
  children: ReactNode;
}) {
  const [section, setSection] = useState<Section>("recommended");

  return (
    <>
      <div className="availability-modal__sections" role="group" aria-label="Maintenance sections">
        {sectionKeys.map(key => (
          <button
            key={key}
            type="button"
            className="availability-card__tasks-button"
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {sections[key]}
          </button>
        ))}
      </div>
      <div className="availability-modal__body" key={section} role="region" aria-label={sections[section]}>
        {section === "recommended" ? children : (
          <DeviceRecords
            key={device.deviceId}
            section={section}
            device={device}
            taskDeviceName={taskDeviceName}
          />
        )}
      </div>
    </>
  );
}
