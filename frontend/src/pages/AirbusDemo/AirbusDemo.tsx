import { useState } from "react";

import {
  LayoutDashboard,
  BriefcaseBusiness,
  FileWarning,
  ListChecks,
  CalendarClock,
} from "lucide-react";

import {
  AirbusLayout,
  AirbusClock,
  AirbusCard,
} from "../../airbus-ui";

import "./AirbusDemo.css";

export function AirbusDemo() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <AirbusLayout
      title="Maintenance & Support Dashboard"
      headerActions={<AirbusClock />}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarToggle={() =>
        setSidebarCollapsed((value) => !value)
      }
      sidebarItems={[
        {
          label: "Overview",
          icon: <LayoutDashboard size={20} strokeWidth={1.8} />,
          active: true,
        },
        {
          label: "Jobs",
          icon: <BriefcaseBusiness size={20} strokeWidth={1.8} />,
        },
        {
          label: "DRs",
          icon: <FileWarning size={20} strokeWidth={1.8} />,
        },
        {
          label: "Actions",
          icon: <ListChecks size={20} strokeWidth={1.8} />,
        },
        {
          label: "Tasks",
          icon: <CalendarClock size={20} strokeWidth={1.8} />,
        },
      ]}
      >

      <AirbusCard
        title="Overview"
        accent="cyan"
      >
        Contenido
      </AirbusCard>
    </AirbusLayout>
  );
}