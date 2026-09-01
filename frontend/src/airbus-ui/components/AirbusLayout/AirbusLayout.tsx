import type { ReactNode } from "react";

import { AirbusSidebar } from "../AirbusSidebar";
import { AirbusHeader } from "../AirbusHeader";
import { AirbusFooter } from "../AirbusFooter";

import "./AirbusLayout.css";

export interface AirbusLayoutProps {
  children: ReactNode;

  title: string;
  subtitle?: string;

  headerActions?: ReactNode;

  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;

  sidebarItems: {
    label: string;
    icon?: ReactNode;
    active?: boolean;
    onClick?: () => void;
  }[];

  footerLeft?: string;
  footerRight?: string;
}

export function AirbusLayout({
  children,

  title,
  subtitle,

  headerActions,

  sidebarCollapsed = false,
  onSidebarToggle,

  sidebarItems,

  footerLeft,
  footerRight,
}: AirbusLayoutProps) {
  return (
    <div
      className={[
        "airbus-layout",
        sidebarCollapsed
          ? "airbus-layout--sidebar-collapsed"
          : "",
      ].join(" ")}
    >
      <AirbusSidebar
        title="mySim"
        items={sidebarItems}
        collapsed={sidebarCollapsed}
        onToggle={onSidebarToggle}
      />

      <div className="airbus-layout__main">
        <AirbusHeader
          title={title}
          subtitle={subtitle}
          actions={headerActions}
        />

        <main className="airbus-layout__content">
          <div className="airbus-layout__content-inner">
            {children}
          </div>
        </main>

        <AirbusFooter
          leftText={footerLeft}
          rightText={footerRight}
        />
      </div>
    </div>
  );
}