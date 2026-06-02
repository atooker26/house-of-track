import Link from "next/link";
import type { Episode } from "@/lib/episodes";
import { coverFor } from "@/lib/constants";
import Icon from "./Icon";

export default function FeedFeatured({ ep }: { ep: Episode }) {
  return (
    <div className="feed-featured">
      <div className="feed-fart">
        <span className="badge">
          <span className="tag tag-coral tag-live">
            <span className="dot" />
            Latest
          </span>
        </span>
        <img src={ep.image || coverFor(ep.n)} alt={ep.title} />
      </div>
      <div className="feed-fbody">
        <div className="feed-meta">
          <span className="epn">Episode {ep.n}</span>
          <span>{ep.date}</span>
          {ep.len && <span>{ep.len}</span>}
        </div>
        <h3 className="feed-ftitle">{ep.title}</h3>
        {ep.guest && <p className="feed-fguest">with {ep.guest}</p>}
        <p className="feed-fdesc">{ep.notes || ep.blurb}</p>
        <div className="feed-factions">
          <Link href={`/episodes/${ep.slug}`} className="btn btn-cream">
            <Icon name="play" size={16} />
            Listen Now
          </Link>
          <a href={ep.spotifyUrl} target="_blank" rel="noopener" className="btn btn-outline-cream">
            <Icon name="spotify" size={16} />
            Spotify
          </a>
        </div>
      </div>
    </div>
  );
}
