import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import "./AirbusIcon.css";

export type AirbusIconTone =
  | "default"
  | "muted"
  | "inverse"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface AirbusIconProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  size?: number | string;
  tone?: AirbusIconTone;
  label?: string;
}

export function AirbusIcon({
  children,
  size = 24,
  tone = "default",
  label,
  className = "",
  style,
  ...props
}: AirbusIconProps) {
  const classes = [
    "airbus-icon",
    `airbus-icon--${tone}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const iconStyle: CSSProperties = {
    ...style,
    width: size,
    height: size,
  };

  return (
    <span
      className={classes}
      style={iconStyle}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      {children}
    </span>
  );
}
