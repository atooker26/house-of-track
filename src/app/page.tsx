import Image from "next/image";
import Link from "next/link";
import { loadEpisodes } from "@/lib/episodes";
import Lanes from "@/components/Lanes";
import FeedFeatured from "@/components/FeedFeatured";
import EpisodeCard from "@/components/EpisodeCard";
import ValuesStrip from "@/components/ValuesStrip";
import Icon from "@/components/Icon";
import { PLATFORMS } from "@/lib/constants";

export default async function Home() {
  const episodes = await loadEpisodes();
  const feat = episodes[0];
  const rest = episodes.slice(1, 7);

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
              <Link href="/guest" className="btn btn-outline-cream btn-lg">
                <Icon name="mic" size={16} />
                Be a Guest
              </Link>
            </div>
            <Lanes />
          </div>
          <div className="hero-mark fade">
            <Image src="/assets/logo-mark-cream.png" alt="House of Track" width={320} height={320} priority />
          </div>
        </div>
      </section>

      {/* Featured Episode */}
      {feat && (
        <section className="section grain" style={{ background: "var(--navy-700)" }}>
          <div className="wrap on-navy">
            <div className="sec-head">
              <div>
                <p className="eyebrow on-dark">Now Playing</p>
                <h2 style={{ color: "var(--cream)" }}>Latest Episode</h2>
              </div>
            </div>
            <FeedFeatured ep={feat} />
            <div className="listen-on-row">
              <p className="eyebrow on-dark" style={{ margin: 0 }}>Listen on</p>
              {PLATFORMS.map(p => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener" className="listen-on-link">
                  <Icon name={p.id} size={18} /> {p.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent Episodes */}
      {rest.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">The Archive</p>
                <h2 style={{ color: "var(--ink)" }}>Recent Episodes</h2>
              </div>
              <Link href="/episodes" className="btn btn-ghost">
                View all <Icon name="arrow" size={16} />
              </Link>
            </div>
            <div className="feed-grid">
              {rest.map(ep => <EpisodeCard key={ep.n} ep={ep} light />)}
            </div>
          </div>
        </section>
      )}

      {/* Values */}
      <section className="section grain on-navy" style={{ background: "var(--navy-700)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow on-dark">What we stand for</p>
              <h2 style={{ color: "var(--cream)" }}>Victory &amp; Humanity</h2>
            </div>
          </div>
          <ValuesStrip />
        </div>
      </section>

      {/* Guest CTA */}
      <section className="grain guest-cta-band" style={{ background: "radial-gradient(120% 130% at 80% 20%, #2A2E6B, #0D112D)" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow coral">Your story matters</p>
          <h2 className="guest-cta-h2">Be a Guest on HOT</h2>
          <p className="guest-cta-sub">
            This isn&apos;t an interview — it&apos;s a conversation. We keep it raw and real. Come share your journey.
          </p>
          <Link href="/guest" className="btn btn-cream btn-lg">
            <Icon name="mic" size={16} />
            Apply to join the House
          </Link>
        </div>
      </section>
    </div>
  );
}
