import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, FileWarning, ListChecks, CalendarClock, X } from "lucide-react";
import { apiFetch } from "../../api/client";
import { taskDuration } from "./taskDuration";
import "./BriefingWork.css";

export type Member = { amh_user_id: string; display_name: string };
export type WorkItem = {
    source_type: "job" | "dr" | "action" | "task" | "manual";
    source_id: string | null;
    title: string;
    mysim_device_id: number | null;
    device_name: string | null;
    responsible_user_id: string | null;
    estimated_duration_minutes: number | null;
    duration_reference: string;
    planned_start: string | null;
    is_critical: boolean;
    discussion_notes: string;
    agreed_action: string;
};
type Candidate = WorkItem & { category: string; date: string | null };
type Row = Record<string, unknown>;
const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
const sources = [
    { type: "job", label: "Jobs", path: "/api/jobs/open", date: "target_date", id: "id", title: "job_number", description: "description" },
    { type: "dr", label: "DRs", path: "/api/drs/open", date: "reported_date", id: "id", title: "dr_id", description: "fault_description" },
    { type: "action", label: "Actions", path: "/api/actions/open", date: "date", id: "id", title: "action_id", description: "description" },
    { type: "task", label: "Tasks", path: "/api/tasks/upcoming?days=7", date: "planned_date", id: "scheduled_task_id", title: "task_code", description: "description" },
] as const;
const categories: Record<string, string> = {
    all: "All", out_of_tolerance: "Out of tolerance", backlog: "Backlog",
    today: "Today", upcoming: "Upcoming", unknown_tolerance: "Unknown tolerance", undated: "No date",
};
function day(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(date);
}
function normalize(row: Row, source: typeof sources[number]): Candidate | null {
    const id = row[source.id];
    if (id === null || id === undefined || String(id).trim() === "") return null;
    const date = typeof row[source.date] === "string" ? row[source.date] as string : null;
    const today = day(new Date().toISOString());
    const dateDay = date ? day(date) : "";
    const category = source.type === "task" ? String(row.planning_category ?? "unknown_tolerance")
        : !dateDay ? "undated" : dateDay < today ? "backlog" : dateDay === today ? "today" : "upcoming";
    return {
        source_type: source.type, source_id: String(id),
        title: `${row[source.title] || id} · ${row[source.description] || row.customer_description || "No description"}`.slice(0, 2000),
        mysim_device_id: typeof row.device_id === "number" ? row.device_id : null,
        device_name: String(row.device_name || row.device || "No device"),
        responsible_user_id: null, ...taskDuration(source.type, row), planned_start: null,
        is_critical: false, discussion_notes: "", agreed_action: "", category, date,
    };
}
function key(item: WorkItem) { return `${item.source_type}:${item.source_id}`; }
function toItem(candidate: Candidate): WorkItem {
    const { category: _category, date: _date, ...item } = candidate;
    void _category; void _date;
    return item;
}

function localInput(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const pad = (number: number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function endTime(item: WorkItem): number | null {
    if (!item.planned_start || !item.estimated_duration_minutes) return null;
    const start = Date.parse(item.planned_start);
    return Number.isFinite(start) ? start + item.estimated_duration_minutes * 60000 : null;
}

function overlap(item: WorkItem, items: WorkItem[]): boolean {
    const end = endTime(item);
    if (end === null || !item.responsible_user_id) return false;
    const start = Date.parse(item.planned_start!);
    return items.some(other => {
        if (other === item || other.responsible_user_id !== item.responsible_user_id) return false;
        const otherEnd = endTime(other);
        return otherEnd !== null && start < otherEnd && Date.parse(other.planned_start!) < end;
    });
}

type SourceType = typeof sources[number]["type"];
const sourceIcons = { job: BriefcaseBusiness, dr: FileWarning, action: ListChecks, task: CalendarClock };

export function BriefingWork({ items, members, disabled, onChange }: {
    items: WorkItem[]; members: Member[]; disabled: boolean; onChange: (items: WorkItem[]) => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [activeSource, setActiveSource] = useState<SourceType | null>(null);
    const [catalog, setCatalog] = useState<Candidate[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [reload, setReload] = useState(0);
    const [devicesFilter, setDevicesFilter] = useState<string[]>([]);
    const [category, setCategory] = useState("all");
    const [assignee, setAssignee] = useState("");
    const [updated, setUpdated] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            const results = await Promise.allSettled(sources.map(async source => {
                const response = await apiFetch(BASE + source.path, { signal: controller.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const rows: unknown = await response.json();
                if (!Array.isArray(rows)) throw new Error("Invalid response");
                return rows.map(row => normalize(row, source)).filter((row): row is Candidate => row !== null);
            }));
            if (controller.signal.aborted) return;
            const next: Candidate[] = []; const failures: Record<string, string> = {};
            results.forEach((result, index) => {
                if (result.status === "fulfilled") next.push(...result.value);
                else failures[sources[index].type] = String(result.reason);
            });
            setCatalog(next); setErrors(failures); setLoading(false);
            setUpdated(new Date().toLocaleTimeString("en-GB"));
        }
        void load();
        return () => controller.abort();
    }, [reload]);
    useEffect(() => {
        if (activeSource && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    }, [activeSource]);
    function openSource(type: SourceType) {
        setDevicesFilter([]); setCategory("all"); setAssignee(""); setActiveSource(type);
    }
    function closeSource() { dialogRef.current?.close(); setActiveSource(null); }
    const deviceKey = (item: WorkItem) => item.mysim_device_id !== null ? `id:${item.mysim_device_id}` : `name:${item.device_name}`;
    const devices = new Map([...catalog, ...items].map(item => [deviceKey(item), item.device_name || "No device"]));
    const durationSuggestions = new Map(catalog.filter(item => item.estimated_duration_minutes !== null)
        .map(item => [key(item), item]));
    function selected(item: WorkItem) { return items.find(saved => key(saved) === key(item)); }
    function update(item: WorkItem, patch: Partial<WorkItem>) {
        const existing = selected(item);
        onChange(existing ? items.map(saved => key(saved) === key(item) ? { ...saved, ...patch } : saved)
            : [...items, { ...item, ...patch }]);
    }
    function updateIncluded(index: number, patch: Partial<WorkItem>) {
        onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
    }
    const filtered = catalog.filter(item => (!devicesFilter.length || devicesFilter.includes(deviceKey(item)))
        && (category === "all" || item.category === category)
        && (!assignee || (assignee === "unassigned" ? !selected(item)?.responsible_user_id
            : selected(item)?.responsible_user_id === assignee)));
    const active = sources.find(source => source.type === activeSource);
    const activeRows = filtered.filter(item => item.source_type === activeSource);

    return <section aria-label="Shift work" className="briefing-work">
        <div className="briefing-work__heading">
            <h3>Shift work</h3>
            <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>{loading ? "Loading…" : "Refresh"}</button>
        </div>
        <p className="briefing-work__hint">{disabled ? "Select a card to view and filter records." : "Add work and assign it to shift participants."} Last refreshed: {updated || "Pending"}.</p>
        {!disabled && !members.length && <p className="briefing-work__hint">Select shift participants to assign work. You can also add work without assigning it.</p>}
        <div className="briefing-work-grid">{sources.map(source => {
            const rows = catalog.filter(item => item.source_type === source.type);
            const Icon = sourceIcons[source.type];
            const included = items.filter(item => item.source_type === source.type).length;
            return <button key={source.type} type="button" className="briefing-work-card" aria-haspopup="dialog"
                aria-label={`View ${source.label}, ${rows.length} records`} onClick={() => openSource(source.type)}>
                <span className="briefing-work-card__header">
                    <span className="briefing-work-card__name">{source.label}</span>
                    <span className="briefing-work-card__count">{rows.length}</span>
                </span>
                <span className="briefing-work-card__summary">
                    {(source.type === "task" ? ["out_of_tolerance", "backlog", "today", "upcoming"] : ["backlog", "today", "upcoming"]).map(status => (
                        <span key={status} className={`briefing-work-card__row briefing-work-card__row--${status}`}>
                            <span className="briefing-work-card__dot" />
                            <strong>{rows.filter(item => item.category === status).length}</strong>
                            <span>{categories[status]}</span>
                        </span>
                    ))}
                </span>
                <span className="briefing-work-card__foot">{loading ? "Loading…" : errors[source.type] ? "Loading failed · view details" : included ? `${included} included in the briefing` : "View records"}</span>
                <Icon className="briefing-work-card__icon" aria-hidden="true" />
            </button>;
        })}</div>

        {items.length > 0 && <section className="briefing-work-selected" aria-label="Included items">
            <div className="briefing-work__heading"><h3>Included items ({items.length})</h3></div>
            {items.map((item, index) => {
                const suggestion = durationSuggestions.get(key(item));
                return <article className="briefing-selected" key={`${key(item)}:${index}`}>
                    <div className="briefing-selected__heading"><strong>{item.source_type.toUpperCase()} · {item.title}</strong>
                        <button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, i) => i !== index))}>Remove item {index + 1}</button>
                    </div>
                    <p>{item.device_name}</p>
                    <label>Assignee for item {index + 1}<select disabled={disabled || !members.length} value={item.responsible_user_id || ""}
                        onChange={e => onChange(items.map((row, i) => i === index ? { ...row, responsible_user_id: e.target.value || null } : row))}>
                        <option value="">Unassigned</option>
                        {item.responsible_user_id && !members.some(m => m.amh_user_id === item.responsible_user_id) && <option value={item.responsible_user_id}>Saved assignee ({item.responsible_user_id})</option>}
                        {members.map(m => <option key={m.amh_user_id} value={m.amh_user_id}>{m.display_name}</option>)}
                    </select></label>
                    <div className="briefing-work-planning">
                        <label>Estimated duration (min) for item {index + 1}
                            <input type="number" min={1} max={10080} step={1} disabled={disabled}
                                value={item.estimated_duration_minutes ?? ""}
                                onChange={e => {
                                    const minutes = e.target.value === "" ? null : Number(e.target.value);
                                    const automaticReference = item.duration_reference?.startsWith("MPFSTDO · ") ||
                                        item.duration_reference === "mySim · estimatedTime";
                                    updateIncluded(index, {
                                        estimated_duration_minutes: minutes,
                                        duration_reference: automaticReference && minutes !== item.estimated_duration_minutes
                                            ? "" : item.duration_reference,
                                    });
                                }} />
                        </label>
                        <label>Planned start for item {index + 1}
                            <input type="datetime-local" disabled={disabled} value={localInput(item.planned_start)}
                                onChange={e => {
                                    const date = new Date(e.target.value);
                                    if (!e.target.value || Number.isFinite(date.getTime())) {
                                        updateIncluded(index, { planned_start: e.target.value ? date.toISOString() : null });
                                    }
                                }} />
                        </label>
                        <label>Duration reference for item {index + 1}
                            <input disabled={disabled} maxLength={500} value={item.duration_reference ?? ""}
                                placeholder="Document, revision and task code, or manual estimate"
                                onChange={e => updateIncluded(index, { duration_reference: e.target.value })} />
                        </label>
                    </div>
                    {!disabled && item.estimated_duration_minutes == null && suggestion && <button type="button"
                                onClick={() => updateIncluded(index, {
                                    estimated_duration_minutes: suggestion.estimated_duration_minutes,
                                    duration_reference: suggestion.duration_reference,
                                })}>Use suggested duration ({suggestion.estimated_duration_minutes} min)</button>}
                    <p className="briefing-work__hint">{endTime(item) !== null
                        ? `Planned end: ${new Date(endTime(item)!).toLocaleString("en-GB")}`
                        : item.planned_start ? "Enter an estimated duration to calculate the planned end."
                        : "Unscheduled. Duration and start time are optional."}</p>
                    {overlap(item, items) && <p role="status" className="briefing-work__warning">This overlaps with another item assigned to the same person in this briefing.</p>}
                    <details><summary>Notes and agreed action</summary>
                        <label className="briefing-work-check"><input type="checkbox" disabled={disabled} checked={item.is_critical} onChange={e => onChange(items.map((row, i) => i === index ? { ...row, is_critical: e.target.checked } : row))} />Critical</label>
                        <div className="briefing-work-notes">
                            <label>Notes for item {index + 1}<textarea disabled={disabled} maxLength={20000} value={item.discussion_notes} onChange={e => onChange(items.map((row, i) => i === index ? { ...row, discussion_notes: e.target.value } : row))} /></label>
                            <label>Agreed action for item {index + 1}<textarea disabled={disabled} maxLength={20000} value={item.agreed_action} onChange={e => onChange(items.map((row, i) => i === index ? { ...row, agreed_action: e.target.value } : row))} /></label>
                        </div>
                    </details>
                </article>;
            })}
        </section>}

        {items.length > 0 && <p className="briefing-work__hint">Briefing times use your device's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). You can adjust the suggested duration or enter your own estimate.</p>}

        {active && <dialog ref={dialogRef} className="briefing-work-dialog" aria-labelledby="briefing-work-dialog-title"
            onCancel={event => { event.preventDefault(); event.stopPropagation(); closeSource(); }}
            onClick={event => {
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSource();
            }}>
            <header className="briefing-work-dialog__header">
                <div><h2 id="briefing-work-dialog-title">{active.label}</h2><p>{activeRows.length} records match the current filters</p></div>
                <button type="button" className="briefing-work-dialog__close" aria-label={`Close details for ${active.label}`} onClick={closeSource}><X size={22} /></button>
            </header>
            <div className="briefing-work-dialog__body">
                <div className="briefing-work-filters">
                    <label>Devices<select multiple size={3} value={devicesFilter} onChange={e => setDevicesFilter(Array.from(e.target.selectedOptions, option => option.value))}>
                        {[...devices].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select></label>
                    <label>Status<select value={category} onChange={e => setCategory(e.target.value)}>
                        {Object.entries(categories).filter(([id]) => activeSource === "task" || !["out_of_tolerance", "unknown_tolerance"].includes(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                    </select></label>
                    <label>Assignment<select value={assignee} onChange={e => setAssignee(e.target.value)}><option value="">All</option><option value="unassigned">Unassigned</option>{members.map(m => <option key={m.amh_user_id} value={m.amh_user_id}>{m.display_name}</option>)}</select></label>
                </div>
                <p className="briefing-work__hint">Latest available mySim data. Actions and Tasks cover the next 7 days and earlier pending work. Clear the device filter to show all devices.</p>
                <p className="briefing-work__hint">{activeSource === "task" ? "Task status uses the task tolerance window." : activeSource === "dr" ? "DR status uses the report date. Backlog indicates an earlier report date." : activeSource === "job" ? "Job status uses the target date." : "Action status uses the action date."}</p>
                {loading && <p role="status">Loading {active.label}…</p>}
                {errors[active.type] && <p role="alert" className="briefing-work__error">Could not load {active.label}: {errors[active.type]}</p>}
                {!loading && !errors[active.type] && activeRows.length === 0 && <p className="briefing-work__empty">No records match these filters.</p>}
                <ul className="briefing-work-results">{activeRows.map(candidate => {
                    const item = toItem(candidate); const included = selected(item);
                    return <li key={key(item)}>
                        <div className="briefing-work-result__info"><strong>{item.title}</strong><p>{item.device_name}</p>
                            <span className={`briefing-work-status briefing-work-status--${candidate.category}`}>{categories[candidate.category] || candidate.category}</span>
                            {item.estimated_duration_minutes !== null &&
                                <p title={item.duration_reference}>{item.estimated_duration_minutes} min estimated</p>}
                            {candidate.date && <time>{new Date(candidate.date).toLocaleString("en-GB")}</time>}
                        </div>
                        <div className="briefing-work-result__actions">
                            <button type="button" disabled={disabled || !!included} onClick={() => onChange([...items, item])}>{included ? "Included" : "Add to briefing"}</button>
                            <label>Assignee for {item.title}<select disabled={disabled || !members.length} value={included?.responsible_user_id || ""}
                                onChange={e => update(item, { responsible_user_id: e.target.value || null })}>
                                <option value="">Unassigned</option>
                                {members.map(m => <option key={m.amh_user_id} value={m.amh_user_id}>{m.display_name}</option>)}
                            </select></label>
                        </div>
                    </li>;
                })}</ul>
            </div>
            <footer className="briefing-work-dialog__footer"><span>{disabled ? "Browse records" : "Changes are stored when you save the briefing."}</span><button type="button" onClick={closeSource}>Back to briefing</button></footer>
        </dialog>}
    </section>;
}
