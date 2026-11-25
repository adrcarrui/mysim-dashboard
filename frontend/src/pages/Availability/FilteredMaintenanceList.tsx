import { useState, type ReactNode } from "react";

export interface MaintenanceFilter<T> {
  id: string;
  label: string;
  tone?: "danger" | "warning" | "info";
  matches: (row: T) => boolean;
}

export function FilteredMaintenanceList<T>({
  rows,
  filters,
  renderList,
}: {
  rows: T[];
  filters: readonly MaintenanceFilter<T>[];
  renderList: (rows: T[]) => ReactNode;
}) {
  const [active, setActive] = useState("all");
  const options = [
    { id: "all", label: "All", tone: undefined, rows },
    ...filters.map(({ matches, ...filter }) => ({
      ...filter,
      rows: rows.filter(matches),
    })),
  ];
  const visibleRows = options.find(option => option.id === active)?.rows ?? rows;

  return (
    <>
      <div className="availability-modal__filters" role="group" aria-label="Record filters">
        {options.map(option => (
          <button
            key={option.id}
            type="button"
            className="availability-modal__filter"
            data-tone={option.tone}
            aria-pressed={active === option.id}
            onClick={() => setActive(option.id)}
          >
            <span>{option.label}</span>{" "}
            <strong>{option.rows.length}</strong>
          </button>
        ))}
      </div>
      {rows.length > 0 && visibleRows.length === 0 ? (
        <div className="availability-modal__empty" role="status">
          No records match this filter.
        </div>
      ) : renderList(visibleRows)}
    </>
  );
}
