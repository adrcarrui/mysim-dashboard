import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { apiFetch } from "../../api/client";
import { briefingErrorMessage } from "./briefingErrorMessage";
import type { Member, WorkItem } from "./BriefingWork";

export type TaskExecution = {
  version: number;
  started_at: string | null;
  started_by?: string | null;
  running_since: string | null;
  completed_at: string | null;
  active_seconds: number | null;
  performers?: { id: string; name: string }[];
};

export type CalendarWorkItem = WorkItem & { target_day?: string | null; execution?: TaskExecution | null };
type Action = "start" | "pause" | "complete";
const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

function elapsedLabel(seconds: number) {
  const total = Math.floor(seconds);
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Madrid",
});

export function BriefingTaskExecution({
  briefingId, sourceId, execution, canEdit, disabled, showDates, compact = false, onChange, beforeChange, participants = [], assignedId, onRequestClose,
}: {
  briefingId: number;
  sourceId: string;
  execution: TaskExecution | null;
  canEdit: boolean;
  disabled: boolean;
  showDates?: boolean;
  compact?: boolean;
  participants?: Member[];
  assignedId?: string | null;
  onRequestClose?: () => void;
  beforeChange?: () => Promise<void>;
  onChange: (execution: TaskExecution) => void;
}) {
  const [performerIds, setPerformerIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const running = execution?.running_since;
  const completed = execution?.completed_at;
  const started = execution?.started_at;
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running]);

  const activeSeconds = execution?.active_seconds;
  const live = running ? Math.max(0, (now - Date.parse(running)) / 1000) : 0;
  const elapsed = activeSeconds == null ? null : elapsedLabel(activeSeconds + live);
  const actionLabel = running ? "Pause" : started ? "Resume" : "Start";

  function requestCompletion() {
    if (onRequestClose && participants.length > 0) {
      onRequestClose();
      return;
    }
    if (participants.length === 0) {
      void change("complete");
      return;
    }
    setPerformerIds(assignedId && participants.some(person => person.amh_user_id === assignedId) ? [assignedId] : []);
  }

  async function change(action: Action) {
    if (sending.current || disabled || !canEdit) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await beforeChange?.();
      const response = await apiFetch(`${BASE}/api/briefings/${briefingId}/task-execution`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_id: sourceId, action, expected_version: execution?.version ?? 0,
          ...(action === "complete" && performerIds ? { performer_ids: performerIds } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 && data?.detail?.execution) onChange(data.detail.execution);
        const message = typeof data?.detail === "string" ? data.detail : data?.detail?.message;
        throw new Error((typeof message === "string" && message ? briefingErrorMessage(message) : null) || `Could not record task execution (HTTP ${response.status}).`);
      }
      if (!data || typeof data.version !== "number") throw new Error("The server did not confirm the update.");
      setNow(Date.now());
      setPerformerIds(null);
      onChange(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record task execution.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <div className={compact ? "briefing-task-execution is-compact" : "briefing-task-execution"}>
    {!compact && <div className="briefing-task-execution__summary">
      <span role="status">{completed ? "Completed" : running ? "In progress" : started ? "Paused" : "Not started"}</span>
      {elapsed && <span title="Active time" aria-label={`Active time ${elapsed}`}>{elapsed}</span>}
      {completed && !elapsed && <span>No time recorded</span>}
    </div>}
    {canEdit && !completed && performerIds === null && <div className="briefing-task-execution__actions">
      <button type="button" disabled={disabled || busy} aria-label={actionLabel} title={actionLabel}
        onClick={() => void change(running ? "pause" : "start")}>
        {running ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        {!compact && actionLabel}
      </button>
      <button type="button" disabled={disabled || busy} onClick={requestCompletion}
        aria-label="Mark complete" title={started ? "Mark complete" : "Mark complete without recording active time"}>
        <Check size={14} aria-hidden="true" />{!compact && "Mark complete"}
      </button>
    </div>}
    {canEdit && !completed && performerIds !== null && <div className="briefing-task-execution__performers">
      <fieldset disabled={disabled || busy}>
        <legend>Performed by</legend>
        {participants.map(person => <label key={person.amh_user_id}>
          <input type="checkbox" checked={performerIds.includes(person.amh_user_id)}
            onChange={event => setPerformerIds(ids => event.target.checked
              ? [...(ids ?? []), person.amh_user_id] : (ids ?? []).filter(id => id !== person.amh_user_id))} />
          {person.display_name}
        </label>)}
      </fieldset>
      <button type="button" disabled={disabled || busy || !performerIds.length}
        onClick={() => void change("complete")}>Confirm completion</button>
      <button type="button" disabled={busy} onClick={() => setPerformerIds(null)}>Cancel</button>
    </div>}
    {!compact && !!execution?.performers?.length && <span>Performed by {execution.performers.map(person => person.name).join(", ")}</span>}
    {showDates && (started || completed) && <dl className="briefing-task-execution__dates">
      <div><dt>Actual start</dt><dd>{started ? dateFormat.format(new Date(started)) : "Not recorded"}</dd></div>
      <div><dt>Actual end</dt><dd>{completed ? dateFormat.format(new Date(completed)) : "Pending"}</dd></div>
    </dl>}
    {error && <p role="alert" title={error} className="briefing-task-execution__error">{error}</p>}
  </div>;
}
