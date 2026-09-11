import type { HTMLAttributes, ReactNode } from "react";
import "./AirbusCard.css";

export type AirbusCardAccent =
  | "none"
  | "blue"
  | "cyan"
  | "green"
  | "orange"
  | "red"
  | "pink"
  | "purple"
  | "lime";

export interface AirbusCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  accent?: AirbusCardAccent;
  padded?: boolean;
  children: ReactNode;
}

export function AirbusCard({
  title,
  subtitle,
  actions,
  footer,
  accent = "none",
  padded = true,
  className = "",
  children,
  ...props
}: AirbusCardProps) {
  const hasHeader = Boolean(title || subtitle || actions);
  const classes = [
    "airbus-card",
    `airbus-card--accent-${accent}`,
    !padded ? "airbus-card--flush" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} {...props}>
      {hasHeader && (
        <header className="airbus-card__header">
          <div className="airbus-card__heading">
            {title && <h2 className="airbus-card__title">{title}</h2>}
            {subtitle && (
              <div className="airbus-card__subtitle">{subtitle}</div>
            )}
          </div>

          {actions && <div className="airbus-card__actions">{actions}</div>}
        </header>
      )}

      <div className="airbus-card__body">{children}</div>

      {footer && <footer className="airbus-card__footer">{footer}</footer>}
    </section>
  );
}
