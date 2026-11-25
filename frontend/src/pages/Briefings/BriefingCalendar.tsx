import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import type { Member } from "./BriefingWork";
import { BriefingWorkDetail } from "./BriefingWorkDetail";
import { BriefingTaskExecution } from "./BriefingTaskExecution";
import type { CalendarWorkItem, TaskExecution } from "./BriefingTaskExecution";
import { BriefingTaskControls } from "./BriefingTaskControls";
import type { TaskOperations } from "./BriefingTaskControls";
import { targetDay } from "./briefingTaskCatalog";
import type { useBriefingTaskCatalog } from "./briefingTaskCatalog";
import "./BriefingCalendar.css";

export type CalendarBriefing = {
  id: number;
  briefing_date: string;
  shift_code: string;
  status: string;
  participants?: Member[];
  participant_ids?: string[];
  mobile_holder_user_id: string | null;
  items?: CalendarWorkItem[];
};
type Span = { start: number; end: number; actual: boolean };
type Event = { item: CalendarWorkItem; span: Span; index: number; start: number; end: number; lane: number; lanes: number };
const MINUTE = 60000;
const PIXELS = 1.5;
const MIN_EVENT_HEIGHT = 12;
const labels: Record<string, string> = { job: "Job", dr: "DR", action: "Action", task: "Task", manual: "Manual" };
const time = (stamp: number) => new Date(stamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
function interval(item: CalendarWorkItem, now: number): Span | null {
  const execution = item.execution;
  if (execution?.started_at) {
    const start = Date.parse(execution.started_at);
    const end = execution.completed_at ? Date.parse(execution.completed_at) : now;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return { start, end: Math.max(start, end), actual: true };
    }
  }
  if (!item.planned_start || !item.estimated_duration_minutes || item.estimated_duration_minutes <= 0) return null;
  const start = Date.parse(item.planned_start);
  return Number.isFinite(start) ? { start, end: start + item.estimated_duration_minutes * MINUTE, actual: false } : null;
}
// Allocate independent lanes to overlapping intervals, including chained overlaps.
function place(events: Event[]): Event[] {
  const sorted = events.sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: Event[] = [];
  let ends: number[] = [];
  function finish() { cluster.forEach(event => { event.lanes = ends.length; }); cluster = []; ends = []; }
  for (const event of sorted) {
    if (cluster.length && event.start >= Math.max(...ends)) finish();
    let lane = ends.findIndex(end => end <= event.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = event.end;
    event.lane = lane;
    cluster.push(event);
  }
  finish();
  return sorted;
}

const taskKey = (item: CalendarWorkItem, index: number) =>
  item.source_type === "task" ? `task:${item.source_id}` : `work:${index}`;

const localDay = (stamp: number) => new Intl.DateTimeFormat("sv-SE").format(stamp);

export function BriefingCalendar({ briefing, onOpen, disabled = false, directoryMembers = [], canTrackTasks = false, onTaskExecutionChange, operations, catalog }: {
  operations?: TaskOperations; catalog?: ReturnType<typeof useBriefingTaskCatalog>;
  canTrackTasks?: boolean; onTaskExecutionChange?: (sourceId: string, execution: TaskExecution) => void;
  briefing: CalendarBriefing; onOpen: (id: number) => void; disabled?: boolean; directoryMembers?: Member[];
}) {
  const [date, setDate] = useState(briefing.briefing_date);
  const [now, setNow] = useState(Date.now);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [fullDay, setFullDay] = useState(false);
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const catalogTasks = catalog?.tasks;
  const today = targetDay(new Date(now).toISOString());
  const { items, savedTasks } = useMemo(() => {
    const savedItems = briefing.items ?? [];
    const savedTasks = new Map(savedItems.filter(item => item.source_type === "task").map(item => [item.source_id, item]));
    const entries = (catalogTasks ?? []).map(entry => entry.item);
    const targets = new Map(entries.map(item => [item.source_id, item.target_day]));
    const suggested = briefing.briefing_date === today
      ? entries.filter(item => item.target_day === today && !savedTasks.has(item.source_id)) : [];
    const items = [...savedItems.map(item => item.source_type === "task" && targets.has(item.source_id)
      ? { ...item, target_day: targets.get(item.source_id) ?? item.target_day } : item), ...suggested];
    return { items, savedTasks };
  }, [briefing.items, briefing.briefing_date, catalogTasks, today]);
  const inspectedIndex = inspectedKey === null ? -1 : items.findIndex((item, index) => taskKey(item, index) === inspectedKey);
  const inspected = items[inspectedIndex];
  const hasOpenExecution = items.some(item => item.execution?.started_at && !item.execution.completed_at);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), hasOpenExecution ? 1000 : 30000);
    return () => window.clearInterval(timer);
  }, [hasOpenExecution]);

  function taskExecution(item: CalendarWorkItem, index: number, view: "card" | "detail" | "event" = "card") {
    const sourceId = item.source_id;
    if (item.source_type !== "task" || !sourceId) return null;
    const onChange = (execution: TaskExecution) => {
      if (!item.execution?.started_at && execution.started_at) {
        const started = Date.parse(execution.started_at);
        setNow(Date.now());
        setDate(localDay(started));
        if (view !== "detail") setFocusKey(taskKey(item, index));
      }
      if (operations) operations.onExecution(sourceId, execution);
      else onTaskExecutionChange?.(sourceId, execution);
    };

    if (operations) return <BriefingTaskControls key={sourceId} item={item} saved={savedTasks.get(sourceId)}
      operations={{ ...operations, onExecution: (_, execution) => onChange(execution) }} view={view}
      onRequestClose={view === "event" ? () => setInspectedKey(taskKey(item, index)) : undefined} />;
    return <BriefingTaskExecution briefingId={briefing.id} key={sourceId} sourceId={sourceId}
      execution={item.execution ?? null} canEdit={canTrackTasks && !!onTaskExecutionChange}
      disabled={disabled} showDates={view === "detail"} compact={view === "event"} onChange={onChange} />;
  }
  const known = briefing.participants ?? [];
  const members = (briefing.participant_ids ?? known.map(member => member.amh_user_id)).map(id =>
    known.find(member => member.amh_user_id === id) ?? { amh_user_id: id, display_name: id });
  const extraMembers = new Map<string, Member>();
  const memberIds = new Set(members.map(member => member.amh_user_id));
  const start = new Date(`${date}T00:00:00`).getTime();
  const next = new Date(start); next.setDate(next.getDate() + 1);
  const end = next.getTime();
  const byMember = new Map<string, Event[]>();
  const pending: { item: CalendarWorkItem; index: number; reason: string }[] = [];
  let outside = 0;
  items.forEach((item, index) => {
    const span = interval(item, now);
    const assigned = item.responsible_user_id;
    const owner = assigned && memberIds.has(assigned) ? assigned : span?.actual ? item.execution?.started_by : null;
    if (!span || !owner) {
      pending.push({ item, index, reason: !owner ? "No shift assignee" : "Schedule incomplete" });
      return;
    }
    const visibleStart = Math.max(span.start, start);
    if (span.start >= end || span.end < start || (span.end === start && span.start < start)) {
      outside++;
      return;
    }
    if (!memberIds.has(owner) && !extraMembers.has(owner)) {
      extraMembers.set(owner, directoryMembers.find(member => member.amh_user_id === owner)
        ?? { amh_user_id: owner, display_name: "Unnamed user" });
    }
    // Give simultaneous instant events distinct lanes without inflating their duration.
    const event = { item, span, index, start: visibleStart, end: Math.min(Math.max(span.end, visibleStart + 1), end), lane: 0, lanes: 1 };
    const column = byMember.get(owner);
    if (column) column.push(event);
    else byMember.set(owner, [event]);
  });
  const columns = [...members, ...extraMembers.values()].map(member => {
    const events = place(byMember.get(member.amh_user_id) ?? []);
    return { member, events, lanes: events.reduce((peak, event) => Math.max(peak, event.lanes), 1) };
  });
  const events = columns.flatMap(column => column.events);
  // Extend short blocks only where there is room before the next block.
  const visualEnd = (event: Event, nextStart = end) =>
    Math.min(end, Math.max(event.end, Math.min(nextStart, event.start + MIN_EVENT_HEIGHT / PIXELS * MINUTE)));
  const first = events.length ? Math.min(...events.map(event => event.start)) : start + 7 * 60 * MINUTE;
  const last = events.length ? Math.max(...events.map(event => visualEnd(event))) : start + 15 * 60 * MINUTE;
  const viewStart = fullDay ? start : events.length
    ? Math.max(start, start + Math.floor(((first - start) / MINUTE - 30) / 60) * 60 * MINUTE)
    : Math.min(end - 60 * MINUTE, first);
  const viewEnd = fullDay ? end : events.length
    ? Math.min(end, start + Math.ceil(((last - start) / MINUTE + 30) / 60) * 60 * MINUTE)
    : Math.min(end, last);
  const minutes = (viewEnd - viewStart) / MINUTE;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (first - viewStart) / MINUTE * PIXELS - 60);
  }, [briefing.id, date, first, viewStart]);
  useEffect(() => {
    if (focusKey === null) return;
    const block = Array.from(scrollRef.current?.querySelectorAll<HTMLButtonElement>("[data-briefing-item-key]") ?? [])
      .find(button => button.dataset.briefingItemKey === focusKey);
    if (block) {
      block.focus({ preventScroll: true });
      block.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      setFocusKey(null);
    }
  }, [focusKey, date, items, now]);
  const holder = directoryMembers.find(member => member.amh_user_id === briefing.mobile_holder_user_id)
    ?? known.find(member => member.amh_user_id === briefing.mobile_holder_user_id);
  const ticks = Array.from({ length: Math.ceil(minutes / 60) }, (_, index) => viewStart + index * 60 * MINUTE);
  return <div className="briefing-calendar">
    <div className="briefing-calendar__toolbar">
      <label>Date<input aria-label="Calendar date" type="date" required value={date} onChange={event => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setDate(event.target.value);
      }} /></label>
      <label className="briefing-calendar__full-day"><input type="checkbox" checked={fullDay} onChange={event => setFullDay(event.target.checked)} />Show 24 hours</label>
      <span><Smartphone size={15} aria-hidden="true" /> Phone: {holder?.display_name ?? (briefing.mobile_holder_user_id ? "Name unavailable" : "Unassigned")}</span>
      <button type="button" disabled={disabled} onClick={() => onOpen(briefing.id)}>Open briefing #{briefing.id}</button>
    </div>
    {!columns.length ? <div className="briefing-calendar__empty">This briefing has no participants yet. Open it to set up the team.</div> :
      <div ref={scrollRef} className="briefing-calendar__viewport" tabIndex={0} role="region" aria-label="Schedule by participant and time">
        <div className="briefing-calendar__table" style={{ gridTemplateColumns: `72px ${columns.map(column => `minmax(${Math.max(220, column.lanes * 142)}px, ${column.lanes}fr)`).join(" ")}` }}>
          <div className="briefing-calendar__corner">Time</div>
          {columns.map(({ member }) => <div className="briefing-calendar__person" key={member.amh_user_id}>
            <strong>{member.display_name}</strong>
            {briefing.mobile_holder_user_id === member.amh_user_id && <span aria-label="Maintenance phone" title="Maintenance phone"><Smartphone size={13} aria-hidden="true" /></span>}
          </div>)}
          <div className="briefing-calendar__hours" style={{ height: minutes * PIXELS }}>
            {ticks.map(stamp => <time key={stamp} style={{ top: (stamp - viewStart) / MINUTE * PIXELS }}>{time(stamp)}</time>)}
          </div>
          {columns.map(({ member, events }) => <div className="briefing-calendar__column" key={member.amh_user_id} style={{ height: minutes * PIXELS }}>
            {events.map((event, index) => {
              const { item, span } = event;
              const status = item.execution?.completed_at ? "Completed" : span.actual
                ? item.execution?.running_since ? "In progress" : "Paused" : "";
              const period = span.actual && !item.execution?.completed_at
                ? `${time(span.start)} · ${status}` : `${time(span.start)}–${time(span.end)}`;
              const name = `${labels[item.source_type]} · ${item.title} · ${period} · ${member.display_name}`;
              const height = (visualEnd(event, events[index + 1]?.start) - event.start) / MINUTE * PIXELS;
              const showControls = height >= 27;
              return <div key={taskKey(item, event.index)}
                className={`briefing-calendar__block briefing-calendar__event--${item.source_type}${height < 22 ? " briefing-calendar__block--short" : ""}${item.execution?.completed_at ? " is-completed" : ""}`}
                style={{ top: (event.start - viewStart) / MINUTE * PIXELS, height, left: `calc(${event.lane / event.lanes * 100}% + 3px)`, width: `calc(${100 / event.lanes}% - 6px)` }}>
                <button type="button" disabled={disabled} className="briefing-calendar__open-event"
                  data-briefing-item-index={event.index} data-briefing-item-key={taskKey(item, event.index)}
                  aria-label={name} title={`${name}\n${item.device_name ?? ""}${event.lanes > 1 ? " · Overlapping work" : ""}`}
                  onClick={() => setInspectedKey(taskKey(item, event.index))}>
                  <strong>{labels[item.source_type]} · {item.title.split(" · ")[0]}</strong>
                  <small>{period} · {item.device_name}{item.execution?.completed_at ? " · Completed" : ""}</small>
                  {span.start < start && <small>Continued from the previous day</small>}
                  {span.end > end && <small>Continues on the next day</small>}
                </button>
                {showControls && taskExecution(item, event.index, "event")}
              </div>;
            })}
          </div>)}
        </div>
      </div>}
    {events.length === 0 && columns.length > 0 && <p className="briefing-calendar__hint">No assigned work is scheduled for this day.</p>}
    {outside > 0 && <p className="briefing-calendar__hint">{outside} items are scheduled for other dates. Change the calendar date to see them.</p>}
    {catalog?.loading && <p role="status">Loading tasks with a target date…</p>}
    {catalog?.error && <p role="alert">Could not load tasks with a target date: {catalog.error}</p>}
    {pending.length > 0 && <section className="briefing-calendar__pending" aria-label="Unscheduled or unassigned work">
      <h3>Unscheduled or unassigned <span>({pending.length})</span></h3>
      <div className="briefing-calendar__pending-grid">
        {pending.map(({ item, index, reason }) => <article className={`briefing-calendar__pending-card${item.execution?.completed_at ? " is-completed" : ""}`} key={taskKey(item, index)}>
          <button className="briefing-calendar__pending-details" type="button" disabled={disabled}
            onClick={() => setInspectedKey(taskKey(item, index))}>
            <strong>{labels[item.source_type]} · {item.title.split(" · ")[0]}</strong><span>{item.device_name} · {reason}</span>
            {item.target_day && <small>Target date: {item.target_day.split("-").reverse().join("/")}</small>}
            <small>{known.find(member => member.amh_user_id === item.responsible_user_id)?.display_name ?? "Unassigned"}{item.estimated_duration_minutes ? ` · ${item.estimated_duration_minutes} min` : ""}</small>
          </button>
          {taskExecution(item, index)}
        </article>)}
      </div>
    </section>}
    {inspected && <BriefingWorkDetail item={inspected} members={[...known, ...directoryMembers]} onClose={() => setInspectedKey(null)}
      executionControls={taskExecution(inspected, inspectedIndex, "detail")}
      onOpenBriefing={() => { setInspectedKey(null); onOpen(briefing.id); }} />}
  </div>;
}
