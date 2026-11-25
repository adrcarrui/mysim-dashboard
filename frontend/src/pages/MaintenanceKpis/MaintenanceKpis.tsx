import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import { briefingErrorMessage } from "../Briefings/briefingErrorMessage";
import "./MaintenanceKpis.css";

const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
const PAGE_SIZE = 25;
const shiftNames: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", night: "Night" };
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });
const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" });
const hours = (minutes: number) => `${number.format(minutes / 60)} h`;
const min = (minutes: number | null) => minutes == null ? "—" : `${number.format(minutes)} min`;
const delta = (minutes: number | null) => minutes == null ? "—" : `${minutes > 0 ? "+" : ""}${min(minutes)}`;
const ratio = (part: number, whole: number) => whole ? `${number.format(100 * part / whole)} %` : "—";
const shortDate = (value: string) => value.split("-").reverse().join("/");
const timestamp = (value: string | null) => value ? stamp.format(new Date(value)) : "—";

type Summary = {
  closed: number; measured: number; paired: number; effective_minutes: number;
  paired_actual_minutes: number; paired_estimate_minutes: number; median_actual_minutes: number | null;
  median_delta_minutes: number | null; median_estimate_minutes: number | null;
  known_window: number; on_time: number; attributed: number;
};
type Execution = {
  briefing_id: number; source_id: string; title: string; device: string; device_name: string;
  task: string; shift: string; started_at: string | null; completed_at: string; target_day: string | null;
  assigned_name: string | null; performers: {id: string; name: string}[];
  estimate_minutes: number | null; active_seconds: number | null; within_tolerance: boolean | null;
};
type Report = {
  summary: Summary;
  trend: (Summary & {period: string})[];
  tasks: (Summary & {device: string; device_name: string; task: string; task_code: string; title: string})[];
  shifts: {shift: string; planned: number; planned_measured: number; planned_minutes: number; closed: number;
    effective_minutes: number; occupied_minutes: number; with_intervals: number}[];
  employees: (Summary & {id: string; name: string})[];
  backlog: {day: string; pending: number; overdue: number}[];
  mysim: {closed_on_time: number; closed_outside: number; pending_overdue: number; pending_open: number; unknown: number};
  devices: Record<string, string>; task_options: Record<string, string>; employee_options: Record<string, string>;
  executions: Execution[];
};
type Filters = {start: string; end: string; period: string; device: string; task: string; shift: string; employee: string};
function initialFilters(): Filters {
  const end = day.format(new Date());
  return { start: end.slice(0, 7) + "-01", end, period: "week", device: "", task: "", shift: "", employee: "" };
}
function Select({ label, value, options, onChange }: {
  label: string; value: string; options: Record<string, string>; onChange: (value: string) => void;
}) {
  return <label>{label}
    <select value={value} onChange={event => onChange(event.target.value)}>
      <option value="">All</option>
      {Object.entries(options).sort(([, a], [, b]) => a.localeCompare(b, "en")).map(([key, name]) =>
        <option key={key} value={key}>{name}</option>)}
      {value && !Object.hasOwn(options, value) && <option value={value}>{value}</option>}
    </select>
  </label>;
}

function Bars({ series, labels, unit }: {
  series: {label: string; first: number; second: number; sample?: number}[];
  labels: [string, string]; unit?: string;
}) {
  if (!series.length) return <p>No data for this period.</p>;
  const max = Math.max(1, ...series.flatMap(row => [row.first, row.second]));
  return <>
    <p className="kpis-legend"><span>{labels[0]}</span><span>{labels[1]}</span></p>
    <div className="kpis-bars">
      {series.map(row => <div key={row.label} className="kpis-bars__row">
        <span>{row.label}{row.sample !== undefined && <small>{row.sample} compared</small>}</span>
        <div className="kpis-bars__series">
          {[row.first, row.second].map((value, index) => <div key={index}>
            <span role="img" aria-label={`${row.label}, ${labels[index]}: ${number.format(value)} ${unit ?? ""}`}
              className={`kpis-bar kpis-bar--${index}`} style={{ width: `${100 * value / max}%` }} />
            <small aria-hidden="true">{number.format(value)}{unit ? ` ${unit}` : ""}</small>
          </div>)}
        </div>
      </div>)}
    </div>
  </>;
}

export function MaintenanceKpis() {
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<{device: string; task: string; title: string} | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams(Object.entries(applied).filter(([, value]) => value));
      try {
        const response = await apiFetch(`${BASE}/api/briefings/metrics?${params}`, {
          signal: abort.signal, cache: "no-store", credentials: "include",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) throw new Error(typeof data?.detail === "string"
          ? briefingErrorMessage(data.detail) : `Could not load KPIs (HTTP ${response.status}).`);
        if (!abort.signal.aborted) setReport(data);
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load KPIs.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => abort.abort();
  }, [applied]);

  const change = (field: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [field]: value }));
  const executions = report?.executions.filter(row => !group || (row.task === group.task && row.device === group.device)) ?? [];
  const summary = report?.summary;
  const employeeName = report?.employee_options[applied.employee];
  const cohort = report?.mysim;

  return <main className="maintenance-kpis">
    <header className="kpis-header">
      <h1>Maintenance KPIs</h1>
    </header>
    <form className="kpis-filters" onSubmit={event => {
      event.preventDefault();
      setGroup(null); setPage(0); setApplied({ ...filters });
    }}>
      <label>From<input type="date" required value={filters.start} max={filters.end} onChange={event => change("start", event.target.value)} /></label>
      <label>To<input type="date" required value={filters.end} min={filters.start} onChange={event => change("end", event.target.value)} /></label>
      <label>Group by<select value={filters.period} onChange={event => change("period", event.target.value)}>
        <option value="week">Week</option><option value="month">Month</option>
      </select></label>
      <Select label="Shift" value={filters.shift} options={shiftNames} onChange={value => change("shift", value)} />
      <Select label="Device" value={filters.device} options={report?.devices ?? {}} onChange={value => change("device", value)} />
      <Select label="Task" value={filters.task} options={report?.task_options ?? {}} onChange={value => change("task", value)} />
      <Select label="Performed by" value={filters.employee} options={report?.employee_options ?? {}} onChange={value => change("employee", value)} />
      <button type="submit">Apply filters</button>
    </form>
    {loading && <p role="status">Loading KPIs…</p>}
    {error && <p role="alert" className="kpis-error">{error}</p>}
    {!loading && !error && report && summary && cohort && <>
      <section className="kpis-summary" aria-label="Execution summary">
        <h2>{employeeName ? `Execution summary for ${employeeName}` : "Briefing execution"}</h2>
        <p>{shortDate(applied.start)} – {shortDate(applied.end)} · Actual completion date</p>
        <dl className="kpis-cards">
          <div><dt>Completed</dt><dd>{summary.closed}</dd><small>{summary.attributed} with a confirmed performer</small></div>
          <div><dt>Active time</dt><dd>{summary.measured ? hours(summary.effective_minutes) : "—"}</dd><small>{summary.measured} timed executions</small></div>
          <div><dt>Median variance</dt><dd>{delta(summary.median_delta_minutes)}</dd><small>{summary.paired} compared</small></div>
          <div><dt>Timing coverage</dt><dd>{ratio(summary.measured, summary.closed)}</dd><small>{summary.measured} of {summary.closed}</small></div>
          <div><dt>Completed within tolerance</dt><dd>{ratio(summary.on_time, summary.known_window)}</dd><small>{summary.on_time} of {summary.known_window} with a known tolerance window</small></div>
        </dl>
      </section>
      <div className="kpis-chart-grid">
        <section className="kpis-panel">
          <h2>Estimated vs actual</h2>
          <Bars series={report.trend.filter(row => row.paired > 0).map(row => ({
            label: shortDate(row.period), first: row.paired_estimate_minutes / 60,
            second: row.paired_actual_minutes / 60, sample: row.paired,
          }))} labels={["Estimated", "Actual"]} unit="h" />
        </section>
        <section className="kpis-panel">
          <h2>Backlog history</h2>
          <p>Latest snapshot in each period. Filtered by device and task.</p>
          <Bars series={report.backlog.map(row => ({ label: shortDate(row.day), first: row.pending, second: row.overdue }))}
            labels={["Past target date", "Out of tolerance"]} />
        </section>
      </div>
      <section className="kpis-panel">
        <h2>mySim schedule compliance</h2>
        <p>Synced tasks with a target date in the period. Filtered by device and task.</p>
        <dl className="kpis-cards">
          <div><dt>Compliance</dt><dd>{ratio(cohort.closed_on_time, cohort.closed_on_time + cohort.closed_outside + cohort.pending_overdue)}</dd>
            <small>{cohort.closed_on_time} on time · {cohort.closed_outside} outside the tolerance window</small></div>
          <div><dt>Pending and out of tolerance</dt><dd>{cohort.pending_overdue}</dd></div>
          <div><dt>Pending with an open tolerance window</dt><dd>{cohort.pending_open}</dd></div>
          <div><dt>Missing a tolerance window or verified completion</dt><dd>{cohort.unknown}</dd></div>
        </dl>
      </section>
      <section className="kpis-panel">
        <h2>Workload by shift</h2>
        <p>Planned workload uses the briefing date. Recorded occupancy counts overlapping time once per technician when all intervals are recorded and a single performer is confirmed.</p>
        <div className="kpis-table"><table>
          <thead><tr><th>Shift</th><th>Included tasks</th><th>Planned hours</th><th>Completed tasks</th><th>Active hours</th><th>Recorded occupancy</th></tr></thead>
          <tbody>{report.shifts.map(row => <tr key={row.shift}><th>{shiftNames[row.shift] ?? row.shift}</th>
            <td>{row.planned}</td><td>{row.planned_measured ? hours(row.planned_minutes) : "—"}</td>
            <td>{row.closed}</td><td>{hours(row.effective_minutes)}</td>
            <td>{row.with_intervals ? `${hours(row.occupied_minutes)} · ${row.with_intervals} ${row.with_intervals === 1 ? "task" : "tasks"}` : "—"}</td>
          </tr>)}</tbody>
        </table></div>
        {!report.shifts.length && <p>No workload recorded for this period.</p>}
      </section>
      <section className="kpis-panel">
        <h2>By employee</h2>
        <p>Select an employee to review their work by task and device. For a shared task, the recorded time covers the whole execution.</p>
        <div className="kpis-table"><table>
          <thead><tr><th>Employee</th><th>Completed</th><th>Recorded time</th><th>Coverage</th><th>Within tolerance</th></tr></thead>
          <tbody>{report.employees.map(person => <tr key={person.id}><th><button type="button" className="kpis-link"
            onClick={() => {
              const next = { ...applied, employee: person.id };
              setFilters(next); setApplied(next); setGroup(null); setPage(0);
            }}>{person.name}</button></th>
            <td>{person.closed}</td><td>{person.measured ? hours(person.effective_minutes) : "—"}</td>
            <td>{ratio(person.measured, person.closed)}</td><td>{person.on_time} / {person.known_window}</td>
          </tr>)}</tbody>
        </table></div>
        {!report.employees.length && <p>No executions with a confirmed technician.</p>}
      </section>
      <section className="kpis-panel">
        <h2>Breakdown by task and device</h2>
        <div className="kpis-table"><table>
          <thead><tr><th>Task</th><th>Device</th><th>Completed</th><th>Compared</th><th>Median actual time</th><th>Median estimated time</th><th>Median variance</th></tr></thead>
          <tbody>{report.tasks.map(row => <tr key={`${row.device}:${row.task}`}>
            <th><button type="button" className="kpis-link" onClick={() => {
              setGroup({ device: row.device, task: row.task, title: row.title }); setPage(0);
              document.getElementById("kpis-executions")?.scrollIntoView?.({ block: "start" });
            }}>{row.title}</button></th>
            <td>{row.device_name}</td><td>{row.closed}</td><td>{row.paired}</td>
            <td>{min(row.median_actual_minutes)}</td><td>{min(row.median_estimate_minutes)}</td><td>{delta(row.median_delta_minutes)}</td>
          </tr>)}</tbody>
        </table></div>
        {!report.tasks.length && <p>No completed Briefing tasks match these filters.</p>}
      </section>
      <section className="kpis-panel" id="kpis-executions">
        <div className="kpis-header"><h2>{group ? `Executions · ${group.title}` : "Executions"}</h2>
          {group && <button type="button" onClick={() => { setGroup(null); setPage(0); }}>Show all</button>}</div>
        <div className="kpis-table"><table>
          <thead><tr><th>Task</th><th>Device</th><th>Assigned to</th><th>Performed by</th><th>Start</th><th>End</th><th>Active time</th><th>Estimated</th><th>Tolerance</th></tr></thead>
          <tbody>{executions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(row => <tr key={`${row.briefing_id}:${row.source_id}`}>
            <th>{row.title}</th><td>{row.device_name}</td><td>{row.assigned_name ?? "—"}</td>
            <td>{row.performers.map(person => person.name).join(", ") || "Not recorded"}</td>
            <td>{timestamp(row.started_at)}</td><td>{timestamp(row.completed_at)}</td>
            <td>{min(row.active_seconds === null ? null : row.active_seconds / 60)}</td><td>{min(row.estimate_minutes)}</td>
            <td>{row.within_tolerance === null ? "No data" : row.within_tolerance ? "Within" : "Outside"}</td>
          </tr>)}</tbody>
        </table></div>
        {!executions.length && <p>No executions in the selected period.</p>}
        {executions.length > PAGE_SIZE && <nav className="kpis-pagination" aria-label="Execution pagination">
          <button disabled={!page} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, executions.length)} of {executions.length}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= executions.length} onClick={() => setPage(value => value + 1)}>Next</button>
        </nav>}
      </section>
    </>}
  </main>;
}
