// src/components/ActionsCarousel.tsx

import { useEffect, useState } from "react";
import type { Action } from "../types/action";
import { getOpenActions } from "../services/actions";

export default function ActionsCarousel() {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActions = async () => {
      try {
        setLoading(true);

        const data = await getOpenActions();

        setActions(data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Unable to load actions");
      } finally {
        setLoading(false);
      }
    };

    loadActions();
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading actions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No open actions
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Actions
        </h2>

        <span className="text-sm text-gray-500">
          {actions.length}
        </span>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {actions.map((action) => (
          <article
            key={action.id ?? action.actionId}
            className="
              min-w-[300px]
              max-w-[300px]
              rounded-xl
              border
              border-gray-200
              bg-white
              p-4
              shadow-sm
            "
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">
                {action.actionId ?? "-"}
              </span>

              <span className="text-xs text-gray-500">
                Status {action.status ?? "-"}
              </span>
            </div>

            <div className="mb-2 text-sm font-medium">
              {action.deviceName ?? "Unknown device"}
            </div>

            <div
              className="line-clamp-3 text-sm text-gray-600"
              dangerouslySetInnerHTML={{
                __html:
                  action.actionDescription ??
                  "No description",
              }}
            />

            <div className="mt-4 text-xs text-gray-500">
              {action.date ?? "-"}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}