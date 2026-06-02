import { RSS_API, spotifyUrlFor, coverFor, SPOTIFY_EP } from "./constants";

export interface Episode {
  n: string;
  epNum: number;
  title: string;
  guest: string;
  disc: string;
  len: string;
  date: string;
  blurb: string;
  notes: string;
  tags: string[];
  live: boolean;
  spotifyUrl: string;
  image: string;
  slug: string;
}

function strip(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function fmtDate(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtLen(secs: number): string {
  if (!secs) return "";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function epNumFrom(title: string): number | null {
  const m = title.match(/Episode\s*(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

function splitGuest(raw: string): { guest: string; title: string } {
  const m = raw.split(/\s[—–-]\s/);
  if (m.length >= 2) {
    return {
      guest: m[0].replace(/^Episode\s*\d+\s*/i, "").trim(),
      title: m.slice(1).join(" — ").trim(),
    };
  }
  return { guest: "", title: raw.replace(/^Episode\s*\d+[:.\s]*/i, "").trim() || raw };
}

function slugify(title: string, n: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${n}-${base}`;
}

async function spotifyThumb(n: number): Promise<string | null> {
  const id = SPOTIFY_EP[n];
  if (!id) return null;
  try {
    const r = await fetch(
      `https://open.spotify.com/oembed?url=https://open.spotify.com/episode/${id}`
    );
    const d = await r.json();
    return d.thumbnail_url || null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadEpisodes(): Promise<Episode[]> {
  try {
    const res = await fetch(RSS_API, { next: { revalidate: 300 } });
    const data = await res.json();
    if (data.status !== "ok" || !data.items?.length) throw new Error("rss");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eps: Episode[] = data.items.map((item: any, i: number) => {
      const rawTitle = (item.title || "").replace(/&amp;/g, "&");
      const n = epNumFrom(rawTitle) || (data.items.length - i);
      const { guest, title } = splitGuest(rawTitle);
      const desc = strip(item.description || "");
      return {
        n: String(n),
        epNum: n,
        title,
        guest,
        disc: "Track & Field",
        len: fmtLen(item.enclosure?.duration || 0),
        date: fmtDate(item.pubDate),
        blurb: desc.slice(0, 150),
        notes: desc.slice(0, 600),
        tags: [],
        live: i === 0,
        spotifyUrl: spotifyUrlFor(n),
        image:
          item.thumbnail || item.enclosure?.thumbnail || data.feed?.image || coverFor(n),
        slug: slugify(title, String(n)),
      };
    });

    const thumbPromises = eps.map((e) => spotifyThumb(e.epNum));
    const thumbs = await Promise.allSettled(thumbPromises);
    eps.forEach((e, i) => {
      const result = thumbs[i];
      if (result.status === "fulfilled" && result.value) {
        e.image = result.value;
      }
    });

    return eps;
  } catch (e) {
    console.warn("HOT: live feed unavailable —", e);
    return [];
  }
}
