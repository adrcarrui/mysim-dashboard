import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import { apiFetch } from "../../api/client";
import type { Member, WorkItem } from "./BriefingWork";
import type { CalendarBriefing } from "./BriefingCalendar";
import { BriefingWorkDetail } from "./BriefingWorkDetail";
import { taskDuration } from "./taskDuration";
import { BriefingTaskControls } from "./BriefingTaskControls";
import type { TaskOperations } from "./BriefingTaskControls";
import { targetDay as day } from "./briefingTaskCatalog";
import type { useBriefingTaskCatalog } from "./briefingTaskCatalog";
import type { CalendarWorkItem } from "./BriefingTaskExecution";
import "./BriefingTargetDays.css";

const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
const sources = [
  { type: "job", label: "Jobs", path: "/api/jobs/open", id: "id", code: "job_number", date: "target_date", description: "description" },
  { type: "dr", label: "DRs", path: "/api/drs/open", id: "id", code: "dr_id", date: "target_date", description: "fault_description" },
  { type: "action", label: "Actions", path: "/api/actions/open", id: "id", code: "action_id", date: "date", description: "description" },
  { type: "task", label: "Tasks", path: "/api/tasks/upcoming?days=31", id: "scheduled_task_id", code: "task_code", date: "planned_date", description: "description" },
] as const;
type Entry = { item: CalendarWorkItem; record: Record<string, unknown>; targetDay: string; code: string; description: string; deviceKey: string };
function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function monday(value: string): string {
  return addDays(value, -((new Date(`${value}T12:00:00Z`).getUTCDay() + 6) % 7));
}
function normalize(row: Record<string, unknown>, source: typeof sources[number]): Entry | null {
  const id = row[source.id];
  if (typeof id !== "number" && typeof id !== "string") return null;
  if (!String(id).trim()) return null;
  const code = String(row[source.code] || id);
  const description = String(row[source.description] || row.customer_description || "No description");
  const deviceId = typeof row.device_id === "number" ? row.device_id : null;
  const deviceName = String(row.device_name || row.device || "No device");
  return { code, description, record: row, targetDay: day(row[source.date]), deviceKey: deviceId === null ? `name:${deviceName}` : `id:${deviceId}`,
    item: { source_type: source.type, source_id: String(id), title: `${code} · ${description}`, device_name: deviceName, mysim_device_id: deviceId,
      responsible_user_id: null, ...taskDuration(source.type, row), planned_start: null,
      is_critical: false, discussion_notes: "", agreed_action: "" } };
}
const key = (item: WorkItem) => `${item.source_type}:${item.source_id}`;
const typeLabels = { job: "Job", dr: "DR", action: "Action", task: "Task", manual: "Manual" };
const typeColours = { job: "#005587", dr: "#b42338", action: "#8656a0", task: "#367d59", manual: "#6b7785" };
const toleranceLabels: Record<string, string> = {
  in_tolerance: "In tolerance", out_of_tolerance: "Out of tolerance",
  upcoming: "Upcoming tolerance", unknown_tolerance: "Unknown tolerance",
};
function toleranceInfo(record: Record<string, unknown>) {
  const value = typeof record.tolerance_status === "string" ? record.tolerance_status : "";
  const status = Object.hasOwn(toleranceLabels, value) ? value : "unknown_tolerance";
  const range = [record.tolerance_start, record.tolerance_end].map(value => {
    const stamp = typeof value === "string" ? new Date(value) : null;
    return stamp && Number.isFinite(stamp.getTime()) ? stamp.toLocaleString("en-GB", { timeZone: "Europe/Madrid" }) : "Unknown";
  }).join(" – ");
  const reason = typeof record.unknown_tolerance_reason === "string" ? record.unknown_tolerance_reason : "";
  return { status, label: toleranceLabels[status], title: `Tolerance window (Europe/Madrid): ${range}${reason ? ` · ${reason}` : ""}. Status provided by the app.` };
}
const planTime = (stamp: number) => new Date(stamp).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export function BriefingTargetDays({ briefing, members, onOpenBriefing, catalog, onRefreshTasks, operations }: {
  catalog: ReturnType<typeof useBriefingTaskCatalog>;
  onRefreshTasks: () => void;
  operations?: TaskOperations;
  briefing: CalendarBriefing | null; members: Member[]; onOpenBriefing: (id: number) => void;
}) {
  const [otherEntries, setEntries] = useState<Entry[]>([]);
  const [loadingOther, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState("all");
  const [device, setDevice] = useState("");
  const [search, setSearch] = useState("");
  const [weekStart, setWeekStart] = useState(() => monday(day(new Date().toISOString())));
  const [showUndated, setShowUndated] = useState(false);
  const weekEnd = addDays(weekStart, 6);
  const [inspected, setInspected] = useState<Entry | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      const otherSources = sources.filter(source => source.type !== "task");
      const results = await Promise.allSettled(otherSources.map(async source => {
        const response = await apiFetch(BASE + source.path, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid response");
        return data.filter(row => row && typeof row === "object").map(row => normalize(row, source)).filter((entry): entry is Entry => entry !== null);
      }));
      if (controller.signal.aborted) return;
      const rows: Entry[] = []; const failures: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") rows.push(...result.value);
        else failures.push(`${otherSources[index].label}: ${String(result.reason)}`);
      });
      setEntries([...new Map(rows.map(row => [key(row.item), row])).values()]);
      setErrors(failures); setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [attempt, weekStart]);
  const loading = loadingOther || catalog.loading;
  const savedItems = new Map((briefing?.items ?? []).map(item => [key(item), item]));
  const taskEntries: Entry[] = catalog.tasks.map(({ item, record }) => {
    const saved = savedItems.get(key(item));
    const targetDay = item.target_day ?? saved?.target_day ?? "";
    return { item: { ...(saved ?? item), target_day: targetDay || null }, record, targetDay,
      code: String(record.task_code || item.source_id), description: String(record.description || "No description"),
      deviceKey: item.mysim_device_id === null ? `name:${item.device_name}` : `id:${item.mysim_device_id}` };
  });
  const liveIds = new Set(taskEntries.map(entry => entry.item.source_id));
  for (const item of savedItems.values()) {
    if (item.source_type !== "task" || !item.target_day || liveIds.has(item.source_id)) continue;
    const separator = item.title.indexOf(" · ");
    const code = separator < 0 ? item.title : item.title.slice(0, separator);
    const description = separator < 0 ? item.title : item.title.slice(separator + 3);
    taskEntries.push({ item, record: {}, targetDay: item.target_day, code, description,
      deviceKey: item.mysim_device_id === null ? `name:${item.device_name}` : `id:${item.mysim_device_id}` });
  }
  const entries = [...otherEntries, ...taskEntries];
  const devices = [...new Map(entries.map(entry => [entry.deviceKey, entry.item.device_name || "No device"])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const matching = entries.filter(entry => (kind === "all" || entry.item.source_type === kind) && (!device || entry.deviceKey === device)
    && `${entry.code} ${entry.description} ${entry.item.device_name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const undatedCount = matching.filter(entry => !entry.targetDay).length;
  const filtered = matching.filter(entry => entry.targetDay
    ? entry.targetDay >= weekStart && entry.targetDay <= weekEnd : showUndated);
  filtered.sort((a, b) => (a.targetDay || "9999-99-99").localeCompare(b.targetDay || "9999-99-99") || a.code.localeCompare(b.code));
  const today = day(new Date().toISOString());
  const inspectedEntry = inspected && (entries.find(entry => key(entry.item) === key(inspected.item)) ?? inspected);
  const included = inspectedEntry ? savedItems.get(key(inspectedEntry.item)) : undefined;
  const completed = (entry: Entry) => Boolean(savedItems.get(key(entry.item))?.execution?.completed_at);
  function eventClass(entry: Entry) {
    return `briefing-target-days__event--${entry.item.source_type}${completed(entry) ? " briefing-target-days__event--completed" : ""}`;
  }
  const participants = new Set(briefing?.participant_ids ?? briefing?.participants?.map(member => member.amh_user_id) ?? []);
  const names = [...(briefing?.participants ?? []), ...members];
  const datedEntries = filtered.filter(entry => !!entry.targetDay);
  const undatedEntries = filtered.filter(entry => !entry.targetDay);
  const events: EventInput[] = datedEntries.map(entry => ({
    id: key(entry.item), title: `${entry.code} · ${entry.description}`, start: entry.targetDay, allDay: true,
    borderColor: completed(entry) ? "#007a73" : typeColours[entry.item.source_type],
    classNames: eventClass(entry).split(" "), extendedProps: { entry },
  }));
  function renderCard(entry: Entry) {
    const saved = savedItems.get(key(entry.item));
    const duration = (saved ?? entry.item).estimated_duration_minutes;
    const durationReference = (saved ?? entry.item).duration_reference;
    const start = saved?.planned_start ? Date.parse(saved.planned_start) : NaN;
    const scheduled = !!saved?.responsible_user_id && participants.has(saved.responsible_user_id)
      && Number.isFinite(start) && duration !== null && duration > 0;
    const owner = names.find(member => member.amh_user_id === saved?.responsible_user_id)?.display_name;
    const isTask = entry.item.source_type === "task";
    const tolerance = isTask ? toleranceInfo(entry.record) : null;
    const inlineControls = isTask && operations;
    const hasAssignmentSelect = inlineControls && operations?.canAssign && operations.participants.length > 0;
    return <div className="briefing-target-days__event-content">
      <button type="button" className="briefing-target-days__card-open"
        aria-label={`${entry.code} ${entry.description}`} title={entry.description}
        onClick={() => setInspected(entry)}>
        <span className="briefing-target-days__type"><b>{typeLabels[entry.item.source_type]}</b><small>{entry.item.device_name}</small></span>
        <strong className="briefing-target-days__reference">{entry.code}</strong>
      </button>
      <div className="briefing-target-days__badges">
        {entry.targetDay && <span className={`briefing-target-days__target-status${entry.targetDay < today ? " is-past" : entry.targetDay === today ? " is-today" : ""}`}
          title={entry.item.source_type === "task" ? "Based on the planned date; this does not determine the task tolerance status." : "Based on this work item's target date."}>
          {entry.targetDay < today ? "Target date passed" : entry.targetDay === today ? "Today" : "Upcoming"}
        </span>}
        {!inlineControls && (saved?.execution?.completed_at ? <span className="briefing-target-days__execution">Completed</span>
          : saved?.execution?.started_at && <span className="briefing-target-days__execution">
            {saved.execution.running_since ? "In progress" : "Paused"}
          </span>)}
        {duration != null && <small title={durationReference}>{duration} min</small>}
        {tolerance && <span className={`briefing-target-days__tolerance briefing-target-days__tolerance--${tolerance.status}`} title={tolerance.title}>{tolerance.label}</span>}
      </div>
      {saved && <div className="briefing-target-days__plan">
        <span className={`briefing-target-days__plan-status${scheduled ? " is-scheduled" : " is-included"}`}>{scheduled ? "Scheduled" : "Needs planning"}</span>
        {saved.responsible_user_id && !hasAssignmentSelect && <small>{owner || "Name unavailable"}</small>}
        {scheduled && <small>{planTime(start)} – {planTime(start + duration * 60000)}</small>}
      </div>}
      {inlineControls && <div className="briefing-target-days__card-controls">
        <BriefingTaskControls key={`${inlineControls.briefingId}:${entry.item.source_id}`}
          item={entry.item} saved={saved} operations={inlineControls} view="target" />
      </div>}
    </div>;
  }
  function renderEvent(info: EventContentArg) {
    return renderCard(info.event.extendedProps.entry as Entry);
  }
  return <div className="briefing-target-days">
    <div className="briefing-target-days__filters">
      <label>Type<select value={kind} onChange={event => setKind(event.target.value)}><option value="all">All work</option>{sources.map(source => <option key={source.type} value={source.type}>{source.label}</option>)}</select></label>
      <label>Device<select value={device} onChange={event => setDevice(event.target.value)}><option value="">All devices</option>{devices.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Reference or description" /></label>
      <button type="button" disabled={loading} onClick={() => { setAttempt(value => value + 1); onRefreshTasks(); }}>{loading ? "Loading…" : "Refresh work"}</button>
    </div>
    <p className="briefing-target-days__hint">Monday–Sunday · Jobs: target date · Tasks: planned date · Actions: date. Actions cover today and the next seven days, as on the Actions page. Dates use Europe/Madrid. {loading ? "Loading records…" : `${filtered.length} records shown.`}</p>
    <label className="briefing-target-days__undated"><input type="checkbox" checked={showUndated} onChange={event => setShowUndated(event.target.checked)} />Show work without a target date ({undatedCount})</label>
    {weekEnd > addDays(today, 31) && <p role="status" className="briefing-target-days__hint">Task data is limited to the next 31 days and earlier pending work. This week may have incomplete task data. Jobs are filtered to the selected week. Actions cover today and the next seven days.</p>}
    <p className="briefing-target-days__hint">Colours identify the work type, as in By assignee.{briefing ? ` Assignments refer to briefing #${briefing.id}.` : ""}</p>
    {!briefing && <p className="briefing-target-days__hint">Select a saved briefing to assign or work on tasks.</p>}
    {catalog.error && <p role="alert" className="briefing-target-days__error">Could not load tasks: {catalog.error}</p>}
    {loading && <p role="status">Loading work by target day…</p>}
    {errors.map(error => <p role="alert" key={error} className="briefing-target-days__error">Unable to load {error}. Other sources remain available.</p>)}
    {!loading && filtered.length === 0 && <p>No work matches this week and these filters.</p>}
    <div className="briefing-target-days__calendar-wrap" aria-busy={loading}>
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin]}
        initialView="dayGridWeek"
        initialDate={weekStart}
        now={`${today}T12:00:00Z`}
        firstDay={1}
        locale="en-gb"
        timeZone="UTC"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridWeek,listWeek" }}
        buttonText={{ today: "Today", week: "Week", list: "List" }}
        buttonHints={{ prev: "Previous week", next: "Next week", today: "This week" }}
        height="auto"
        contentHeight="auto"
        expandRows={true}
        stickyHeaderDates={false}
        dayHeaderFormat={{ weekday: "short", day: "numeric", month: "short" }}
        dayMaxEvents={4}
        moreLinkClick="popover"
        eventDisplay="block"
        displayEventTime={false}
        eventInteractive={false}
        editable={false}
        eventOrder="title"
        events={loading ? [] : events}
        datesSet={range => setWeekStart(value => value === range.startStr.slice(0, 10) ? value : range.startStr.slice(0, 10))}
        eventContent={renderEvent}
        noEventsContent={loading ? "Loading work…" : "No work matches this week and these filters."}
      />
    </div>
    {!loading && showUndated && undatedEntries.length > 0 && <section aria-label="No target date" className="briefing-target-days__undated-section">
      <h3>No target date <span>({undatedEntries.length})</span></h3>
      <div className="briefing-target-days__undated-grid">{undatedEntries.map(entry => <div key={key(entry.item)}
        className={`briefing-target-days__undated-event ${eventClass(entry)}`}>{renderCard(entry)}</div>)}</div>
    </section>}
    {inspectedEntry && <BriefingWorkDetail item={included ?? inspectedEntry.item} sourceRecord={inspectedEntry.record}
      members={[...(briefing?.participants ?? []), ...members]} showBriefingPlan={!!included}
      executionControls={operations && inspectedEntry.item.source_type === "task"
        ? <BriefingTaskControls key={`${operations.briefingId}:${inspectedEntry.item.source_id}`}
            item={inspectedEntry.item} saved={included} operations={operations} view="detail" />
        : undefined}
      onClose={() => setInspected(null)}
      onOpenBriefing={included && briefing ? () => { setInspected(null); onOpenBriefing(briefing.id); } : undefined} />}
  </div>;
}
