import type { HTMLAttributes, ReactNode } from "react";
import "./AirbusBadge.css";

export type AirbusBadgeVariant =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface AirbusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: AirbusBadgeVariant;
  dot?: boolean;
  children: ReactNode;
}

export function AirbusBadge({
  variant = "neutral",
  dot = false,
  className = "",
  children,
  ...props
}: AirbusBadgeProps) {
  const classes = [
    "airbus-badge",
    `airbus-badge--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...props}>
      {dot && <span className="airbus-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
