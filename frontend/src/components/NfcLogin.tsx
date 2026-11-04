import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

const BACKEND = "http://127.0.0.1:8000";
const AGENT = "http://127.0.0.1:8766";

type NfcLoginProps = {
  requestSessionCheck: Dispatch<SetStateAction<number>>;
};

export function NfcLogin({
  requestSessionCheck,
}: NfcLoginProps) {
  const [message, setMessage] = useState("Preparando lector NFC…");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function run() {
      setError("");

      try {
        while (!cancelled) {
          setMessage("Preparando inicio con tarjeta…");

          const start = await fetch(`${BACKEND}/auth/nfc/start`, {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          });

          if (!start.ok) {
            throw new Error(`No se pudo iniciar NFC: HTTP ${start.status}`);
          }

          const data = await start.json();
          const challenge: string = data.challenge;

          if (typeof challenge !== "string") {
            throw new Error("AMH devolvió un desafío no válido");
          }

          const seconds =
            typeof data.expires_in_seconds === "number"
              ? data.expires_in_seconds
              : 90;

          const deadline = Date.now() + Math.max(seconds - 2, 1) * 1000;
          setMessage("Acerca tu tarjeta al lector ACR122U");

          while (!cancelled && Date.now() < deadline) {
            const scan = await fetch(`${AGENT}/scan`, {
              method: "POST",
              credentials: "omit",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ challenge }),
              cache: "no-store",
              signal: controller.signal,
            });

            if (scan.status === 200) {
              const result = await scan.json();

              if (result.status === "remove_card") {
                setMessage("Retira la tarjeta y vuelve a acercarla");
              }

              if (result.status === "verified") {
                setMessage("Tarjeta reconocida. Iniciando sesión…");

                const finish = await fetch(
                  `${BACKEND}/auth/nfc/finish`,
                  {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ challenge }),
                    cache: "no-store",
                    signal: controller.signal,
                  },
                );

                if (!finish.ok) {
                  throw new Error(
                    `No se pudo crear la sesión: HTTP ${finish.status}`,
                  );
                }

                requestSessionCheck((value) => value + 1);
                return;
              }
            } else if (scan.status === 204) {
              setMessage("Acerca tu tarjeta al lector ACR122U");
            } else {
              throw new Error(
                `El lector no pudo validar la tarjeta: HTTP ${scan.status}`,
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // El intento caducó mientras esperaba: crea otro automáticamente.
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo iniciar sesión con tarjeta",
          );
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [retry, requestSessionCheck]);

  return (
    <section aria-label="Inicio con tarjeta NFC">
      <p aria-live="polite">{message}</p>

      {error && (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reintentar lectura NFC
          </button>
        </>
      )}
    </section>
  );
}