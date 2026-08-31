import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./AirbusButton.css";

export type AirbusButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger";

export type AirbusButtonSize = "sm" | "md" | "lg";

export interface AirbusButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AirbusButtonVariant;
  size?: AirbusButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function AirbusButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  type = "button",
  ...props
}: AirbusButtonProps) {
  const classes = [
    "airbus-button",
    `airbus-button--${variant}`,
    `airbus-button--${size}`,
    fullWidth ? "airbus-button--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...props}>
      {leadingIcon && (
        <span className="airbus-button__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      )}

      <span className="airbus-button__label">{children}</span>

      {trailingIcon && (
        <span className="airbus-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}
