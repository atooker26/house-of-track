import type { Metadata } from "next";
import Image from "next/image";
import SoonForm from "./SoonForm";

export const metadata: Metadata = {
  title: "House of Track — Something new is coming",
  description:
    "House of Track is building the hub for track & field. Join the list to hear first.",
  // The gate serves the same page on every URL, so it must not be indexed.
  //
  // Be clear-eyed about the cost: every existing URL 307s here, so this will
  // progressively deindex the whole site — /, /episodes/*, /creators/* — not
  // just suppress the splash page, and re-indexing after the gate lifts is not
  // instant. Accepted deliberately (2026-08-15); the alternative was serving
  // 503 + Retry-After at every URL, which holds the index but reads as downtime.
  // Remove this export when the gate comes down.
  robots: { index: false, follow: false },
};

export default function SoonPage() {
  return (
    <div className="gate-page grain">
      <div className="gate-inner">
        <Image
          src="/assets/logo-mark-cream.png"
          alt="House of Track"
          width={72}
          height={72}
          priority
        />

        <h1>Something new is coming</h1>

        <p className="gate-lead">
          House of Track has spent two years telling the stories behind the sport.
          We&apos;re building the thing those stories were always pointing at — a
          home for track &amp; field&apos;s athletes and the people who capture them.
        </p>

        <p className="gate-lead gate-lead-2">
          Leave your email and you&apos;ll be the first through the door.
        </p>

        <SoonForm />

        <p className="gate-meanwhile">
          Meanwhile, the show keeps running —{" "}
          <a
            href="https://open.spotify.com/show/0Vnmcv13lSwnCR7wCcEJta"
            target="_blank"
            rel="noopener"
          >
            Spotify
          </a>
          {" · "}
          <a
            href="https://www.youtube.com/@House_of_Track"
            target="_blank"
            rel="noopener"
          >
            YouTube
          </a>
          {" · "}
          <a
            href="https://www.instagram.com/houseoftrack.hot/"
            target="_blank"
            rel="noopener"
          >
            Instagram
          </a>
        </p>
      </div>
    </div>
  );
}
