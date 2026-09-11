import type { HTMLAttributes, ReactNode } from "react";
import { AirbusHeader } from "../AirbusHeader";
import "./AirbusPage.css";

export type AirbusPageHighlight =
  | "cyan"
  | "green"
  | "lime"
  | "orange"
  | "red"
  | "pink"
  | "purple";

export interface AirbusPageProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  headerActions?: ReactNode;
  brand?: ReactNode;
  highlight?: AirbusPageHighlight;
  stickyHeader?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function AirbusPage({
  title,
  subtitle,
  eyebrow,
  headerActions,
  brand,
  highlight = "cyan",
  stickyHeader = false,
  fullWidth = false,
  className = "",
  children,
  ...props
}: AirbusPageProps) {
  const classes = [
    "airbus-ui",
    "airbus-page",
    `airbus-page--highlight-${highlight}`,
    fullWidth ? "airbus-page--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      <AirbusHeader
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        actions={headerActions}
        brand={brand}
        sticky={stickyHeader}
      />

      <main className="airbus-page__main">
        <div className="airbus-page__content">{children}</div>
      </main>
    </div>
  );
}
