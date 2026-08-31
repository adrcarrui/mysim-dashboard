import type { HTMLAttributes, ReactNode } from "react";
import "./AirbusHeader.css";

export interface AirbusHeaderProps extends HTMLAttributes<HTMLElement> {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  brand?: ReactNode;
  sticky?: boolean;
}

export function AirbusHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  brand,
  sticky = false,
  className = "",
  ...props
}: AirbusHeaderProps) {
  const classes = [
    "airbus-header",
    sticky ? "airbus-header--sticky" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={classes} {...props}>
      <div className="airbus-header__inner">
        <div className="airbus-header__heading">
          {eyebrow && <div className="airbus-header__eyebrow">{eyebrow}</div>}
          <h1 className="airbus-header__title">{title}</h1>
          {subtitle && (
            <div className="airbus-header__subtitle">{subtitle}</div>
          )}
        </div>

        {(actions || brand) && (
          <div className="airbus-header__right">
            {actions && <div className="airbus-header__actions">{actions}</div>}
            {brand && <div className="airbus-header__brand">{brand}</div>}
          </div>
        )}
      </div>
    </header>
  );
}
