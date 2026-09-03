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
      subtitle="Airbus UI Demo"   />
  );
}