import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { loadEpisodes } from "@/lib/episodes";
import Lanes from "@/components/Lanes";
import Icon from "@/components/Icon";
import JoinNetwork from "@/components/home/JoinNetwork";
import DropNotify from "@/components/home/DropNotify";
import { PLATFORMS, SOCIALS, initials } from "@/lib/constants";
import { getDb } from "@/db";
import { getCurrentDrop } from "@/lib/shop/catalog";

/** Meet the Team on the homepage; the full story lives on /about. */
const TEAM: { name: string; role: string; photo?: string }[] = [
  { name: "David Ribich", role: "Founder · Host", photo: "/assets/david-portrait-2.jpg" },
  { name: "David Fuller", role: "Creative Director" },
];

type Featured = { name: string; blurb: string | null; image: string | null; href: string | null };

/**
 * The homepage's featured item: the first product of the live drop, so it changes
 * when the Davids publish a drop in /admin. Until then, the hat placeholder.
 * A database hiccup shows the placeholder rather than breaking the homepage.
 */
async function loadFeatured(): Promise<Featured | null> {
  try {
    const drop = await getCurrentDrop(await getDb());
    const p = drop && drop.phase !== "ended" ? drop.products[0] : null;
    if (!p) return null;
    return { name: p.name, blurb: drop?.blurb ?? null, image: p.images?.[0] ?? null, href: `/shop/${p.slug}` };
  } catch (err) {
    console.error("[home] featured item:", err);
    return null;
  }
}

export default async function Home() {
  await connection();
  const [episodes, featured] = await Promise.all([loadEpisodes(), loadFeatured()]);
  const feat = episodes[0];

  return (
    <div>
      {/* Hero */}
      <section className="hero hero-video">
        <video
          className="hero-video-bg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/assets/logo-mark-cream.png"
        >
          <source src="/assets/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="hero-video-overlay" />
        <div className="hero-inner">
          <div className="fade">
            <p className="eyebrow on-dark">The House of Track Podcast</p>
            <h1>
              Redefining<br />the Narrative
            </h1>
            <p className="lead">
              Authentic, human-centered storytelling that celebrates the person behind the athlete. Track is the language — the human is the story.
            </p>
            <div className="hero-cta">
              {feat ? (
                <Link href={`/episodes/${feat.slug}`} className="btn btn-cream btn-lg">
                  <Icon name="play" size={16} />
                  Latest Episode
                </Link>
              ) : (
                <Link href="/episodes" className="btn btn-cream btn-lg">
                  <Icon name="play" size={16} />
                  Listen Now
                </Link>
              )}
              <Link href="#join" className="btn btn-outline-cream btn-lg">
                <Icon name="users" size={16} />
                Join the Network
              </Link>
            </div>
            <Lanes />
          </div>
          <div className="hero-mark fade">
            <Image src="/assets/logo-mark-cream.png" alt="House of Track" width={320} height={320} priority />
          </div>
        </div>
      </section>

      {/* Join the Network */}
      <section id="join" className="section grain on-navy join-band">
        <div className="wrap">
          <div className="join-head">
            <p className="eyebrow on-dark">Join the Network</p>
            <h2>Find your lane in the House</h2>
            <p>Creatives, athletes and fans, all in one place. Pick as many as fit.</p>
          </div>
          <JoinNetwork />
        </div>
      </section>

      {/* Featured Item */}
      <section className="section">
        <div className="wrap featured-item">
          <div className="featured-media">
            {featured?.image ? (
              <Image src={featured.image} alt={featured.name} fill sizes="(max-width: 768px) 100vw, 520px" style={{ objectFit: "cover" }} />
            ) : (
              <div className="featured-placeholder">
                <Image src="/assets/logo-mark-cream.png" alt="" width={160} height={160} />
              </div>
            )}
          </div>
          <div>
            <p className="eyebrow coral">{featured?.href ? "In the shop" : "First drop"}</p>
            <h2 style={{ color: "var(--ink)" }}>{featured?.name ?? "The HOT Hat"}</h2>
            <p className="featured-copy">
              {featured?.blurb ?? "Our first piece of House of Track gear. Limited run, coming soon."}
            </p>
            {featured?.href ? (
              <Link href={featured.href} className="btn btn-primary btn-lg">
                Shop now <Icon name="arrow" size={16} />
              </Link>
            ) : (
              <DropNotify dropSlug="first-drop" />
            )}
          </div>
        </div>
      </section>

      {/* Ways to Connect */}
      <section className="section grain on-navy" style={{ background: "var(--navy-700)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow on-dark">Ways to Connect</p>
              <h2 style={{ color: "var(--cream)" }}>Listen, watch, follow</h2>
            </div>
          </div>
          <div className="connect-grid">
            <Link href="/episodes" className="connect-card connect-primary">
              <Icon name="mic" size={22} />
              <span className="connect-label">The Podcast</span>
              <span className="connect-sub">{feat ? `Latest: ${feat.title}` : "Every episode"}</span>
            </Link>
            {[...PLATFORMS, ...SOCIALS].map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener" className="connect-card">
                {p.id === "bluesky" ? <span className="connect-glyph">b</span> : <Icon name={p.id} size={22} />}
                <span className="connect-label">{p.label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the Team */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Meet the Team</p>
              <h2 style={{ color: "var(--ink)" }}>The people behind HOT</h2>
            </div>
            <Link href="/about" className="btn btn-ghost">
              About us <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="team-strip">
            {TEAM.map((m) => (
              <div key={m.name} className="team-card">
                <div className="team-av">
                  {m.photo ? (
                    <Image src={m.photo} alt={m.name} fill sizes="96px" style={{ objectFit: "cover" }} />
                  ) : (
                    <span>{initials(m.name)}</span>
                  )}
                </div>
                <div>
                  <div className="team-name">{m.name}</div>
                  <div className="team-role">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
