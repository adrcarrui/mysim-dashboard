import "./AirbusFooter.css";

export interface AirbusFooterProps {
  leftText?: string;
  rightText?: string;
}

export function AirbusFooter({
  leftText = "Maintenance Department Dashboard · " + __APP_VERSION__,
  rightText = "© 2026 Airbus Operations GmbH. All rights reserved.",
}: AirbusFooterProps) {
  return (
    <footer className="airbus-footer">
      <div className="airbus-footer__left">
        {leftText}
      </div>

      <div className="airbus-footer__right">
        {rightText}
      </div>
    </footer>
  );
}