import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { ClipboardList, X } from "lucide-react";
import type { FormEvent } from "react";
import { apiFetch } from "../../api/client";
import { briefingErrorMessage } from "./briefingErrorMessage";
import { BriefingWork } from "./BriefingWork";
import type { WorkItem } from "./BriefingWork";
import { BriefingCalendar } from "./BriefingCalendar";
import { BriefingTargetDays } from "./BriefingTargetDays";
import { useBriefingTaskCatalog } from "./briefingTaskCatalog";
import type { TaskOperations } from "./BriefingTaskControls";
import type { CalendarWorkItem, TaskExecution } from "./BriefingTaskExecution";

import "./Briefings.css";

type TeamMember = {
  amh_user_id: string;
  display_name: string;
};

type Draft = {
  briefing_date: string;
  shift_code: string;
  mobile_holder_user_id: string | null;
  participant_ids: string[];
  items: WorkItem[];
  received_notes: string;
  general_notices: string;
  agreements: string;
  handover_notes: string;
};

type Summary = {
  id: number;
  briefing_date: string;
  shift_code: string;
  status: "draft" | "finalized";
  revision: number;
};

type Detail = Summary & Omit<Draft, "items"> & {
  items: CalendarWorkItem[];
  participants?: TeamMember[];
};

type Listing = {
  total: number;
  items: Summary[];
};

const BASE =
  `${window.location.protocol}//${window.location.hostname}:8000`;

const shifts: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  night: "Night",
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(BASE + path, {
    ...init,
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? briefingErrorMessage(data.detail)
        : `Request failed (HTTP ${response.status})`,
    );
  }

  if (data === null) {
    throw new Error(
      "The server returned an invalid response",
    );
  }

  return data as T;
}

function localDateTime(value: string): string {
  const date = new Date(value);
  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function emptyDraft(): Draft {
  return {
    briefing_date: localDateTime(
      new Date().toISOString(),
    ).slice(0, 10),
    shift_code: "",
    mobile_holder_user_id: null,
    participant_ids: [],
    items: [],
    received_notes: "",
    general_notices: "",
    agreements: "",
    handover_notes: "",
  };
}

function recentRange() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  const previous = new Date(`${today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return { today, yesterday: previous.toISOString().slice(0, 10) };
}

async function recentBriefings(signal?: AbortSignal): Promise<Listing> {
  const { today, yesterday } = recentRange();
  const items: Summary[] = [];
  let offset = 0;
  while (true) {
    const page = await request<Listing>(`/api/briefings?limit=100&offset=${offset}&from_date=${yesterday}&to_date=${today}`, { signal });
    items.push(...page.items);
    offset += page.items.length;
    if (offset >= page.total) break;
    if (!page.items.length) throw new Error("Could not load the full list of recent briefings.");
  }
  const recent = items.filter(item => item.briefing_date >= yesterday && item.briefing_date <= today);
  return { total: recent.length, items: recent };
}

function formFrom(detail: Detail): Draft {
  return {
    briefing_date: detail.briefing_date,
    shift_code: detail.shift_code,
    mobile_holder_user_id: detail.mobile_holder_user_id ?? null,
    participant_ids: detail.participant_ids
      ?? detail.participants?.map((member) => member.amh_user_id)
      ?? [],
    items: (detail.items ?? []).map(item => ({
      source_type: item.source_type,
      source_id: item.source_id,
      title: item.title,
      mysim_device_id: item.mysim_device_id,
      device_name: item.device_name,
      responsible_user_id: item.responsible_user_id,
      is_critical: item.is_critical,
      discussion_notes: item.discussion_notes,
      agreed_action: item.agreed_action,
      estimated_duration_minutes: item.estimated_duration_minutes ?? null,
      duration_reference: item.duration_reference ?? "",
      planned_start: item.planned_start ?? null,
    })),
    received_notes: detail.received_notes,
    general_notices: detail.general_notices,
    agreements: detail.agreements,
    handover_notes: detail.handover_notes,
  };
}

export function Briefings() {
  const [params] = useSearchParams();
  return params.get("view") === "kpis" ? <Navigate to="/maintenance-kpis" replace /> : <BriefingsWorkspace />;
}

function BriefingsWorkspace() {
  const [listing, setListing] = useState<Listing>({
    total: 0,
    items: [],
  });

  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [listError, setListError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [opened, setOpened] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamAttempt, setTeamAttempt] = useState(0);
  const [calendarId, setCalendarId] = useState("");
  const [workView, setWorkView] = useState<"calendar" | "target">("calendar");
  const [calendar, setCalendar] = useState<Detail | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarAttempt, setCalendarAttempt] = useState(0);
  const catalog = useBriefingTaskCatalog(calendarAttempt);
  const activeCalendarId = listing.items.some(item => String(item.id) === calendarId)
    ? calendarId : listing.items[0] ? String(listing.items[0].id) : "";

  const participantOptions = [
    ...teamMembers,
    ...(selected?.participants ?? []).filter(
      (saved) => !teamMembers.some(
        (member) => member.amh_user_id === saved.amh_user_id,
      ),
    ),
  ].sort((a, b) => a.display_name.localeCompare(b.display_name));

  const readOnly =
    !canEdit || selected?.status === "finalized";

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [me, list] = await Promise.all([
          request<{ role: string }>("/auth/me", {
            signal: controller.signal,
          }),
          recentBriefings(controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setCanEdit(
            ["editor", "admin"].includes(me.role),
          );
          setListing(list);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setListError((err as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCalendar(null);
    setCalendarError("");
    if (!activeCalendarId) { setCalendarLoading(false); return () => controller.abort(); }
    setCalendarLoading(true);
    void request<Detail>(`/api/briefings/${activeCalendarId}`, { signal: controller.signal })
      .then(detail => { if (!controller.signal.aborted) setCalendar(detail); })
      .catch(err => { if (!controller.signal.aborted) setCalendarError((err as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setCalendarLoading(false); });
    return () => controller.abort();
  }, [activeCalendarId, listing, calendarAttempt]);

  useEffect(() => {
    if (!canEdit) return;

    const controller = new AbortController();

    async function loadTeam() {
      setTeamLoading(true);
      setTeamError("");

      try {
        const data = await request<{ members: TeamMember[] }>(
          "/api/briefings/team-members",
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) {
          setTeamMembers(data.members);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setTeamError((err as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTeamLoading(false);
        }
      }
    }

    void loadTeam();

    return () => controller.abort();
  }, [canEdit, teamAttempt]);

  useEffect(() => {
    if (opened && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [opened]);

  function closeBriefing() {
    if (busy || !mayDiscard()) return;
    dialogRef.current?.close();
    setOpened(false);
    setDirty(false);
  }

  async function refreshList() {
    setBusy(true);
    setListError("");

    try {
      setListing(
        await recentBriefings(),
      );
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function mayDiscard(): boolean {
    return (
      !dirty ||
      window.confirm(
        "Discard your unsaved changes?",
      )
    );
  }

  function newBriefing() {
    if (!mayDiscard()) return;

    setSelected(null);
    setForm(emptyDraft());
    setOpened(true);
    setDirty(false);
    setError("");
    setNotice("");
  }

  async function openBriefing(id: number) {
    if (!mayDiscard()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const detail = await request<Detail>(
        `/api/briefings/${id}`,
      );

      setSelected(detail);
      setForm(formFrom(detail));
      setOpened(true);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCalendarTask(briefingId: number, item: CalendarWorkItem, responsible?: string | null) {
    const saved = await request<{ item: CalendarWorkItem; revision: number }>(`/api/briefings/${briefingId}/calendar-task`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: item.source_id, title: item.title, device_name: item.device_name,
        mysim_device_id: item.mysim_device_id, estimated_duration_minutes: item.estimated_duration_minutes,
        duration_reference: item.duration_reference, target_day: item.target_day ?? null,
        ...(responsible !== undefined ? { responsible_user_id: responsible } : {}),
      }),
    });
    setCalendar(current => {
      if (current?.id !== briefingId) return current;
      const match = (row: CalendarWorkItem) => row.source_type === "task" && row.source_id === saved.item.source_id;
      const previous = current.items.find(match);
      const next = (previous?.execution?.version ?? 0) > (saved.item.execution?.version ?? 0)
        ? { ...saved.item, execution: previous?.execution } : saved.item;
      return { ...current, revision: Math.max(current.revision, saved.revision),
        items: previous ? current.items.map(row => match(row) ? next : row) : [...current.items, next] };
    });
  }

  const operations: TaskOperations | undefined = calendar && String(calendar.id) === activeCalendarId ? {
    briefingId: calendar.id,
    participants: calendar.participants ?? [],
    canEdit,
    canAssign: canEdit && calendar.status === "draft",
    disabled: busy || calendarLoading,
    saveTask: (item, responsible) => saveCalendarTask(calendar.id, item, responsible),
    onExecution: (sourceId, execution) => updateCalendarExecution(calendar.id, sourceId, execution),
  } : undefined;

  function updateCalendarExecution(briefingId: number, sourceId: string, execution: TaskExecution) {
    setCalendar(current => {
      if (current?.id !== briefingId) return current;
      return {
        ...current,
        items: current.items.map(item =>
          item.source_type === "task" && item.source_id === sourceId &&
          execution.version >= (item.execution?.version ?? 0)
            ? { ...item, execution } : item),
      };
    });
  }

  function change<K extends keyof Draft>(
    field: K,
    value: Draft[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setDirty(true);
    setNotice("");
  }

  async function save(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy || readOnly) return;

    setError("");
    setNotice("");

    if (!form.shift_code) {
      setError("Select a shift.");
      return;
    }

    if (form.items.some(item => item.responsible_user_id && !form.participant_ids.includes(item.responsible_user_id))) {
      setError("Reassign the work of anyone removed from the shift before saving.");
      return;
    }
    if (form.items.some(item => item.planned_start && !item.estimated_duration_minutes)) {
      setError("Enter an estimated duration for each item with a planned start.");
      return;
    }

    setBusy(true);

    try {
      const payload = {
        briefing_date: form.briefing_date,
        shift_code: form.shift_code,
        mobile_holder_user_id: form.mobile_holder_user_id,
        participant_ids: form.participant_ids,
        items: form.items,
        received_notes: form.received_notes,
        general_notices: form.general_notices,
        agreements: form.agreements,
        handover_notes: form.handover_notes,
        ...(selected
          ? { expected_revision: selected.revision }
          : {}),
      };

      const saved = await request<Detail>(
        selected
          ? `/api/briefings/${selected.id}`
          : "/api/briefings",
        {
          method: selected ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setSelected(saved);
      setCalendarId(String(saved.id));
      setCalendarAttempt(value => value + 1);
      setForm(formFrom(saved));
      setDirty(false);
      setNotice("Draft saved.");

      // El guardado ya ha terminado correctamente.
      // Si falla el listado, conservamos esa confirmación.
      try {
        setListing(
          await recentBriefings(),
        );
        setListError("");
      } catch {
        setListError(
          "Draft saved. The list could not be refreshed.",
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="briefings-page">
      <header className="briefings-page__header">
        <div>
          <h1 className="briefings-page__title">Briefing</h1>
          <div className="briefings-page__actions">
            <button type="button" aria-label="New briefing"
              disabled={loading || busy || !canEdit} onClick={newBriefing}>
              + Briefing
            </button>
            <button type="button" disabled={loading || busy} onClick={() => void refreshList()}>
              Update
            </button>
          </div>
        </div>
        <div className="briefings-page__total">
          <strong>{listing.total}</strong><span>briefings · today and yesterday</span>
        </div>
      </header>

      {loading && <div className="briefings-page__state" role="status">Loading briefings…</div>}
      {!opened && listError && <div role="alert" className="briefings-error">{listError}</div>}
      {!opened && error && <div role="alert" className="briefings-error">{error}</div>}
      {!opened && notice && <div role="status" className="briefings-notice">{notice}</div>}
      {!loading && !canEdit && <p className="briefings-page__hint">Read-only access.</p>}

      {!loading && <section className="briefings-calendar-section" aria-label="Shift calendar">
        <div className="briefings-section__header"><h2>{workView === "calendar" ? "Shift planning" : "Work by target day"}</h2><span>{workView === "calendar" ? "Participants and schedules" : "All available open work"}</span></div>
        <div className="briefings-view-switch" role="group" aria-label="Work view">
          <button type="button" aria-pressed={workView === "calendar"} onClick={() => setWorkView("calendar")}>By assignee</button>
          <button type="button" aria-pressed={workView === "target"} onClick={() => setWorkView("target")}>By target day</button>
        </div>
        {listing.items.length > 0 && <>
          <div className="briefings-calendar-select">
            <label>Calendar briefing<select value={activeCalendarId} disabled={busy} onChange={event => setCalendarId(event.target.value)}>
              {listing.items.map(item => <option key={item.id} value={String(item.id)}>
                {item.briefing_date.split("-").reverse().join("/")} · {shifts[item.shift_code] ?? item.shift_code} · #{item.id} · {item.status === "draft" ? "Draft" : "Finalised"}
              </option>)}
            </select></label>
            <button type="button" disabled={calendarLoading || busy} onClick={() => setCalendarAttempt(value => value + 1)}>Refresh calendar</button>
          </div>
          {calendarLoading && <p role="status">Loading calendar…</p>}
          {calendarError && <p role="alert" className="briefings-error">Could not load the calendar: {calendarError}</p>}
        </>}
        {workView === "target" ? <BriefingTargetDays briefing={calendar} members={teamMembers} catalog={catalog}
          onRefreshTasks={() => setCalendarAttempt(value => value + 1)} operations={operations}
          onOpenBriefing={id => void openBriefing(id)} /> : calendar && String(calendar.id) === activeCalendarId ?
          <BriefingCalendar key={calendar.id} briefing={calendar} directoryMembers={teamMembers}
            disabled={busy} operations={operations} catalog={catalog}
            onOpen={id => void openBriefing(id)} /> : !listing.items.length &&
          <div className="briefings-page__state">No briefings for today or yesterday. Create a briefing to see its calendar.</div>}
      </section>}

      {!loading && (
        <section className="briefings-history" aria-label="Recent Briefings">
          <div className="briefings-section__header">
            <h2>Recent Briefings</h2>
            <span>Today and yesterday · Madrid time</span>
          </div>
          {listing.items.length === 0 ? (
            <div className="briefings-page__state">No briefings for today or yesterday.</div>
          ) : (
            <div className="briefings-grid">
              {listing.items.map((item) => (
                <button key={item.id} type="button" className="briefings-summary-card"
                  disabled={busy} aria-haspopup="dialog"
                  aria-label={`${item.briefing_date.split("-").reverse().join("/")} · ${shifts[item.shift_code] ?? item.shift_code} · ${item.status === "draft" ? "Draft" : "Finalised"} · #${item.id}`}
                  onClick={() => void openBriefing(item.id)}>
                  <span className="briefings-summary-card__header">
                    <span className="briefings-summary-card__name">{shifts[item.shift_code] ?? item.shift_code}</span>
                    <span className="briefings-summary-card__count">#{item.id}</span>
                  </span>
                  <span className="briefings-summary-card__date">{item.briefing_date.split("-").reverse().join("/")}</span>
                  <span className="briefings-summary-card__status">
                    <span className={`briefings-dot briefings-dot--${item.status}`} />
                    {item.status === "draft" ? "Draft" : "Finalised"}
                  </span>
                  <span className="briefings-summary-card__hint">Open briefing</span>
                  <ClipboardList className="briefings-summary-card__icon" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {opened && (
        <dialog ref={dialogRef} className="briefings-dialog" aria-labelledby="briefings-dialog-title"
          onCancel={(event) => { event.preventDefault(); event.stopPropagation(); closeBriefing(); }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeBriefing();
          }}>
          <header className="briefings-dialog__header">
            <div>
              <h2 id="briefings-dialog-title">{selected ? `Briefing #${selected.id}` : "New briefing"}</h2>
              <p>{selected?.status === "finalized" ? "Finalised · read-only" : "Draft"}{dirty ? " · Unsaved changes" : ""}</p>
            </div>
            <button type="button" className="briefings-dialog__close" aria-label="Close briefing" disabled={busy} onClick={closeBriefing}><X size={22} /></button>
          </header>
          <form className="briefings-form" onSubmit={(event) => void save(event)}>
            <div className="briefings-dialog__body">
                <fieldset disabled={busy || readOnly}>
                  <div className="briefings-editor-grid">
                  <section className="briefings-editor-people">
                    <h3 className="briefings-subheading">Shift and team</h3>
                  <div className="briefings-fields">
                    <label>
                      Shift date
                      <input
                        type="date"
                        required
                        value={form.briefing_date}
                        onChange={(event) =>
                          change(
                            "briefing_date",
                            event.target.value,
                          )
                        }
                      />
                    </label>

                    <label>
                      Shift
                      <select
                        required
                        value={form.shift_code}
                        onChange={(event) =>
                          change(
                            "shift_code",
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Select…
                        </option>
                        <option value="morning">
                          Morning
                        </option>
                        <option value="afternoon">
                          Afternoon
                        </option>
                        <option value="night">
                          Night
                        </option>
                      </select>
                    </label>
                  </div>

                  <section
                    aria-label="Shift participants"
                    className="briefings-participants"
                  >
                    <div className="briefings-participants__header">
                      <h3>Shift participants</h3>
                      <span className="briefings-count">{form.participant_ids.length} selected</span>
                    </div>

                    {!teamLoading && !teamError && participantOptions.length === 0 && (
                      <p>
                        {canEdit
                          ? "No active team members are available."
                          : "No participants have been saved."}
                      </p>
                    )}

                    {participantOptions.length > 0 && (
                      <div className="briefings-participants__list">
                        {participantOptions.map((member) => {
                          const unavailable = canEdit && !teamLoading && !teamError
                            && !teamMembers.some(
                              (active) => active.amh_user_id === member.amh_user_id,
                            );
                          return (
                            <label
                              key={member.amh_user_id}
                              className="briefings-participant"
                            >
                              <input
                                type="checkbox"
                                disabled={teamLoading || !!teamError}
                                checked={form.participant_ids.includes(member.amh_user_id)}
                                onChange={(event) =>
                                  change(
                                    "participant_ids",
                                    event.target.checked
                                      ? [...form.participant_ids, member.amh_user_id]
                                      : form.participant_ids.filter(
                                          (id) => id !== member.amh_user_id,
                                        ),
                                  )
                                }
                              />
                              {member.display_name}
                              {unavailable ? " (no longer on the team)" : ""}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <label>
                    Maintenance phone
                    <select
                      value={form.mobile_holder_user_id ?? ""}
                      disabled={teamLoading || !!teamError}
                      onChange={(event) =>
                        change(
                          "mobile_holder_user_id",
                          event.target.value || null,
                        )
                      }
                    >
                      <option value="">Unassigned</option>

                      {form.mobile_holder_user_id &&
                        !teamMembers.some(
                          (member) =>
                            member.amh_user_id ===
                            form.mobile_holder_user_id,
                        ) && (
                          <option value={form.mobile_holder_user_id}>
                            {participantOptions.find(member => member.amh_user_id === form.mobile_holder_user_id)?.display_name ?? "Name unavailable"}
                          </option>
                        )}

                      {teamMembers.map((member) => (
                        <option
                          key={member.amh_user_id}
                          value={member.amh_user_id}
                        >
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {teamLoading && (
                    <p role="status">Loading the maintenance team…</p>
                  )}

                  {teamError && (
                    <div role="alert" className="briefings-error">
                      <p>Could not load the team: {teamError}</p>
                      <button
                        type="button"
                        onClick={() => setTeamAttempt((value) => value + 1)}
                      >
                        Retry loading the team
                      </button>
                    </div>
                  )}

                  </section>
                  <section className="briefings-editor-notes">
                    <h3 className="briefings-subheading">Handover and agreements</h3>
                  <div className="briefings-notes">
                  <label>
                    Incoming handover
                    <textarea
                      rows={3}
                      maxLength={20000}
                      value={form.received_notes}
                      onChange={(event) =>
                        change(
                          "received_notes",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    General notices
                    <textarea
                      rows={3}
                      maxLength={20000}
                      value={form.general_notices}
                      onChange={(event) =>
                        change(
                          "general_notices",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    Shift agreements and plan
                    <textarea
                      rows={4}
                      maxLength={20000}
                      value={form.agreements}
                      onChange={(event) =>
                        change(
                          "agreements",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    Notes for the next shift
                    <textarea
                      rows={3}
                      maxLength={20000}
                      value={form.handover_notes}
                      onChange={(event) =>
                        change(
                          "handover_notes",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  </div>
                  </section>
                  </div>
                </fieldset>


              <div className="briefings-work-section">
                <BriefingWork
                  items={form.items}
                  members={participantOptions.filter(member => form.participant_ids.includes(member.amh_user_id))}
                  disabled={busy || readOnly}
                  onChange={items => change("items", items)}
                />
              </div>
            </div>
            <footer className="briefings-dialog__footer">
              <div className="briefings-dialog__messages">
                {error && <p role="alert" className="briefings-error">{error}</p>}
                {listError && <p role="alert" className="briefings-error">{listError}</p>}
                {notice && <p role="status" className="briefings-notice">{notice}</p>}
              </div>
              <button type="button" disabled={busy} onClick={closeBriefing}>Close</button>
              {!readOnly && <button type="submit" className="briefings-primary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>}
            </footer>
          </form>
        </dialog>
      )}
    </main>
  );
}
