#!/usr/bin/env node
/**
 * Phase-A Library ingest — see docs/YOUTUBE-INGEST-PLAN.md §7.
 *
 * Reads data/channels.json, runs the Apify `streamers/youtube-channel-scraper`
 * actor over every channel, normalizes the result, and writes src/data/library.json
 * (committed) plus data/.raw-<runId>.json (gitignored, for correcting the field map).
 *
 *   APIFY_TOKEN=apify_api_… node scripts/ingest-youtube.mjs
 *
 * Flags:
 *   --source <api|rss|apify>  where the videos come from   (default api)
 *   --max <n>                 videos per channel           (default 12)
 *   --since <date>            only videos newer than this  (default 2025-01-01)
 *   --dry                     print the plan, call nothing
 *
 * Three sources, in the order you should reach for them:
 *
 *   api    YouTube Data API v3. Free (10,000 units/day, ~1 unit per call), and a
 *          strict superset of the others for our purposes: avatars + subscriber
 *          counts, real durations, and unlimited backfill. Needs YOUTUBE_API_KEY.
 *   rss    YouTube's public per-channel Atom feed. No key at all, but capped at 15
 *          recent uploads, no durations, no backfill. A zero-setup fallback.
 *   apify  streamers/youtube-channel-scraper. Costs money and is against YouTube's
 *          ToS. Kept for what the API genuinely can't do — transcripts, and the
 *          same actor family for Instagram/TikTok, which have no public API.
 *
 * Deliberately dependency-free — plain node, no packages to add to the app.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ACTOR = "streamers~youtube-channel-scraper"; // `~` is Apify's URL form of `/`
const API = "https://api.apify.com/v2";
const PRICE_PER_1K = 0.5;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const MAX_PER_CHANNEL = Number(flag("max", 12));
const SINCE = flag("since", "2025-01-01");
const SOURCE = flag("source", "api");
const DRY = args.includes("--dry");

if (!["api", "apify", "rss"].includes(SOURCE)) {
  console.error(`\n✗ --source must be "api", "apify" or "rss"\n`);
  process.exit(1);
}

/* ---------------------------------------------------------------- disciplines */

// Phase A is deterministic keyword matching. The LLM classifier lands in Phase C
// (plan §4 stage 4) — until then a miss falls back to the channel's hint, which is
// wrong less often than a guess.
const KEYWORDS = {
  Field: [
    "high jump", "long jump", "triple jump", "pole vault", "shot put", "discus",
    "javelin", "hammer throw", "heptathlon", "decathlon", "throws", "vaulter", "jumper",
  ],
  Trail: [
    "trail", "ultra", "utmb", "western states", "mountain", "50k", "100k", "100 mile",
    "skyrace", "vert", "fkt", "backyard ultra",
  ],
  Sprints: [
    "100m", "200m", "400m", "60m", "sprint", "relay", "4x100", "4x400", "hurdles",
    "dash", "blocks", "100 meter", "200 meter", "400 meter",
  ],
  Distance: [
    "800m", "1500m", "mile", "3000m", "5000m", "10000m", "5k", "10k", "marathon",
    "steeple", "cross country", "half marathon", "tempo", "long run", "800 meter",
    "1500 meter", "10,000", "5,000",
  ],
};

function scoreAgainst(text) {
  let best = null;
  let bestScore = 0;
  const hay = text.toLowerCase();
  for (const [discipline, words] of Object.entries(KEYWORDS)) {
    const score = words.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0);
    if (score > bestScore) {
      best = discipline;
      bestScore = score;
    }
  }
  return best;
}

// Title first, description only as a fallback — never summed. YouTube descriptions
// are long sponsor/link blobs, and letting them vote head-to-head with the title
// classified "Berlin Marathon Training Week 2" as Field off stray words 900
// characters down. The description is also truncated to the part above the fold.
function classify(title, description, hint) {
  return (
    scoreAgainst(title) ??
    scoreAgainst(String(description ?? "").slice(0, 400)) ??
    hint ??
    "Distance"
  );
}

/* ------------------------------------------------------------------- helpers */

// Apify actor output keys drift between actor versions, so read defensively and
// report anything we failed to map instead of silently shipping blank cards.
const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

function videoIdFrom(item) {
  const direct = pick(item, "videoId", "id");
  if (typeof direct === "string" && /^[\w-]{11}$/.test(direct)) return direct;
  const url = String(pick(item, "url", "videoUrl", "link") ?? "");
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function durationToSeconds(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return null;
  const parts = raw.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function toIsoDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function apify(path, init = {}) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const url = `${API}${path}${path.includes("?") ? "&" : "?"}token=${token}`;
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    throw new Error(`Apify ${path.split("?")[0]} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------- the run */

async function startRun(channels) {
  const input = {
    startUrls: channels.map((c) => ({ url: `${channelUrl(c)}/videos` })),
    maxResults: MAX_PER_CHANNEL,
    maxResultsShorts: 0, // open decision #1 — Shorts stay out of the Library for now
    maxResultStreams: 0,
    oldestPostDate: SINCE,
    sortVideosBy: "NEWEST",
  };
  const { data } = await apify(`/acts/${ACTOR}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data;
}

async function waitForRun(runId) {
  const TERMINAL = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];
  for (let i = 0; i < 120; i++) {
    const { data } = await apify(`/actor-runs/${runId}`);
    if (TERMINAL.includes(data.status)) return data;
    process.stdout.write(`\r  status: ${data.status} … ${i * 5}s`);
    await sleep(5000);
  }
  throw new Error("run did not finish within 10 minutes");
}

async function fetchDataset(datasetId) {
  const items = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await apify(
      `/datasets/${datasetId}/items?clean=true&format=json&limit=1000&offset=${offset}`
    );
    items.push(...page);
    if (page.length < 1000) return items;
  }
}

/* --------------------------------------------------------------- rss source */

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
const decode = (s) =>
  s.replace(/&(#?\w+);/g, (m, e) => XML_ENTITIES[e] ?? (e[0] === "#" ? String.fromCharCode(+e.slice(1)) : m));

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : undefined;
};

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; HouseOfTrack/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Not every channel has a handle — Josh Kerr and Marcus Milione are reachable only
// by channelId — so a seed row may carry either. The Atom feed wants channelId, so
// resolve it off the public channel page when only a handle is known.
async function resolveChannelId(channel) {
  if (channel.channelId) return channel.channelId;
  const html = await get(`https://www.youtube.com/@${channel.handle}`);
  const m = html.match(/"externalId":"(UC[\w-]{22})"/);
  if (!m) throw new Error(`could not resolve channelId for @${channel.handle}`);
  return m[1];
}

const channelLabel = (c) => (c.handle ? `@${c.handle}` : c.name ?? c.channelId);
const channelUrl = (c) =>
  c.handle
    ? `https://www.youtube.com/@${c.handle}`
    : `https://www.youtube.com/channel/${c.channelId}`;

// The Atom feed carries no duration and no type, so Shorts are indistinguishable
// from long-form in the XML. But /shorts/<id> only *stays* on /shorts/ for a real
// Short — anything else 302s to /watch. One HEAD-ish request per video, run in
// small batches. (On --source apify this is unnecessary: maxResultsShorts:0.)
async function isShort(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HouseOfTrack/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    return res.url.includes("/shorts/");
  } catch {
    return false; // network wobble shouldn't silently delete a video
  }
}

// Shorts can run up to 3 minutes, so duration alone can't decide it — a 2-minute
// race edit is not a Short. When we have durations (the api source), use them to
// split three ways: <=60s is a Short, >180s never is, and only the ambiguous band
// between pays for the redirect check. On --source rss there are no durations, so
// everything falls through to the network check.
const SHORT_CERTAIN = 60;
const SHORT_POSSIBLE = 180;

async function dropShorts(raw) {
  const kept = [];
  const ambiguous = [];

  for (const item of raw) {
    const d = item.durationSeconds;
    if (typeof d === "number") {
      if (d <= SHORT_CERTAIN) continue;
      if (d > SHORT_POSSIBLE) {
        kept.push(item);
        continue;
      }
    }
    ambiguous.push(item);
  }

  for (const batch of chunk(ambiguous, 8)) {
    const flags = await Promise.all(batch.map((item) => isShort(item.videoId)));
    batch.forEach((item, n) => {
      if (!flags[n]) kept.push(item);
    });
  }

  kept.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return { kept, checked: ambiguous.length };
}

async function fetchRss(channels) {
  const cutoff = new Date(SINCE).getTime();
  const raw = [];

  for (const channel of channels) {
    const label = channelLabel(channel);
    try {
      const channelId = await resolveChannelId(channel);
      const xml = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      const channelName = tag(xml, "title") ?? channel.name ?? label;

      const entries = xml.split("<entry>").slice(1).slice(0, MAX_PER_CHANNEL);
      let kept = 0;
      for (const entry of entries) {
        const published = tag(entry, "published");
        if (published && new Date(published).getTime() < cutoff) continue;
        raw.push({
          videoId: tag(entry, "yt:videoId"),
          title: tag(entry, "title"),
          channelName,
          channelUrl: channelUrl(channel),
          date: published,
          text: tag(entry, "media:description"),
          viewCount: Number(entry.match(/media:statistics views="(\d+)"/)?.[1]) || null,
          // Carry the seed row through so normalize() doesn't have to re-match it by
          // string — handle-less channels have nothing to match on.
          _seed: channel,
          // The Atom feed carries no duration — the card just omits the badge.
        });
        kept++;
      }
      console.log(`  ${label.padEnd(22)} ${kept}`);
    } catch (err) {
      console.log(`  ${label.padEnd(22)} ✗ ${err.message}`);
    }
  }
  return raw;
}

/* ------------------------------------------------- youtube data api source */

// The official API. Free, sanctioned, and a strict superset of the Atom feed:
// avatars and subscriber counts (which profile pages need), real durations, and
// backfill past the feed's hard cap of 15. Quota is 10,000 units/day and every
// call below costs 1 unit, so a full refresh of the roster is a rounding error.
// `search.list` is the only expensive method (100 units) and we never call it.
const YT = "https://www.googleapis.com/youtube/v3";
let quotaUnits = 0;

async function yt(path, params) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set (expected in .env.local)");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YT}/${path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
  quotaUnits += 1;
  const json = await res.json();
  if (json.error) {
    throw new Error(`${path} → ${json.error.code} ${json.error.message}`);
  }
  return json;
}

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// PT1H2M3S → 3723
function isoDurationToSeconds(iso) {
  const m = String(iso ?? "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

// channels.list takes up to 50 ids in one call, but forHandle resolves only one
// at a time — so batch the id-based rows and spend a single unit per handle.
async function resolveChannels(channels) {
  const resolved = new Map(); // seed -> channel resource
  const withId = channels.filter((c) => c.channelId);
  const withHandle = channels.filter((c) => !c.channelId && c.handle);
  const PART = "snippet,statistics,contentDetails";

  for (const batch of chunk(withId, 50)) {
    const { items = [] } = await yt("channels", {
      part: PART,
      id: batch.map((c) => c.channelId).join(","),
    });
    for (const seed of batch) {
      const found = items.find((i) => i.id === seed.channelId);
      if (found) resolved.set(seed, found);
    }
  }

  for (const seed of withHandle) {
    try {
      const { items = [] } = await yt("channels", { part: PART, forHandle: seed.handle });
      if (items[0]) resolved.set(seed, items[0]);
    } catch (err) {
      console.log(`  ${channelLabel(seed).padEnd(22)} ✗ ${err.message}`);
    }
  }
  return resolved;
}

async function fetchApi(channels) {
  const cutoff = new Date(SINCE).getTime();
  const resolved = await resolveChannels(channels);
  const raw = [];
  const creators = [];

  for (const [seed, ch] of resolved) {
    const label = channelLabel(seed);
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) {
      console.log(`  ${label.padEnd(22)} ✗ no uploads playlist`);
      continue;
    }

    creators.push({
      channelId: ch.id,
      name: ch.snippet.title,
      handle: seed.handle ?? ch.snippet.customUrl?.replace(/^@/, "") ?? null,
      url: channelUrl(seed),
      description: ch.snippet.description?.slice(0, 400) ?? null,
      avatar: ch.snippet.thumbnails?.high?.url ?? ch.snippet.thumbnails?.default?.url ?? null,
      subscriberCount: Number(ch.statistics?.subscriberCount) || null,
      videoCount: Number(ch.statistics?.videoCount) || null,
      kind: seed.kind ?? "media",
      // Everything below stays unclaimed until Phase D. A creator must be able to
      // opt out and have it survive the next ingest — see the plan's §5.
      claimState: "unclaimed",
    });

    // Page the uploads playlist. Stop at the per-channel cap or once we cross the
    // date cutoff — uploads come back newest-first, so the first old one ends it.
    const ids = [];
    let pageToken;
    let exhausted = false;
    while (ids.length < MAX_PER_CHANNEL && !exhausted) {
      const page = await yt("playlistItems", {
        part: "contentDetails",
        playlistId: uploads,
        maxResults: String(Math.min(50, MAX_PER_CHANNEL - ids.length)),
        ...(pageToken ? { pageToken } : {}),
      });
      for (const it of page.items ?? []) {
        const published = it.contentDetails?.videoPublishedAt;
        if (published && new Date(published).getTime() < cutoff) {
          exhausted = true;
          break;
        }
        ids.push(it.contentDetails.videoId);
      }
      pageToken = page.nextPageToken;
      if (!pageToken) exhausted = true;
    }

    // videos.list gives us what neither the playlist nor the Atom feed carries:
    // duration (hence Shorts), view counts, and the full description.
    let kept = 0;
    for (const batch of chunk(ids, 50)) {
      const { items = [] } = await yt("videos", {
        part: "snippet,contentDetails,statistics",
        id: batch.join(","),
      });
      for (const v of items) {
        raw.push({
          videoId: v.id,
          title: v.snippet.title,
          channelName: ch.snippet.title,
          channelUrl: channelUrl(seed),
          channelId: ch.id,
          date: v.snippet.publishedAt,
          text: v.snippet.description,
          viewCount: Number(v.statistics?.viewCount) || null,
          durationSeconds: isoDurationToSeconds(v.contentDetails?.duration),
          _seed: seed,
        });
        kept++;
      }
    }
    console.log(`  ${label.padEnd(22)} ${String(kept).padStart(3)}  ${(Number(ch.statistics?.subscriberCount) || 0).toLocaleString()} subs`);
  }

  return { raw, creators };
}

/* ---------------------------------------------------------------- normalize */

function normalize(raw, channels) {
  // Match scraped items back to the seed channel so we can carry kind + hint through.
  const byHandle = new Map(
    channels.filter((c) => c.handle).map((c) => [c.handle.toLowerCase(), c])
  );
  const findSeed = (item) => {
    if (item._seed) return item._seed; // rss path already knows
    const url = String(
      pick(item, "channelUrl", "channelUsername", "channelHandle", "channelName") ?? ""
    ).toLowerCase();
    for (const [handle, seed] of byHandle) {
      if (url.includes(handle)) return seed;
    }
    return null;
  };

  const seen = new Set();
  const items = [];
  const unmapped = [];

  for (const item of raw) {
    const videoId = videoIdFrom(item);
    if (!videoId || seen.has(videoId)) continue;

    const title = pick(item, "title", "name");
    // Shorts stay out of the Library (plan §9 decision 1). The Apify actor filters
    // them properly via maxResultsShorts:0; the Atom feed carries no duration and no
    // type, so on --source rss this hashtag check is all we have and some will slip
    // through. One more reason the paid path earns its keep.
    if (typeof title === "string" && /#shorts?\b/i.test(title)) continue;
    const channelName = pick(item, "channelName", "channelTitle", "author");
    if (!title || !channelName) {
      unmapped.push(item);
      continue;
    }

    seen.add(videoId);
    const seed = findSeed(item);
    const description = pick(item, "text", "description", "channelDescription");

    items.push({
      id: videoId,
      videoId,
      title: String(title).trim(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      discipline: classify(title, description, seed?.disciplineHint),
      // Who shot / made it. Free and always correct — it's the channel itself.
      creator: {
        name: String(channelName).trim(),
        handle: seed?.handle ?? null,
        url: pick(item, "channelUrl") ?? (seed ? `https://www.youtube.com/@${seed.handle}` : null),
        kind: seed?.kind ?? "media",
      },
      // Who's IN it. Needs the Phase-C classifier — blank beats a wrong name on
      // someone else's footage (plan §9 decision 3).
      athlete: null,
      publishedAt: toIsoDate(pick(item, "date", "uploadDate", "publishedAt", "publishDate")),
      durationSeconds: durationToSeconds(pick(item, "duration", "durationSeconds", "length")),
      viewCount: Number(pick(item, "viewCount", "views", "numberOfViews")) || null,
      kind: "video",
    });
  }

  items.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  // Round-robin by creator instead of straight reverse-chronological. Sorted purely
  // by date, whoever posts most that week owns the entire top row — which reads as a
  // wire feed, not a curated library of the sport's people. Recency still orders
  // within each creator.
  const queues = new Map();
  for (const item of items) {
    const key = item.creator.name;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(item);
  }
  const interleaved = [];
  while (interleaved.length < items.length) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) interleaved.push(next);
    }
  }

  return { items: interleaved, unmapped };
}

/* ------------------------------------------------------------------- main */

async function main() {
  const { channels } = JSON.parse(await readFile(join(ROOT, "data/channels.json"), "utf8"));
  const budget = channels.length * MAX_PER_CHANNEL;

  console.log(`\nHouse of Track — Library ingest`);
  console.log(`  source   : ${SOURCE}`);
  console.log(`  channels : ${channels.length}`);
  console.log(`  cap      : ${MAX_PER_CHANNEL}/channel → ${budget} videos max`);
  console.log(`  since    : ${SINCE}`);
  const COST = {
    api: "$0.00 (YouTube Data API free quota)",
    rss: "$0.00 (public Atom feeds)",
    apify: `$${((budget / 1000) * PRICE_PER_1K).toFixed(2)}`,
  };
  console.log(`  est. cost: ${COST[SOURCE]}\n`);

  if (DRY) {
    console.log("--dry — nothing called.\n");
    return;
  }

  let raw;
  let runId = null;
  let creatorRecords = [];

  if (SOURCE === "api") {
    const out = await fetchApi(channels);
    raw = out.raw;
    creatorRecords = out.creators;
    console.log(`\n  collected ${raw.length} items in ${quotaUnits} quota units of 10,000`);
    const before = raw.length;
    const { kept, checked } = await dropShorts(raw);
    raw = kept;
    console.log(
      `  dropped ${before - raw.length} Shorts (${checked} needed the redirect check), ${raw.length} left`
    );
  } else if (SOURCE === "rss") {
    raw = await fetchRss(channels);
    console.log(`\n  collected ${raw.length} items — checking for Shorts…`);
    const before = raw.length;
    const { kept } = await dropShorts(raw);
    raw = kept;
    console.log(`  dropped ${before - raw.length} Shorts, ${raw.length} left`);
  } else {
    console.log(`Starting ${ACTOR}…`);
    const run = await startRun(channels);
    runId = run.id;
    console.log(`  run: https://console.apify.com/actors/runs/${run.id}`);

    const finished = await waitForRun(run.id);
    process.stdout.write("\r".padEnd(40) + "\r");
    if (finished.status !== "SUCCEEDED") {
      throw new Error(`run ${finished.status} — check the console link above`);
    }

    raw = await fetchDataset(finished.defaultDatasetId);
    console.log(`  scraped ${raw.length} items`);
  }

  await mkdir(join(ROOT, "data"), { recursive: true });
  const rawPath = join(ROOT, `data/.raw-${runId ?? SOURCE}.json`);
  await writeFile(rawPath, JSON.stringify(raw, null, 2));

  const { items, unmapped } = normalize(raw, channels);

  const byDiscipline = items.reduce((acc, i) => {
    acc[i.discipline] = (acc[i.discipline] ?? 0) + 1;
    return acc;
  }, {});
  const channelNames = new Set(items.map((i) => i.creator.name));

  // Only keep creators that actually contributed a published item, so the roster
  // and the feed can't drift apart.
  const published = new Set(items.map((i) => i.creator.name));
  const creators = creatorRecords
    .filter((c) => published.has(c.name))
    .sort((a, b) => (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0));

  const SOURCE_LABEL = {
    api: "youtube:data-api-v3",
    rss: "youtube:atom-feed",
    apify: `apify:${ACTOR.replace("~", "/")}`,
  };

  await mkdir(join(ROOT, "src/data"), { recursive: true });
  await writeFile(
    join(ROOT, "src/data/library.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: SOURCE_LABEL[SOURCE],
        runId,
        quotaUnits: SOURCE === "api" ? quotaUnits : null,
        creators,
        items,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`\n  ✓ ${items.length} videos from ${channelNames.size} channels`);
  console.log(`    ${Object.entries(byDiscipline).map(([d, n]) => `${d} ${n}`).join(" · ")}`);
  if (creators.length) {
    const subs = creators.reduce((n, c) => n + (c.subscriberCount ?? 0), 0);
    console.log(`    ${creators.length} creator profiles · ${subs.toLocaleString()} combined subs`);
  }
  if (SOURCE === "api") {
    console.log(`    ${quotaUnits} quota units used of 10,000/day`);
  }
  console.log(`    → src/data/library.json`);
  if (unmapped.length) {
    console.log(`\n  ! ${unmapped.length} items had no title/channel — field map may need a fix.`);
    console.log(`    Sample keys: ${Object.keys(unmapped[0]).join(", ")}`);
    console.log(`    Raw dump: ${rawPath}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
