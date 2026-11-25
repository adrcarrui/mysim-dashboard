import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { apiFetch } from "../../api/client";
import type { Member, WorkItem } from "./BriefingWork";
import "./BriefingWorkDetail.css";

const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
const types = { job: "Job", dr: "DR", action: "Action", task: "Task", manual: "Manual item" };
const fields: Record<string, string> = {
  id: "mySim ID", job_number: "Job number", dr_id: "DR number", action_id: "Action number",
  scheduled_task_id: "Scheduled task ID", maintenance_task_id: "Maintenance task ID",
  schedule_code: "Schedule code", task_code: "Task code", alias: "Alias",
  description: "Description", fault_description: "Fault description", customer_description: "Customer description",
  target_date: "Target date", reported_date: "Reported date", closing_date: "Closing date", date: "Date",
  device_id: "Device ID", device_name: "Device", device: "Device", priority: "Priority",
  priority_id: "Priority ID", status: "Status", status_id: "Status ID", severity_id: "Severity ID",
  assigned_to: "Assigned to in mySim", assigned_to_id: "mySim assignee ID", detected_by_id: "Detected by ID",
  performed_by: "Performed by", performed_by_id: "Performed by ID", repetitions: "Repetitions",
  related_maintenance_task_id: "Related maintenance task ID", manufacturer_id_number: "Manufacturer reference",
  ata: "ATA", close_remarks: "Closing remarks", root_cause_analysis: "Root cause analysis",
  not_our: "Not ours", affected_system_id: "Affected system ID", last_updated: "Last updated",
  shift_to_be_done_id: "Planned shift ID", shift_to_be_done: "Planned shift", days_remaining: "Days remaining",
  urgency: "Urgency", preventive_manual_version: "Preventive manual version", frequency_id: "Frequency ID",
  estimated_duration_minutes: "Estimated duration",
  duration_reference: "Duration reference",
  frequency: "Frequency", frequency_num_of_days: "Frequency in days", planned_date: "mySim planned date",
  tolerance_start: "Tolerance start", tolerance_end: "Tolerance end", tolerance_status: "Tolerance status",
  planning_category: "Planning category", unknown_tolerance_reason: "Unknown tolerance reason", remarks: "Remarks",
  done_at: "Completion date", performance_remarks: "Performance remarks",
};
const dateFields = new Set(["target_date", "reported_date", "closing_date", "date", "last_updated", "planned_date", "tolerance_start", "tolerance_end", "done_at"]);
const textFields = new Set(["description", "fault_description", "customer_description", "close_remarks", "root_cause_analysis", "remarks", "performance_remarks"]);
function formatted(value: unknown, name?: string): string {
  if (value === null || value === undefined || value === "") return "No data";
  if (name === "estimated_duration_minutes") return `${value} min`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (name && dateFields.has(name) && typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toLocaleString("en-GB");
  }
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}
function sourcePath(type: WorkItem["source_type"]): string {
  if (type === "job") return "/api/jobs/open";
  if (type === "dr") return "/api/drs/open";
  if (type === "task") return "/api/tasks/upcoming?days=31";
  return "/api/actions/open";
}

export function BriefingWorkDetail({ item, members, onClose, onOpenBriefing, showBriefingPlan = true, sourceRecord, executionControls }: {
  executionControls?: ReactNode;
  item: WorkItem; members: Member[]; onClose: () => void; onOpenBriefing?: () => void; showBriefingPlan?: boolean; sourceRecord?: Record<string, unknown>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState<Record<string, unknown> | null>(sourceRecord ?? null);
  const [loading, setLoading] = useState(!sourceRecord && item.source_type !== "manual");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { source_type: sourceType, source_id: sourceId } = item;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  useEffect(() => {
    if (sourceRecord) { setRecord(sourceRecord); setLoading(false); setError(""); return; }
    if (sourceType === "manual") return;
    const controller = new AbortController();
    setLoading(true); setError(""); setRecord(null);
    async function load() {
      try {
        const response = await apiFetch(BASE + sourcePath(sourceType), { signal: controller.signal, cache: "no-store" });
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`Unable to load the record (HTTP ${response.status}).`);
        if (!Array.isArray(data)) throw new Error("The server did not return a valid list.");
        const idField = sourceType === "task" ? "scheduled_task_id" : "id";
        const found = data.find(row => row && typeof row === "object" && String(row[idField]) === sourceId);
        if (!controller.signal.aborted) {
          if (found) setRecord(found);
          else setError(showBriefingPlan
            ? "This record no longer appears in the current query for open or pending work. The information saved in the briefing is shown below."
            : "This record no longer appears in the current query for open or pending work. The selected work summary is shown below.");
        }
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [sourceType, sourceId, attempt, showBriefingPlan, sourceRecord]);
  const owner = members.find(member => member.amh_user_id === item.responsible_user_id)?.display_name;
  const informationTitle = item.source_type === "task" ? "Task information" : "mySim information";
  const entries = Object.entries(record ?? {});
  const fieldLabel = (key: string) => item.source_type === "action" && key === "performed_by" ? "Opened by"
    : item.source_type === "action" && key === "performed_by_id" ? "Opened by ID"
    : fields[key] ?? key.replaceAll("_", " ");
  const start = item.planned_start ? Date.parse(item.planned_start) : NaN;
  const end = Number.isFinite(start) && item.estimated_duration_minutes ? start + item.estimated_duration_minutes * 60000 : NaN;
  return <dialog ref={ref} className="briefing-work-detail" aria-labelledby="briefing-work-detail-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="briefing-work-detail__header">
      <div><span>{types[item.source_type]} · {item.device_name || "No device"}</span><h2 id="briefing-work-detail-title">{item.title.split(" · ")[0]}</h2></div>
      <button type="button" aria-label="Close work details" onClick={onClose}><X size={20} /></button>
    </header>
    <div className="briefing-work-detail__body">
      {executionControls && <section aria-label="Task execution">
        <h3>Execution</h3>
        {executionControls}
      </section>}
      {loading && <p role="status">Loading {types[item.source_type]} details…</p>}
      {error && <div role="alert" className="briefing-work-detail__error"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
      {record && <section aria-label={informationTitle}>
        <h3>{informationTitle}</h3>
        <dl className="briefing-work-detail__fields">{entries.filter(([key]) => !textFields.has(key)).map(([key, value]) =>
          <div key={key}><dt>{fieldLabel(key)}</dt><dd>{formatted(value, key)}</dd></div>)}</dl>
        {entries.filter(([key]) => textFields.has(key)).map(([key, value]) => <div className={`briefing-work-detail__text${key.endsWith("description") ? " briefing-work-detail__text--description" : ""}`} key={key}><h4>{fields[key]}</h4><p>{formatted(value)}</p></div>)}
        {item.source_type !== "task" && <p className="briefing-work-detail__muted">Information available through the app, using cached mySim data.</p>}
      </section>}
      {!showBriefingPlan && !record && <div className="briefing-work-detail__text briefing-work-detail__text--description"><h4>Selected work</h4><p>{item.title}</p></div>}
      {showBriefingPlan && <section aria-label="Briefing plan">
        <h3>Briefing plan</h3>
        <dl className="briefing-work-detail__fields">
          <div><dt>Shift assignee</dt><dd>{owner ?? (item.responsible_user_id ? "Name unavailable" : "Unassigned")}</dd></div>
          <div><dt>Estimated duration</dt><dd>{item.estimated_duration_minutes ? `${item.estimated_duration_minutes} min` : "Not specified"}</dd></div>
          <div><dt>Planned start</dt><dd>{Number.isFinite(start) ? new Date(start).toLocaleString("en-GB") : "Not scheduled"}</dd></div>
          <div><dt>Planned end</dt><dd>{Number.isFinite(end) ? new Date(end).toLocaleString("en-GB") : "Not scheduled"}</dd></div>
          <div><dt>Duration reference</dt><dd>{item.duration_reference || "No reference"}</dd></div>
          <div><dt>Critical</dt><dd>{item.is_critical ? "Yes" : "No"}</dd></div>
        </dl>
        {!record && <div className="briefing-work-detail__text briefing-work-detail__text--description"><h4>Description saved in the briefing</h4><p>{item.title}</p></div>}
        <div className="briefing-work-detail__text"><h4>Briefing notes</h4><p>{item.discussion_notes || "No notes"}</p></div>
        <div className="briefing-work-detail__text"><h4>Agreed action</h4><p>{item.agreed_action || "No agreed action"}</p></div>
      </section>}
    </div>
    <footer className="briefing-work-detail__footer">{onOpenBriefing && <button type="button" onClick={onOpenBriefing}>Open briefing</button>}<button type="button" onClick={onClose}>Close</button></footer>
  </dialog>;
}
