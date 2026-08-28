import { useEffect, useState } from "react";

import { getOpenDrs } from "../api/drs";
import type { Dr } from "../types/dr";
import { DrCard } from "./DrCard";


export function OpenDrs() {
  const [drs, setDrs] = useState<Dr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const data = await getOpenDrs();

        setDrs(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar las DR");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="text-slate-400">
        Cargando DR...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {drs.map((dr) => (
        <DrCard
          key={dr.id}
          dr={dr}
        />
      ))}
    </div>
  );
}