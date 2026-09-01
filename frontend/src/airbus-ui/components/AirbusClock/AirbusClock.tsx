import { useEffect, useState } from "react";

import "./AirbusClock.css";

export function AirbusClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const date = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  return (
    <div className="airbus-clock">
      <div className="airbus-clock__date">
        {date}
      </div>

      <div className="airbus-clock__time">
        {time}
      </div>
    </div>
  );
}