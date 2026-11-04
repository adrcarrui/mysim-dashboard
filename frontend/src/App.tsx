import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { NfcLogin } from "./components/NfcLogin";
import { AppLayout } from "./layouts/AppLayout";

import { Availability } from "./pages/Availability/Availability";
import { Jobs } from "./pages/Jobs/Jobs";
import { DRs } from "./pages/DRs/DRs";
import { Actions } from "./pages/Actions/Actions";
import { Tasks } from "./pages/Tasks/Tasks";

type AuthStatus =
  | "checking"
  | "authenticated"
  | "unauthenticated"
  | "unavailable";

function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      setStatus((current) =>
        current === "unavailable" ? "checking" : current
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

        if (response.ok) {
          setStatus("authenticated");
        } else if (response.status === 401) {
          setStatus("unauthenticated");
        } else {
          setStatus("unavailable");
        }
      } catch {
        if (!controller.signal.aborted) {
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
    return <main>Comprobando sesión…</main>;
  }

  if (status === "unauthenticated") {
    return (
      <main>
        <h1>mySim Dashboard</h1>
        <NfcLogin requestSessionCheck={setAttempt} />
        <p>También puedes iniciar sesión con contraseña.</p>
        <a href="http://127.0.0.1:8000/auth/login">
          Iniciar sesión con contraseña
        </a>
      </main>
    );
  }

  if (status === "unavailable") {
    return (
      <main>
        <h1>No se pudo comprobar la sesión</h1>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Reintentar
        </button>
      </main>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate>
        <Routes>
          <Route element={<AppLayout />}>
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
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}