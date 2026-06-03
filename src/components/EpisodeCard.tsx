import Image from "next/image";
import Link from "next/link";
import type { Episode } from "@/lib/episodes";
import { coverFor } from "@/lib/constants";

export default function EpisodeCard({ ep, light }: { ep: Episode; light?: boolean }) {
  return (
    <Link href={`/episodes/${ep.slug}`} className={`feed-card${light ? " on-light" : ""}`}>
      <div className="feed-cart">
        {ep.image?.startsWith("http") ? (
          <Image src={ep.image} alt={ep.title} fill sizes="(max-width: 560px) 100vw, (max-width: 920px) 50vw, 33vw" style={{ objectFit: "cover" }} />
        ) : (
          <img src={ep.image || coverFor(ep.n)} alt={ep.title} />
        )}
        <div className="feed-coverlay">
          <div className="feed-cplay">
            <svg
              viewBox="0 0 24 24"
              style={{ width: 17, height: 17, color: "#fff", marginLeft: 3 }}
              aria-hidden="true"
            >
              <path d="M6 4l14 8-14 8z" fill="currentColor" />
            </svg>
          </div>
        </div>
        <span className="feed-cep">EP {ep.n}</span>
      </div>
      <div className="feed-cbody">
        <div className="feed-cmeta">
          <span>{ep.date}</span>
          {ep.len && <span>{ep.len}</span>}
        </div>
        <p className="feed-ctitle">
          {ep.guest ? `${ep.guest} — ${ep.title}` : ep.title}
        </p>
      </div>
    </Link>
  );
}
