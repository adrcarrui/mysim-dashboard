import { useState } from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  BriefcaseBusiness,
  FileWarning,
  ListChecks,
  CalendarClock,
  CalendarRange,
} from "lucide-react";

import {
  AirbusLayout,
  AirbusClock,
} from "../airbus-ui";


export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  return (
    <AirbusLayout
      title="Maintenance & Support Dashboard"

      headerActions={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AirbusClock />

          <form
            method="post"
            action="http://127.0.0.1:8000/auth/logout"
            style={{ margin: 0 }}
          >
            <button type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      }

      sidebarCollapsed={
        sidebarCollapsed
      }

      onSidebarToggle={() =>
        setSidebarCollapsed(
          (value) => !value
        )
      }

      sidebarItems={[
        {
          label: "Overview",
          icon: (
            <LayoutDashboard
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/" ||
            location.pathname === "/dashboard",
          onClick: () =>
            navigate("/dashboard"),
        },

        {
          label: "Jobs",
          icon: (
            <BriefcaseBusiness
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/jobs",

          onClick: () =>
            navigate("/jobs"),
        },

        {
          label: "DRs",
          icon: (
            <FileWarning
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/drs",
          onClick: () =>
            navigate("/drs"),

        },

        {
          label: "Actions",
          icon: (
            <ListChecks
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/actions",
          onClick: () =>
            navigate("/actions"),
        },

        {
          label: "Tasks",
          icon: (
            <CalendarClock
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/tasks",
          onClick: () =>
            navigate("/tasks"),
        },
        {
          label: "Availability",
          icon: (
            <CalendarRange
              size={20}
              strokeWidth={1.8}
            />
          ),
          active:
            location.pathname === "/" ||
            location.pathname === "/availability",
          onClick: () =>
            navigate("/availability"),
        },
      ]}
    >
      <Outlet />
    </AirbusLayout>
  );
}