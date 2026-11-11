"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Counts down to the drop. Reloads once it hits zero so the server shows it open. */
export default function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n >= target) {
        clearInterval(t);
        window.location.reload();
      }
    };
    // First tick straight after mount (not during it), then every second.
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [target]);

  // First paint (and no-JS): the date itself, so it's never a blank box.
  if (now === null) {
    return (
      <p className="shop-countdown-date">
        Opens {new Date(to).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })} PT
      </p>
    );
  }

  const p = parts(target - now);
  const cells: Array<[number, string]> = [
    [p.d, "Days"],
    [p.h, "Hrs"],
    [p.m, "Min"],
    [p.s, "Sec"],
  ];
  return (
    <div className="shop-countdown" role="timer" aria-label="Time until the drop opens">
      {cells.map(([n, label]) => (
        <div key={label} className="shop-countdown-cell">
          <span className="shop-countdown-n">{String(n).padStart(2, "0")}</span>
          <span className="shop-countdown-l">{label}</span>
        </div>
      ))}
    </div>
  );
}
