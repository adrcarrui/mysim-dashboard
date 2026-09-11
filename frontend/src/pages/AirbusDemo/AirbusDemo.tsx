import {
  useState,
} from "react"

import {
  BriefcaseBusiness,
  CalendarClock,
  FileWarning,
  LayoutDashboard,
  ListChecks,
} from "lucide-react"

import {
  AirbusCard,
  AirbusClock,
  AirbusLayout,
} from "../../airbus-ui"

import "./AirbusDemo.css"


export function AirbusDemo() {
  const [
    sidebarCollapsed,
    setSidebarCollapsed,
  ] = useState(false)

  const sidebarItems = [
    {
      label:
        "Overview",

      icon:
        <LayoutDashboard />,

      active:
        true,
    },

    {
      label:
        "Jobs",

      icon:
        <BriefcaseBusiness />,
    },

    {
      label:
        "DRs",

      icon:
        <FileWarning />,
    },

    {
      label:
        "Tasks",

      icon:
        <ListChecks />,
    },

    {
      label:
        "Availability",

      icon:
        <CalendarClock />,
    },
  ]

  return (
    <AirbusLayout
      title="Maintenance & Support Dashboard"
      subtitle="Airbus UI Demo"
      headerActions={
        <AirbusClock />
      }
      sidebarCollapsed={
        sidebarCollapsed
      }
      onSidebarToggle={() =>
        setSidebarCollapsed(
          (current) =>
            !current
        )
      }
      sidebarItems={
        sidebarItems
      }
      footerLeft="mySim Dashboard"
      footerRight="Airbus UI"
    >
      <AirbusCard
        title="Airbus UI"
        subtitle="Component demonstration"
        accent="cyan"
      >
        <p>
          Select an option from the
          sidebar to explore the
          interface.
        </p>
      </AirbusCard>
    </AirbusLayout>
  )
}