"use client";

import { useState } from "react";
import type { Episode } from "@/lib/episodes";
import EpisodeCard from "@/components/EpisodeCard";
import { PLATFORMS } from "@/lib/constants";
import Icon from "@/components/Icon";

export default function EpisodesClient({ episodes }: { episodes: Episode[] }) {
  const [q, setQ] = useState("");
  const shown = q
    ? episodes.filter(e => (e.title + " " + e.guest).toLowerCase().includes(q.toLowerCase()))
    : episodes;

  return (
    <div>
      <section className="grain" style={{ background: "var(--navy-700)", padding: "64px 0 52px" }}>
        <div className="wrap">
          <p className="eyebrow on-dark">The Archive</p>
          <h1 className="ep-list-h1">Every Episode</h1>
          <div style={{ maxWidth: 420 }}>
            <div className="field" style={{ margin: 0 }}>
              <input
                placeholder="Search episodes or guests..."
                value={q}
                onChange={e => setQ(e.target.value)}
                style={{ background: "rgba(13,17,45,.5)", borderColor: "var(--line-dark)", color: "var(--cream)" }}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <div className="feed-grid">
            {shown.map(ep => <EpisodeCard key={ep.n} ep={ep} light />)}
          </div>
          {shown.length === 0 && (
            <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)" }}>No episodes match &ldquo;{q}&rdquo;.</p>
          )}
          <div style={{ marginTop: 44, paddingTop: 30, borderTop: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap" }}>
            {PLATFORMS.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener" className="btn btn-ghost">
                <Icon name={p.id} size={16} />{p.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
