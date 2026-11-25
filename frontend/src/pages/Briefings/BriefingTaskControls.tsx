import { useState } from "react";
import { BriefingTaskExecution } from "./BriefingTaskExecution";
import type { CalendarWorkItem, TaskExecution } from "./BriefingTaskExecution";
import type { Member } from "./BriefingWork";

export type TaskOperations = {
  briefingId: number;
  participants: Member[];
  canEdit: boolean;
  canAssign: boolean;
  disabled: boolean;
  saveTask: (item: CalendarWorkItem, responsible?: string | null) => Promise<void>;
  onExecution: (sourceId: string, execution: TaskExecution) => void;
};

export function BriefingTaskControls({ item, saved, operations, view = "card", onRequestClose }: {
  item: CalendarWorkItem;
  saved?: CalendarWorkItem;
  onRequestClose?: () => void;
  operations: TaskOperations;
  view?: "card" | "detail" | "event" | "target";
}) {
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const sourceId = item.source_id;
  if (item.source_type !== "task" || !sourceId) return null;
  const assignment = saved?.responsible_user_id ?? item.responsible_user_id ?? "";
  const disabled = operations.disabled || assigning;
  async function assign(responsible: string) {
    setAssigning(true);
    setError("");
    try {
      await operations.saveTask(item, responsible || null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the assignee.");
    } finally {
      setAssigning(false);
    }
  }

  return <div className="briefing-task-controls">
    {view !== "event" && operations.canAssign && operations.participants.length > 0 && <label>
      Assignee <select aria-label={`Assignee for ${item.title}`} value={assignment}
        disabled={disabled} onChange={event => void assign(event.target.value)}>
        <option value="">Unassigned</option>
        {operations.participants.map(person => <option key={person.amh_user_id} value={person.amh_user_id}>{person.display_name}</option>)}
      </select>
    </label>}
    <BriefingTaskExecution briefingId={operations.briefingId} sourceId={sourceId}
      participants={operations.participants} assignedId={assignment}
      execution={saved?.execution ?? item.execution ?? null}
      canEdit={operations.canEdit && (!!saved || operations.canAssign)} disabled={disabled}
      onRequestClose={onRequestClose}
      showDates={view === "detail" || view === "target"} compact={view === "event"}
      beforeChange={!saved || (!!item.target_day && item.target_day !== saved.target_day)
        ? () => operations.saveTask(item) : undefined}
      onChange={execution => operations.onExecution(sourceId, execution)} />
    {error && <p role="alert" className="briefing-task-execution__error">{error}</p>}
  </div>;
}
