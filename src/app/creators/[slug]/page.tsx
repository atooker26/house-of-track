import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/Icon";
import LibraryCard from "@/components/LibraryCard";
import RemovalRequest from "@/components/RemovalRequest";
import { loadEpisodes } from "@/lib/episodes";
import { CREATORS, LIBRARY, formatSubscribers } from "@/lib/library";
import { KIND_LABEL, PEOPLE, personBySlug, socialLinks } from "@/lib/people";

export function generateStaticParams() {
  return PEOPLE.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = personBySlug(slug);
  if (!person) return { title: "Not found — House of Track" };

  const title = `${person.name} — House of Track`;
  const description = `${KIND_LABEL[person.kind]} · ${person.discipline}. Their House of Track episode, their work, and where to find them.`;
  const avatar = CREATORS.find((c) => c.slug === slug)?.avatar;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: avatar ? [{ url: avatar, width: 800, height: 800, alt: person.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: avatar ? [avatar] : undefined },
  };
}

export default async function CreatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = personBySlug(slug);
  if (!person) notFound();

  const profile = CREATORS.find((c) => c.slug === slug) ?? null;
  const items = LIBRARY.filter((i) => i.creator.slug === slug);
  const links = socialLinks(person);

  // The anchor. House of Track's own asset leads the page — this is the whole point
  // of the creator page existing, and it's what makes the page worth claiming.
  const episodes = person.podcastEpisode ? await loadEpisodes() : [];
  const episode = episodes.find((e) => e.epNum === person.podcastEpisode) ?? null;

  const subs = formatSubscribers(profile?.subscriberCount ?? null);

  return (
    <div>
      {/* Hero */}
      <section className="creator-hero grain">
        <div className="wrap creator-hero-inner">
          <div className="creator-avatar">
            {profile?.avatar ? (
              // Optimized (unlike the video thumbnails) on purpose: yt3.ggpht.com is
              // blocked outright by common privacy extensions, so a direct <img> shows
              // an empty circle for those visitors. Serving via /_next/image makes it
              // same-origin. The volume is ~19 avatars, not 148 thumbnails, so the
              // transform cost that ruled optimization out there is negligible here.
              <Image src={profile.avatar} alt={person.name} width={128} height={128} />
            ) : (
              <span className="creator-avatar-fallback">{person.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <p className="eyebrow on-dark">
              {KIND_LABEL[person.kind]} · {person.discipline}
              {subs ? ` · ${subs} subscribers` : ""}
            </p>
            <h1 className="creator-name">{person.name}</h1>

            {links.length > 0 && (
              <div className="creator-links">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tag tag-out-dark"
                  >
                    <Icon name={l.icon} size={13} /> {l.label}
                  </a>
                ))}
              </div>
            )}

            <p className="creator-claim">
              Is this you?{" "}
              <Link href="/hub#join">
                Claim this profile <Icon name="arrow" size={14} />
              </Link>
            </p>
            <RemovalRequest slug={person.slug} name={person.name} />
          </div>
        </div>
      </section>

      {/* The episode — first thing under the hero when it exists */}
      {episode && (
        <section className="section" style={{ background: "var(--paper)" }}>
          <div className="wrap">
            <p className="eyebrow coral">On the podcast</p>
            <div className="creator-ep">
              <div className="creator-ep-art">
                {episode.image?.startsWith("http") ? (
                  <Image src={episode.image} alt={episode.title} fill sizes="200px" style={{ objectFit: "cover" }} />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={episode.image} alt={episode.title} />
                )}
              </div>
              <div>
                <p className="creator-ep-meta">
                  Episode {episode.n}
                  {episode.date ? ` · ${episode.date}` : ""}
                  {episode.len ? ` · ${episode.len}` : ""}
                </p>
                <h2 className="creator-ep-title">{episode.title}</h2>
                {episode.blurb && <p className="creator-ep-blurb">{episode.blurb}</p>}
                <Link href={`/episodes/${episode.slug}`} className="btn btn-accent">
                  <Icon name="play" size={15} /> Listen to the episode
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Their work */}
      <section className="section grain on-navy" style={{ background: "var(--navy-700)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow on-dark">Their work</p>
              <h2 style={{ color: "var(--cream)" }}>
                {items.length > 0 ? `${items.length} in the library` : "The library"}
              </h2>
            </div>
            <span className="tag tag-out-dark">Embedded &amp; credited — never re-hosted</span>
          </div>

          {items.length > 0 ? (
            <div className="feed-grid">
              {items.map((it) => (
                <LibraryCard key={it.id} item={it} showCredit={false} />
              ))}
            </div>
          ) : (
            <p className="lib-empty">
              {episode
                ? "No video in the library yet — this profile is anchored on the podcast."
                : "Nothing in the library yet."}{" "}
              {links.length > 0 ? "Find them at the links above." : "Claim the profile to add your work."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
