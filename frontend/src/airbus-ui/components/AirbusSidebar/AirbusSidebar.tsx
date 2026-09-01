import type { ReactNode } from "react";

import "./AirbusSidebar.css";

export interface AirbusSidebarItem {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export interface AirbusSidebarProps {
  title?: string;
  items: AirbusSidebarItem[];

  collapsed?: boolean;
  onToggle?: () => void;
}

export function AirbusSidebar({
  title = "Navigation",
  items,
  collapsed = false,
  onToggle,
}: AirbusSidebarProps) {
  return (
    <aside
      className={[
        "airbus-sidebar",
        collapsed ? "airbus-sidebar--collapsed" : "",
      ].join(" ")}
    >
      <div className="airbus-sidebar__header">
        <div className="airbus-sidebar__header-content">
          {!collapsed && (
            <div>
              <div className="airbus-sidebar__brand">
                AIRBUS
              </div>

              <div className="airbus-sidebar__title">
                {title}
              </div>
            </div>
          )}

          <button
            type="button"
            className="airbus-sidebar__toggle"
            onClick={onToggle}
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            title={
              collapsed
                ? "Expand"
                : "Collapse"
            }
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>
      </div>

      <nav className="airbus-sidebar__nav">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            title={collapsed ? item.label : undefined}
            className={[
              "airbus-sidebar__item",
              item.active
                ? "airbus-sidebar__item--active"
                : "",
            ].join(" ")}
          >
            {item.icon && (
              <span className="airbus-sidebar__icon">
                {item.icon}
              </span>
            )}

            {!collapsed && (
              <span className="airbus-sidebar__label">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
}