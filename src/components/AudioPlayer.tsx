"use client";

import { useState, useEffect } from "react";
import type { Episode } from "@/lib/episodes";
import { HOST, coverFor } from "@/lib/constants";
import Icon from "./Icon";

export default function AudioPlayer({ ep }: { ep: Episode }) {
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(28);
  const total = 58 * 60;
  const cur = Math.round((total * pct) / 100);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPct((p) => (p >= 100 ? 0 : p + 0.4)), 400);
    return () => clearInterval(id);
  }, [playing]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPct(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
  };

  return (
    <div className="player">
      <div className="player-top">
        <div className="player-art">
          <img src={ep.image || coverFor(ep.n)} alt="" />
        </div>
        <div className="player-info">
          <p className="eyebrow on-dark" style={{ margin: 0 }}>
            Episode {ep.n}
            {ep.guest ? ` · ${ep.guest}` : ""}
          </p>
          <div className="t">{ep.title}</div>
          <div className="s">House of Track · with {HOST}</div>
        </div>
      </div>
      <div className="player-controls">
        <button className="pc-btn" aria-label="Back 15">
          <Icon name="back15" size={22} />
        </button>
        <button
          className="pc-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          <Icon name={playing ? "pause" : "play"} size={22} />
        </button>
        <button className="pc-btn" aria-label="Forward 15">
          <Icon name="fwd15" size={22} />
        </button>
        <div className="scrub">
          <span className="time">{fmt(cur)}</span>
          <div className="track" onClick={seek}>
            <div className="track-fill" style={{ width: pct + "%" }} />
            <div className="track-knob" style={{ left: pct + "%" }} />
          </div>
          <span className="time">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
