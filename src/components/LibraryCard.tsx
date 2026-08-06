"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";
import { libThumb } from "@/lib/hub";
import {
  embedFor,
  formatDate,
  formatDuration,
  formatViews,
  thumbnailFor,
  type LibraryItem,
} from "@/lib/library";

/**
 * Click-to-load embeds, deliberately. A page of live YouTube iframes would each pull
 * ~1MB of player JS on first paint and wreck Core Web Vitals for videos most
 * visitors never press play on. We render the thumbnail and swap in the iframe only
 * on click. Nothing is downloaded or re-hosted — the player is YouTube's.
 *
 * `showCredit` is off on creator pages, where every card is by the same person and
 * repeating their name under all 12 is just noise.
 */
export default function LibraryCard({
  item,
  showCredit = true,
}: {
  item: LibraryItem;
  showCredit?: boolean;
}) {
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
                // Google's edge; putting dozens through the Vercel optimizer bills a
                // transform each for no quality gain, and saturates the dev
                // optimizer badly enough that cards fail to paint at all.
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
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="lib-title-link">
            {item.title}
          </a>
        </p>

        {showCredit && (
          <div className="lib-credit">
            <Icon name="camera" size={13} />
            {item.creator.slug ? (
              <Link href={`/creators/${item.creator.slug}`}>{item.creator.name}</Link>
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
        )}
      </div>
    </div>
  );
}
