import { loadEpisodes } from "@/lib/episodes";
import { initials, coverFor, PLATFORMS } from "@/lib/constants";
import AudioPlayer from "@/components/AudioPlayer";
import EpisodeCard from "@/components/EpisodeCard";
import Icon from "@/components/Icon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const episodes = await loadEpisodes();
  const ep = episodes.find(e => e.slug === slug);
  if (!ep) return { title: "Episode Not Found" };
  return {
    title: `${ep.title} — House of Track`,
    description: ep.blurb,
  };
}

export default async function EpisodeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episodes = await loadEpisodes();
  const ep = episodes.find(e => e.slug === slug);
  if (!ep) notFound();

  const related = episodes.filter(e => e.n !== ep.n).slice(0, 3);
  const av = initials(ep.guest || "House Track");

  return (
    <div>
      {/* Hero */}
      <section className="ep-hero grain">
        <div className="ep-hero-inner">
          <div className="ep-hero-art">
            <img src={ep.image || coverFor(ep.n)} alt={ep.title} />
          </div>
          <div>
            <p className="eyebrow on-dark">Episode {ep.n}{ep.date ? ` · ${ep.date}` : ""}{ep.len ? ` · ${ep.len}` : ""}</p>
            <h1>{ep.title}</h1>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 18, color: "var(--fg-on-dark-2)", maxWidth: "48ch", margin: "0 0 22px" }}>{ep.blurb}</p>
            {ep.guest && (
              <div className="guest-line">
                <div className="guest-av">{av}</div>
                <div>
                  <div style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", color: "var(--cream)", letterSpacing: ".02em" }}>{ep.guest}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg-on-dark-2)" }}>Guest</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Audio Player */}
      <section style={{ background: "var(--cream)", padding: 0 }}>
        <div className="wrap" style={{ transform: "translateY(-34px)" }}>
          <AudioPlayer ep={ep} />
        </div>
      </section>

      {/* Show Notes */}
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap notes">
          <div>
            <p className="eyebrow">Show Notes</p>
            <h3 style={{ marginTop: 8 }}>About this conversation</h3>
            <p>{ep.notes || ep.blurb}</p>
            {ep.tags.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <p className="eyebrow">In this episode</p>
                <div className="chips">
                  {ep.tags.map(t => <span key={t} className="tag tag-out">{t}</span>)}
                </div>
              </div>
            )}
          </div>
          <div>
            {ep.guest && (
              <div className="sidecard" style={{ marginBottom: 18 }}>
                <h4>The Guest</h4>
                <div className="guest-line" style={{ marginBottom: 0 }}>
                  <div className="guest-av" style={{ background: "var(--navy-700)" }}>{av}</div>
                  <div>
                    <div style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase" }}>{ep.guest}</div>
                    <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{ep.disc}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="sidecard">
              <h4>Listen on</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {PLATFORMS.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-cond)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 13, color: "var(--ink)", textDecoration: "none" }}>
                    <Icon name={p.id} size={18} /> {p.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Keep listening</p>
                <h2 style={{ fontFamily: "var(--font-display)", textTransform: "uppercase", fontSize: 40, letterSpacing: "0.01em", margin: "8px 0 0", color: "var(--ink)" }}>Related Episodes</h2>
              </div>
            </div>
            <div className="feed-grid">
              {related.map(ep => <EpisodeCard key={ep.n} ep={ep} light />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
