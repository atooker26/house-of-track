"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";

/**
 * Product photos: one large image, thumbnails underneath, and a full-screen
 * viewer. Every photo can be the large one (ticket #109).
 *
 * - Thumbnails, prev/next arrows, ←/→ keys and a horizontal swipe all move
 *   between photos.
 * - Clicking the large photo opens a native <dialog> via showModal(): the rest
 *   of the page goes inert (focus stays inside), Esc closes, and focus returns
 *   to the photo that opened it.
 */

const SWIPE_PX = 40;

export default function ProductGallery({
  images,
  name,
  soldOut,
}: {
  images: string[];
  name: string;
  soldOut: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;
  const many = count > 1;

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!count) {
    return (
      <div className="shop-gallery">
        <div className="shop-gallery-main">
          {soldOut ? <span className="shop-badge">Sold out</span> : null}
        </div>
      </div>
    );
  }

  const alt = (i: number) => (i === 0 ? name : `${name}, photo ${i + 1} of ${count}`);

  function onKey(e: KeyboardEvent) {
    if (!many) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  }

  function onTouchStart(e: TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null || !many) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  }

  const counter = many ? (
    <span className="shop-gallery-count" aria-hidden="true">
      {index + 1} / {count}
    </span>
  ) : null;

  return (
    <div className="shop-gallery">
      <div
        className="shop-gallery-main"
        role="group"
        aria-roledescription="carousel"
        aria-label={`${name} photos`}
        onKeyDown={onKey}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          ref={openerRef}
          type="button"
          className="shop-gallery-open"
          onClick={() => setOpen(true)}
          aria-label={`View photo ${index + 1} of ${count} full size`}
        >
          <Image
            key={images[index]}
            src={images[index]}
            alt={alt(index)}
            fill
            loading="eager"
            fetchPriority={index === 0 ? "high" : "auto"}
            sizes="(max-width: 768px) 100vw, 55vw"
          />
        </button>
        {soldOut ? <span className="shop-badge">Sold out</span> : null}
        {many ? (
          <>
            <button type="button" className="shop-gallery-arrow is-prev" onClick={() => go(-1)} aria-label="Previous photo">
              <Chevron dir="left" />
            </button>
            <button type="button" className="shop-gallery-arrow is-next" onClick={() => go(1)} aria-label="Next photo">
              <Chevron dir="right" />
            </button>
          </>
        ) : null}
        {counter}
        <p className="sr-only" aria-live="polite">
          {many ? `Photo ${index + 1} of ${count}` : ""}
        </p>
      </div>

      {many ? (
        <ul className="shop-gallery-thumbs" aria-label="Choose a photo">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                className={`shop-gallery-thumb${i === index ? " is-on" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
              >
                <Image src={src} alt="" fill sizes="(max-width: 768px) 25vw, 14vw" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <dialog
        ref={dialogRef}
        className="shop-lightbox"
        aria-label={`${name} photos, full size`}
        onClose={() => {
          setOpen(false);
          openerRef.current?.focus();
        }}
        onKeyDown={onKey}
        onClick={(e) => {
          // A click on the backdrop (the dialog itself, not its contents) closes it.
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {open ? (
          <div className="shop-lightbox-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="shop-lightbox-img">
              <Image key={images[index]} src={images[index]} alt={alt(index)} fill sizes="100vw" />
            </div>
            <button type="button" className="shop-lightbox-close" onClick={() => setOpen(false)} aria-label="Close" autoFocus>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            {many ? (
              <>
                <button type="button" className="shop-gallery-arrow is-prev" onClick={() => go(-1)} aria-label="Previous photo">
                  <Chevron dir="left" />
                </button>
                <button type="button" className="shop-gallery-arrow is-next" onClick={() => go(1)} aria-label="Next photo">
                  <Chevron dir="right" />
                </button>
              </>
            ) : null}
            {counter}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
