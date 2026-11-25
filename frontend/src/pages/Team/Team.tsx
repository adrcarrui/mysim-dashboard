import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";

type DirectoryUser = {
  amh_user_id: string;
  display_name: string;
  email: string | null;
  is_blocked: boolean;
  aturnos_present: boolean;
  aturnos_active: boolean | null;
  aturnos_links: {
    id_aturno: string | number;
    id_user: string | number;
  }[];
};

type Membership = {
  amh_user_id: string;
  active: boolean;
  revision: number;
};

type PendingATurnosUser = {
  id_user: string;
  name: string;
  email: string | null;
  status: string;
  reason: string;
};

type PendingATurnosResponse = {
  team_id: string;
  users: PendingATurnosUser[];
  review_required: PendingATurnosUser[];
  complete: boolean;
};

type TeamHistoryEvent = {
  id: number;
  amh_user_id: string;
  actor_user_id: string;
  action: "added" | "removed" | "reincorporated";
  membership_revision: number;
  occurred_at: string;
};

type TeamHistoryResponse = {
  total: number;
  limit: number;
  offset: number;
  items: TeamHistoryEvent[];
};

const historyActionLabels = {
  added: "Incorporación",
  removed: "Retirada",
  reincorporated: "Reincorporación",
};

const BACKEND =
  `${window.location.protocol}//${window.location.hostname}:8000`;

async function getJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await apiFetch(`${BACKEND}${path}`, {
    ...options,
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `No se pudo completar la petición: HTTP ${response.status}`,
    );
  }

  return data as T;
}

export function Team() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [search, setSearch] = useState("");
  const [onlyMembers, setOnlyMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [pendingATurnos, setPendingATurnos] =
    useState<PendingATurnosResponse | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState("");

  const [history, setHistory] =
    useState<TeamHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  const loadPendingATurnos = useCallback(
    async (signal?: AbortSignal) => {
      setPendingLoading(true);
      setPendingError("");
      setPendingATurnos(null);

      try {
        const data = await getJson<PendingATurnosResponse>(
          "/api/team/aturnos-candidates",
          { signal },
        );

        if (
          data.complete !== true ||
          !Array.isArray(data.users) ||
          !Array.isArray(data.review_required)
        ) {
          throw new Error(
            "La consulta de candidatos está incompleta",
          );
        }

        if (!signal?.aborted) {
          setPendingATurnos(data);
        }
      } catch (err) {
        if (!signal?.aborted) {
          setPendingError(
            err instanceof Error
              ? err.message
              : "No se pudieron consultar los candidatos",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setPendingLoading(false);
        }
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async (offset = 0, signal?: AbortSignal) => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const data = await getJson<TeamHistoryResponse>(
          `/api/team/history?limit=20&offset=${offset}`,
          { signal },
        );

        if (!signal?.aborted) {
          setHistory(data);
        }
      } catch (err) {
        if (!signal?.aborted) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : "No se pudo consultar el historial",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setHistoryLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadHistory(0, controller.signal);

    return () => controller.abort();
  }, [loadHistory]);

  useEffect(() => {
    const controller = new AbortController();

    void loadPendingATurnos(controller.signal);

    return () => controller.abort();
  }, [loadPendingATurnos]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [directory, team] = await Promise.all([
          getJson<{ users: DirectoryUser[] }>(
            "/api/team/candidates",
            { signal: controller.signal },
          ),
          getJson<{ memberships: Membership[] }>(
            "/api/team",
            { signal: controller.signal },
          ),
        ]);

        if (!controller.signal.aborted) {
          setUsers(directory.users);
          setMemberships(team.memberships);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los usuarios",
          );
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

  async function changeMembership(
    user: DirectoryUser,
    membership: Membership | undefined,
  ) {
    const active = !membership?.active;

    const message = active
      ? `¿Confirmas incorporar a ${user.display_name} al equipo de mantenimiento?`
      : `¿Confirmas quitar a ${user.display_name} del equipo? Su cuenta de AMH se conservará.`;

    if (!window.confirm(message)) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await getJson<Membership>(
        `/api/team/${encodeURIComponent(user.amh_user_id)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            active,
            confirmed: true,
            expected_revision: membership?.revision ?? 0,
          }),
        },
      );

      setMemberships((current) => [
        ...current.filter(
          (item) => item.amh_user_id !== updated.amh_user_id,
        ),
        updated,
      ]);

      setNotice(
        active
          ? `${user.display_name} se ha incorporado al equipo.`
          : `${user.display_name} se ha retirado del equipo.`,
      );

      // Consultamos el historial después de guardar el cambio.
      void loadHistory(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el cambio",
      );

      // Recuperamos el estado actual sin repetir el cambio.
      try {
        const team = await getJson<{
          memberships: Membership[];
        }>("/api/team");

        setMemberships(team.memberships);
      } catch {
        setError(
          "No se pudo comprobar el estado del equipo. Recarga la página antes de continuar.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const membershipById = new Map(
    memberships.map((item) => [item.amh_user_id, item]),
  );

  const userNames = new Map(
    users.map((user) => [
      user.amh_user_id,
      user.display_name,
    ]),
  );

  const query = search.trim().toLocaleLowerCase();

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      `${user.display_name} ${user.email ?? ""}`
        .toLocaleLowerCase()
        .includes(query);

    const isMember =
      membershipById.get(user.amh_user_id)?.active === true;

    return matchesSearch && (!onlyMembers || isMember);
  });

  const memberCount = memberships.filter(
    (item) => item.active,
  ).length;

  const cellStyle = {
    padding: 12,
    borderBottom: "1px solid #dce4ec",
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>Equipo de mantenimiento</h1>

      <p>
        Miembros del equipo: <strong>{memberCount}</strong>
      </p>

      <p>
        Los datos personales proceden de AMH. La pertenencia
        al equipo se gestiona desde este Dashboard.
      </p>

      {loading && <p role="status">Cargando usuarios…</p>}

      {error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      )}

      {notice && (
        <p role="status" style={{ color: "#176b39" }}>
          {notice}
        </p>
      )}

      {!loading && (
        <>
          <label>
            Buscar por nombre o correo
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuario…"
              style={{
                display: "block",
                marginTop: 8,
                marginBottom: 16,
                padding: 10,
                width: "100%",
                maxWidth: 440,
              }}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={onlyMembers}
              onChange={(event) =>
                setOnlyMembers(event.target.checked)
              }
            />{" "}
            Mostrar solo miembros del equipo
          </label>

          <p>Usuarios mostrados: {filteredUsers.length}</p>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  <th style={cellStyle}>Nombre</th>
                  <th style={cellStyle}>Correo</th>
                  <th style={cellStyle}>Estado AMH</th>
                  <th style={cellStyle}>Equipo</th>
                  <th style={cellStyle}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const membership = membershipById.get(
                    user.amh_user_id,
                  );

                  const isMember = membership?.active === true;

                  const canAdd =
                    !user.is_blocked &&
                    user.aturnos_present === true &&
                    user.aturnos_active === true;

                  const reason = user.is_blocked
                    ? "Usuario bloqueado en AMH"
                    : user.aturnos_present !== true
                      ? "No aparece en el equipo de aTurnos"
                      : user.aturnos_active === false
                        ? "Usuario inactivo en aTurnos"
                        : "Estado de aTurnos pendiente de revisión";

                  return (
                    <tr key={user.amh_user_id}>
                      <td style={cellStyle}>
                        {user.display_name}
                      </td>

                      <td style={cellStyle}>
                        {user.email ?? "—"}
                      </td>

                      <td style={cellStyle}>
                        {user.is_blocked ? "Bloqueado" : "Activo"}
                      </td>

                      <td style={cellStyle}>
                        {isMember
                          ? "Miembro"
                          : membership
                            ? "Retirado"
                            : "No incorporado"}
                      </td>

                      <td style={cellStyle}>
                        <button
                          type="button"
                          disabled={
                            saving || (!isMember && !canAdd)
                          }
                          title={
                            !isMember && !canAdd
                              ? reason
                              : undefined
                          }
                          onClick={() =>
                            void changeMembership(
                              user,
                              membership,
                            )
                          }
                        >
                          {isMember
                            ? "Quitar del equipo"
                            : membership
                              ? "Reincorporar"
                              : "Añadir al equipo"}
                        </button>

                        {!isMember && !canAdd && (
                          <small
                            style={{
                              display: "block",
                              marginTop: 6,
                            }}
                          >
                            {reason}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <p>No hay usuarios que mostrar.</p>
          )}
        </>
      )}

      <section
        style={{
          marginTop: 32,
          padding: 24,
          border: "1px solid #dce4ec",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h2>Usuarios de aTurnos pendientes de alta</h2>

          <button
            type="button"
            disabled={pendingLoading}
            onClick={() => void loadPendingATurnos()}
          >
            {pendingLoading
              ? "Consultando…"
              : "Actualizar candidatos"}
          </button>
        </div>

        <p>
          Personas sin vínculo con AMH detectadas en aTurnos.
          Crear su identidad requiere revisión y confirmación
          en AMH.
        </p>

        {pendingLoading && (
          <p role="status">
            Consultando aTurnos. La consulta puede tardar
            unos segundos…
          </p>
        )}

        {pendingError && (
          <p role="alert" style={{ color: "#b42318" }}>
            {pendingError}
          </p>
        )}

        {!pendingLoading && !pendingError && pendingATurnos && (
          <>
            <p>
              Equipo aTurnos: {pendingATurnos.team_id}
              {" · "}
              Candidatos a alta: {pendingATurnos.users.length}
              {" · "}
              Pendientes de revisión:{" "}
              {pendingATurnos.review_required.length}
            </p>

            {pendingATurnos.users.length === 0 &&
            pendingATurnos.review_required.length === 0 ? (
              <p>No hay usuarios de aTurnos pendientes de alta.</p>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={cellStyle}>Nombre en aTurnos</th>
                        <th style={cellStyle}>Correo</th>
                        <th style={cellStyle}>Estado</th>
                        <th style={cellStyle}>Detalle</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[
                        ...pendingATurnos.users,
                        ...pendingATurnos.review_required,
                      ].map((user) => (
                        <tr key={user.id_user}>
                          <td style={cellStyle}>
                            {user.name || "Sin nombre"}

                            <small style={{ display: "block" }}>
                              aTurnos: {user.id_user}
                            </small>
                          </td>

                          <td style={cellStyle}>
                            {user.email ?? "—"}
                          </td>

                          <td style={cellStyle}>
                            {user.status === "new"
                              ? "Candidato a alta"
                              : "Requiere revisión"}
                          </td>

                          <td style={cellStyle}>
                            {user.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p>
                  <a
                    href="http://127.0.0.1:5174/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir AMH para revisar las altas
                  </a>
                </p>
              </>
            )}
          </>
        )}
      </section>

      <section
        style={{
          marginTop: 32,
          padding: 24,
          border: "1px solid #dce4ec",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h2>Historial del equipo</h2>

          <button
            type="button"
            disabled={historyLoading}
            onClick={() =>
              void loadHistory(history?.offset ?? 0)
            }
          >
            {historyLoading
              ? "Cargando…"
              : "Actualizar historial"}
          </button>
        </div>

        {historyLoading && (
          <p role="status">Consultando historial…</p>
        )}

        {historyError && (
          <p role="alert" style={{ color: "#b42318" }}>
            {historyError}
          </p>
        )}

        {!historyLoading && !historyError && history && (
          <>
            <p>Cambios registrados: {history.total}</p>

            {history.items.length === 0 ? (
              <p>No hay cambios registrados en esta página.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={cellStyle}>Fecha · Madrid</th>
                      <th style={cellStyle}>Persona</th>
                      <th style={cellStyle}>Acción</th>
                      <th style={cellStyle}>Realizado por</th>
                      <th style={cellStyle}>Revisión</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.items.map((event) => (
                      <tr key={event.id}>
                        <td style={cellStyle}>
                          {new Date(
                            event.occurred_at,
                          ).toLocaleString("es-ES", {
                            timeZone: "Europe/Madrid",
                          })}
                        </td>

                        <td style={cellStyle}>
                          {userNames.get(event.amh_user_id) ??
                            event.amh_user_id}
                        </td>

                        <td style={cellStyle}>
                          {historyActionLabels[event.action] ??
                            event.action}
                        </td>

                        <td style={cellStyle}>
                          {userNames.get(event.actor_user_id) ??
                            event.actor_user_id}
                        </td>

                        <td style={cellStyle}>
                          {event.membership_revision}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                disabled={history.offset === 0}
                onClick={() =>
                  void loadHistory(
                    Math.max(
                      0,
                      history.offset - history.limit,
                    ),
                  )
                }
              >
                Anterior
              </button>

              <span>
                Página{" "}
                {Math.floor(
                  history.offset / history.limit,
                ) + 1}
              </span>

              <button
                type="button"
                disabled={
                  history.offset + history.limit >=
                  history.total
                }
                onClick={() =>
                  void loadHistory(
                    history.offset + history.limit,
                  )
                }
              >
                Siguiente
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}