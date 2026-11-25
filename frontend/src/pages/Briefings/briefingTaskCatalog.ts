import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { CalendarWorkItem } from "./BriefingTaskExecution";
import { taskDuration } from "./taskDuration";

const BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
const madridDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });

export function targetDay(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) ? madridDay.format(stamp) : "";
}

export type CatalogTask = { item: CalendarWorkItem; record: Record<string, unknown> };

function normalizeTask(record: Record<string, unknown>): CatalogTask | null {
  const id = record.scheduled_task_id;
  if ((typeof id !== "number" && typeof id !== "string") || !String(id).trim()) return null;
  const code = String(record.task_code || id);
  const description = String(record.description || "No description");
  return { record, item: {
    source_type: "task", source_id: String(id),
    title: `${code} · ${description}`.slice(0, 2000),
    mysim_device_id: typeof record.device_id === "number" ? record.device_id : null,
    device_name: String(record.device_name || record.device || "No device").slice(0, 300),
    responsible_user_id: null, ...taskDuration("task", record), planned_start: null,
    target_day: targetDay(record.planned_date) || null,
    is_critical: false, discussion_notes: "", agreed_action: "",
  } };
}

export function useBriefingTaskCatalog(revision: number) {
  const [tasks, setTasks] = useState<CatalogTask[]>([]);
  const [result, setResult] = useState<{ revision: number; error: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const response = await apiFetch(BASE + "/api/tasks/upcoming?days=31", { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid response");
        if (abort.signal.aborted) return;
        const byId = new Map<string, CatalogTask>();
        for (const row of data) {
          const entry = row && typeof row === "object" ? normalizeTask(row) : null;
          if (entry?.item.source_id) byId.set(entry.item.source_id, entry);
        }
        setTasks([...byId.values()]);
        setResult({ revision, error: "" });
      } catch (failure) {
        if (!abort.signal.aborted) {
          setResult({ revision, error: failure instanceof Error ? failure.message : "Could not load tasks" });
        }
      }
    }
    void load();
    return () => abort.abort();
  }, [revision]);
  const loading = result?.revision !== revision;
  return { tasks, loading, error: loading ? "" : result?.error ?? "" };
}
