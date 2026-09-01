// src/layouts/AppLayout.tsx

import { useState } from "react";
import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AirbusLayout,
} from "../airbus-ui/components/AirbusLayout/AirbusLayout";


export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false);

  return (
    <AirbusLayout
      title="Maintenance & Support"
      subtitle="mySim Operations Dashboard"

      sidebarCollapsed={sidebarCollapsed}

      onSidebarToggle={() =>
        setSidebarCollapsed(
          (current) => !current
        )
      }

      sidebarItems={[
        {
          label: "Dashboard",
          active:
            location.pathname === "/" ||
            location.pathname === "/dashboard",
          onClick: () =>
            navigate("/dashboard"),
        },
        {
          label: "New",
          active:
            location.pathname === "/new",
          onClick: () =>
            navigate("/new"),
        },
        {
          label: "Tasks",
          active:
            location.pathname === "/tasks",
          onClick: () =>
            navigate("/tasks"),
        },
      ]}

      footerLeft="Airbus"
      footerRight="mySim"
    >
      <Outlet />
    </AirbusLayout>
  );
}