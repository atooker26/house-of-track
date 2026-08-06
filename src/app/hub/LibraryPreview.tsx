"use client";

import { useState } from "react";
import LibraryCard from "@/components/LibraryCard";
import { DISCIPLINES, type Discipline } from "@/lib/hub";
import { LIBRARY } from "@/lib/library";

export default function LibraryPreview() {
  const [tab, setTab] = useState<Discipline | "All">("All");

  const items = tab === "All" ? LIBRARY : LIBRARY.filter((i) => i.discipline === tab);
  // Only offer a discipline tab if there's something behind it — an empty tab reads
  // as a bug, and Field is thin until meet-coverage channels get classified.
  const populated = new Set(LIBRARY.map((i) => i.discipline));
  const tabs: (Discipline | "All")[] = ["All", ...DISCIPLINES.filter((d) => populated.has(d))];

  if (LIBRARY.length === 0) {
    return (
      <p className="lib-empty">
        The library is being wired to the creator roster — check back shortly.
      </p>
    );
  }

  return (
    <div>
      <div className="lib-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            className={`lib-tab${tab === t ? " active" : ""}`}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="feed-grid">
        {items.map((it) => (
          <LibraryCard key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}
