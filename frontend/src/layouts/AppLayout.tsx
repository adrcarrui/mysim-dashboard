import { useState } from "react";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Users,
  LayoutDashboard,
  BriefcaseBusiness,
  FileWarning,
  ListChecks,
  CalendarClock,
  ClipboardList,
  ChartNoAxesColumn,
  LogOut,
} from "lucide-react";

import {
  AirbusLayout,
  AirbusClock,
} from "../airbus-ui";
import { setDataCacheSession } from "../api/dataCache";

export function AppLayout({ canViewKpis = false }: { canViewKpis?: boolean }) {
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
            onSubmit={() => setDataCacheSession(null)}
            method="post"
            action="http://127.0.0.1:8000/auth/logout"
            style={{ margin: 0 }}
          >
            <button type="submit">
              <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />
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
            location.pathname === "/availability",
          onClick: () =>
            navigate("/availability"),
        },
        {
          label: "Briefings",
          icon: (
            <ClipboardList
              size={20}
              strokeWidth={1.8}
            />
          ),
          active: location.pathname === "/briefings",
          onClick: () => navigate("/briefings"),
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
          label: "Team",
          icon: (
            <Users
              size={20}
              strokeWidth={1.8}
            />
          ),
          active: location.pathname === "/team",
          onClick: () => navigate("/team"),
        },

        ...(canViewKpis ? [{
          label: "KPIs",
          icon: <ChartNoAxesColumn size={20} strokeWidth={1.8} />,
          active: location.pathname === "/maintenance-kpis",
          onClick: () => navigate("/maintenance-kpis"),
        }] : []),
      ]}
    >
      <Outlet />
    </AirbusLayout>
  );
}