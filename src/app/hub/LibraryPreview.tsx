"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { DISCIPLINES, LIBRARY, libThumb, type Discipline } from "@/lib/hub";

export default function LibraryPreview() {
  const [tab, setTab] = useState<Discipline | "All">("All");

  const items = tab === "All" ? LIBRARY : LIBRARY.filter((i) => i.discipline === tab);
  const tabs: (Discipline | "All")[] = ["All", ...DISCIPLINES];

  return (
    <div>
      <div className="lib-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={`lib-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="feed-grid">
        {items.map((it) => (
          <a
            key={it.id}
            href="#library"
            className="feed-card"
            onClick={(e) => e.preventDefault()}
          >
            <div className="feed-cart" style={{ background: libThumb(it.id) }}>
              <div className="feed-coverlay">
                <div className="feed-cplay">
                  <Icon name="play" size={17} />
                </div>
              </div>
              <div className="feed-cep">{it.discipline}</div>
            </div>
            <div className="feed-cbody">
              <div className="feed-cmeta">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon name={it.platform} size={13} /> {it.platform}
                </span>
              </div>
              <p className="feed-ctitle">{it.title}</p>
              <div className="lib-credit">
                <Icon name="camera" size={13} /> {it.creator}
                <span aria-hidden="true">·</span>
                <Icon name="users" size={13} /> {it.athlete}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
