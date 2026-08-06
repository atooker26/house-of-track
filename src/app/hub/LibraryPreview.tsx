"use client";

import { useState } from "react";
import Image from "next/image";
import Icon from "@/components/Icon";
import { DISCIPLINES, libThumb, type Discipline } from "@/lib/hub";
import {
  LIBRARY,
  embedFor,
  formatDate,
  formatDuration,
  formatViews,
  thumbnailFor,
  type LibraryItem,
} from "@/lib/library";

/**
 * Click-to-load embeds, deliberately. Nine live YouTube iframes on /hub would each
 * pull ~1MB of player JS on first paint and wreck the page's Core Web Vitals for
 * videos most visitors never press play on. We render the thumbnail, and swap in the
 * iframe only on click. Nothing is downloaded or re-hosted — the player is YouTube's.
 */
function LibraryCard({ item }: { item: LibraryItem }) {
  const [playing, setPlaying] = useState(false);
  // maxresdefault is missing on plenty of uploads — fall back to hqdefault, then to
  // the brand gradient, so a card never renders as a broken image.
  const [thumbRes, setThumbRes] = useState<"max" | "hq" | "none">("max");

  const duration = formatDuration(item.durationSeconds);
  const meta = [formatViews(item.viewCount), formatDate(item.publishedAt)].filter(Boolean);

  return (
    <div className="feed-card lib-card">
      <div className="feed-cart" style={{ background: libThumb(item.videoId) }}>
        {playing ? (
          <iframe
            className="lib-embed"
            src={embedFor(item.videoId)}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="lib-play-btn"
            onClick={() => setPlaying(true)}
            aria-label={`Play “${item.title}” by ${item.creator.name} on YouTube`}
          >
            {thumbRes !== "none" && (
              <Image
                src={thumbnailFor(item.videoId, thumbRes)}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 920px) 50vw, 33vw"
                // Unoptimized on purpose. These are already CDN-sized JPEGs off
                // Google's edge (1280x720 / 480x360); putting 70+ of them through
                // the Vercel optimizer bills a transform each for no quality gain,
                // and saturates the dev optimizer badly enough that cards fail to
                // paint at all. next/image still gives us lazy loading + sizing.
                unoptimized
                onError={() => setThumbRes((r) => (r === "max" ? "hq" : "none"))}
              />
            )}
            <span className="feed-coverlay">
              <span className="feed-cplay">
                <Icon name="play" size={17} />
              </span>
            </span>
            <span className="feed-cep">{item.discipline}</span>
            {duration && <span className="lib-dur">{duration}</span>}
          </button>
        )}
      </div>

      <div className="feed-cbody">
        <div className="feed-cmeta">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="youtube" size={13} /> YouTube
          </span>
          {meta.length > 0 && <span>{meta.join(" · ")}</span>}
        </div>

        <p className="feed-ctitle">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="lib-title-link"
          >
            {item.title}
          </a>
        </p>

        <div className="lib-credit">
          <Icon name="camera" size={13} />
          {item.creator.url ? (
            <a href={item.creator.url} target="_blank" rel="noopener noreferrer">
              {item.creator.name}
            </a>
          ) : (
            <span>{item.creator.name}</span>
          )}
          {/* athlete is null until the Phase-C classifier lands — omit rather than guess */}
          {item.athlete && (
            <>
              <span aria-hidden="true">·</span>
              <Icon name="users" size={13} /> {item.athlete}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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
