import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { setDataCacheSession } from "./api/dataCache";
import { NfcLogin } from "./components/NfcLogin";
import { AppLayout } from "./layouts/AppLayout";

import { Availability } from "./pages/Availability/Availability";
import { Jobs } from "./pages/Jobs/Jobs";
import { DRs } from "./pages/DRs/DRs";
import { Actions } from "./pages/Actions/Actions";
import { Tasks } from "./pages/Tasks/Tasks";
import { Team } from "./pages/Team/Team";
import { Briefings } from "./pages/Briefings/Briefings";
import { MaintenanceKpis } from "./pages/MaintenanceKpis/MaintenanceKpis";

type AuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

function AuthGate({
  children,
}: {
  children: (canViewKpis: boolean) => ReactNode;
}) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{
    identity: string;
    canViewKpis: boolean;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      setStatus((current) =>
        current === "unavailable" ? "checking" : current,
      );

      try {
        const response = await fetch(
          "http://127.0.0.1:8000/auth/me",
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) return;

        if (response.ok) {
          const user = await response.json();

          if (controller.signal.aborted) return;

          if (
            typeof user?.user_id !== "string" ||
            !user.user_id ||
            !["viewer", "editor", "admin"].includes(user.role)
          ) {
            throw new Error("Invalid session");
          }

          const identity = `${user.user_id}:${user.role}`;

          setDataCacheSession(identity);
          setSession({
            identity,
            canViewKpis: user.role === "editor" || user.role === "admin",
          });
          setStatus("authenticated");
        } else {
          setDataCacheSession(null);
          setSession(null);

          setStatus(
            response.status === 401
              ? "unauthenticated"
              : "unavailable",
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setDataCacheSession(null);
          setSession(null);
          setStatus("unavailable");
        }
      }
    }

    void checkSession();

    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    let pendingCheck: ReturnType<typeof setTimeout> | undefined;

    function scheduleCheck() {
      if (pendingCheck !== undefined) {
        clearTimeout(pendingCheck);
      }

      pendingCheck = setTimeout(() => {
        pendingCheck = undefined;
        setAttempt((value) => value + 1);
      }, 100);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleCheck();
      }
    }

    window.addEventListener("focus", scheduleCheck);
    window.addEventListener(
      "mysim:session-invalid",
      scheduleCheck,
    );
    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );

    return () => {
      window.removeEventListener("focus", scheduleCheck);
      window.removeEventListener(
        "mysim:session-invalid",
        scheduleCheck,
      );
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );

      if (pendingCheck !== undefined) {
        clearTimeout(pendingCheck);
      }
    };
  }, []);

  if (status === "checking") {
    return <main>Checking session…</main>;
  }

  if (status === "unauthenticated") {
    return (
      <main>
        <h1>mySim Dashboard</h1>

        <NfcLogin requestSessionCheck={setAttempt} />

        <p>You can also sign in with your password.</p>

        <a href="http://127.0.0.1:8000/auth/login">
          Sign in with your password
        </a>
      </main>
    );
  }

  if (status === "unavailable") {
    return (
      <main>
        <h1>Could not verify your session</h1>

        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <Fragment key={session?.identity}>
      {children(session?.canViewKpis ?? false)}
    </Fragment>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        {canViewKpis => (
          <Routes>
            <Route element={<AppLayout canViewKpis={canViewKpis} />}>
              <Route
                index
                element={
                  <Navigate
                    to="/availability"
                    replace
                  />
                }
              />

              <Route
                path="availability"
                element={<Availability />}
              />

              <Route
                path="jobs"
                element={<Jobs />}
              />

              <Route
                path="drs"
                element={<DRs />}
              />

              <Route
                path="actions"
                element={<Actions />}
              />

              <Route
                path="tasks"
                element={<Tasks />}
              />

              <Route
                path="team"
                element={<Team />}
              />

              <Route
                path="briefings"
                element={<Briefings />}
              />
              <Route
                path="maintenance-kpis"
                element={canViewKpis ? <MaintenanceKpis /> : <Navigate to="/availability" replace />}
              />
            </Route>
          </Routes>
        )}
      </AuthGate>
    </BrowserRouter>
  );
}