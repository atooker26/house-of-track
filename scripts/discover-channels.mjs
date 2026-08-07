#!/usr/bin/env node
/**
 * Find candidate channels for the roster. See docs/YOUTUBE-INGEST-PLAN.md §4.
 *
 *   YOUTUBE_API_KEY=… node scripts/discover-channels.mjs
 *
 * Flags:
 *   --queries <n>   how many search terms to run   (default 12)
 *   --min-subs <n>  ignore channels below this     (default 2000)
 *   --since <date>  ignore channels with no upload since (default 12 months ago)
 *   --dry           list the queries and cost, call nothing
 *
 * WRITES A REVIEW QUEUE, NEVER THE ROSTER. Output goes to data/candidates.json for
 * a human to approve into data/people.json. "Running" as a search term drags in shoe
 * reviews, gym content and marathon-tourism vlogs; a curated library that quietly
 * stops being curated is the failure mode that kills Layer 1.
 *
 * Every candidate carries the evidence needed to spot the two failure modes that
 * actually bit us: NAMESAKES (right name, wrong person — @GrantFisher has 803 subs
 * and reviews nothing; @sam_parsons posts sneaker unboxings) and DORMANT channels
 * (right person, last upload 2024). Hence subs, last-upload date and sample titles
 * on every row.
 *
 * search.list costs 100 quota units per call — by far the most expensive thing we
 * do, and the reason discovery is a deliberate, occasional run rather than part of
 * the daily refresh.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const YT = "https://www.googleapis.com/youtube/v3";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};
const MAX_QUERIES = Number(flag("queries", 12));
const MIN_SUBS = Number(flag("min-subs", 2000));
const DRY = args.includes("--dry");
const FROM_CACHE = args.includes("--from-cache");
const SINCE = flag(
  "since",
  new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)
);

// Deliberately biased toward people who make content about competing, not toward
// gear reviews or general fitness. Ordered most- to least-precise.
const QUERIES = [
  "professional runner vlog",
  "track and field vlog",
  "pro track athlete training vlog",
  "elite distance runner vlog",
  "marathon training vlog",
  "trail running vlog",
  "steeplechase training",
  "sprinter training vlog",
  "collegiate track athlete vlog",
  "cross country training vlog",
  "olympic runner vlog",
  "track meet vlog",
  "1500m training",
  "running training log",
  "athletics training vlog",
];

// Channels whose content is about running but which are media orgs, brands, or
// aggregators — not claimable people. Cheap pre-filter on the name.
const NOT_A_PERSON =
  /flotrack|world athletics|usatf|letsrun|citius|olympic(s|\s|$)|nbc|espn|world championship|athletics weekly|diamond league|academy|federation|league|university|college athletics|\btv\b|network|magazine|podcast network|shop|store|nike|adidas|hoka|brooks|asics|puma|new balance|on running|garmin|coros|strava/i;

// Word-boundaried on purpose. Without \b, "track" matched "@thetimtracker" — a theme
// park vlogger — and "run" matches half the dictionary. The first pass returned a
// Universal Studios channel and an off-road truck channel in the top five.
const RELEVANT =
  /\b(run|runs|running|runner|runners|track|athlete|athletes|athletics|marathon|sprint|sprinter|distance|trail|ultra|ultramarathon|steeplechase|cross[- ]country|5k|10k|mile|miler|1500m|800m|racing)\b/i;

let quota = 0;
async function yt(path, params, cost) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set (expected in .env.local)");
  const res = await fetch(`${YT}/${path}?${new URLSearchParams({ ...params, key })}`, {
    signal: AbortSignal.timeout(20_000),
  });
  quota += cost;
  const json = await res.json();
  if (json.error) throw new Error(`${path} → ${json.error.code} ${json.error.message}`);
  return json;
}

const chunk = (a, n) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const queries = QUERIES.slice(0, MAX_QUERIES);

async function main() {
  const { people } = JSON.parse(await readFile(join(ROOT, "data/people.json"), "utf8"));

  // Already on the roster, or previously opted out. Opted-out people must never
  // resurface through discovery — that's the whole point of the tombstone.
  const known = new Set();
  for (const p of people) {
    if (p.accounts?.youtube?.channelId) known.add(p.accounts.youtube.channelId);
    if (p.accounts?.youtube?.handle) known.add("@" + p.accounts.youtube.handle.toLowerCase());
    known.add(p.name.toLowerCase());
  }

  
  console.log(`\nHouse of Track — channel discovery`);
  console.log(`  queries  : ${queries.length}`);
  console.log(`  min subs : ${MIN_SUBS.toLocaleString()}`);
  console.log(`  active   : uploaded since ${SINCE}`);
  console.log(`  est. cost: ${queries.length * 100} units of 10,000/day (search.list is 100 each)\n`);

  if (DRY) {
    queries.forEach((q) => console.log(`  · ${q}`));
    console.log("\n--dry — nothing called.\n");
    return;
  }

  // Search is the expensive step, so its raw output is cached. Filter tuning is
  // guesswork the first time — the first pass surfaced a theme-park vlogger and an
  // off-road truck channel — and re-running the search to test a regex change would
  // burn 1,200 units a go.
  const CACHE = join(ROOT, "data/.raw-discovery.json");
  let found = new Map();
  let channels = [];

  if (FROM_CACHE) {
    const cached = JSON.parse(await readFile(CACHE, "utf8"));
    channels = cached.channels;
    found = new Map(Object.entries(cached.foundVia).map(([k, v]) => [k, new Set(v)]));
    console.log(`  (from cache: ${channels.length} hydrated channels, 0 units)\n`);
    return finish(channels, found, known);
  }

  // 1. Search (100 units each). Collect channel ids + which query surfaced them;
  //    a channel found by several queries is a stronger signal than one found once.
  for (const q of queries) {
    try {
      const { items = [] } = await yt(
        "search",
        { part: "snippet", type: "channel", q, maxResults: "50", relevanceLanguage: "en" },
        100
      );
      for (const it of items) {
        const id = it.snippet?.channelId ?? it.id?.channelId;
        if (!id) continue;
        if (!found.has(id)) found.set(id, new Set());
        found.get(id).add(q);
      }
      console.log(`  ${String(items.length).padStart(3)} results  ${q}`);
    } catch (err) {
      console.log(`    ✗ ${q} — ${err.message}`);
      if (/quota/i.test(err.message)) break;
    }
  }

  const ids = [...found.keys()].filter((id) => !known.has(id));
  console.log(`\n  ${found.size} distinct channels, ${ids.length} not already on the roster`);

  // 2. Hydrate (1 unit per 50). Subs, video count, description, uploads playlist.
  for (const batch of chunk(ids, 50)) {
    const { items = [] } = await yt(
      "channels",
      { part: "snippet,statistics,contentDetails", id: batch.join(",") },
      1
    );
    channels.push(...items);
  }

  await writeFile(
    CACHE,
    JSON.stringify(
      { channels, foundVia: Object.fromEntries([...found].map(([k, v]) => [k, [...v]])) },
      null,
      2
    )
  );

  return finish(channels, found, known);
}

// Everything from here down is pure filtering plus the recency probe, so it can be
// re-run from cache while tuning the regexes above.
async function finish(channels, found, known) {
  // 3. Filter on the cheap signals before spending a unit each on recency.
  const shortlist = channels.filter((c) => {
    const subs = Number(c.statistics?.subscriberCount) || 0;
    const name = c.snippet.title;
    // Dedupe by handle too, not just channelId and name. Roster rows keyed by
    // handle carry no channelId, and the channel *title* rarely matches the
    // person's name ("HellahGood" vs "Hellah Good"), so both slipped through.
    const handle = (c.snippet.customUrl ?? "").replace(/^@/, "").toLowerCase();
    if (handle && known.has("@" + handle)) return false;
    if (known.has(name.toLowerCase())) return false;
    if (subs < MIN_SUBS) return false;
    if (NOT_A_PERSON.test(name)) return false;
    if (!RELEVANT.test(`${name} ${c.snippet.description ?? ""}`)) return false;
    return Number(c.statistics?.videoCount) > 0;
  });
  console.log(`  ${shortlist.length} pass subs/relevance/not-a-brand`);

  // 4. Recency — the dormancy check. 1 unit each, so it runs last on the shortlist.
  const cutoff = new Date(SINCE).getTime();
  const candidates = [];
  for (const c of shortlist) {
    const uploads = c.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) continue;
    try {
      const { items = [] } = await yt(
        "playlistItems",
        { part: "snippet,contentDetails", playlistId: uploads, maxResults: "3" },
        1
      );
      const last = items[0]?.contentDetails?.videoPublishedAt;
      if (!last || new Date(last).getTime() < cutoff) continue;
      candidates.push({
        channelId: c.id,
        name: c.snippet.title,
        handle: c.snippet.customUrl?.replace(/^@/, "") ?? null,
        url: c.snippet.customUrl
          ? `https://www.youtube.com/${c.snippet.customUrl}`
          : `https://www.youtube.com/channel/${c.id}`,
        subscriberCount: Number(c.statistics.subscriberCount) || null,
        videoCount: Number(c.statistics.videoCount) || null,
        lastUpload: last,
        description: (c.snippet.description ?? "").slice(0, 220),
        foundVia: [...found.get(c.id)],
        // The human check: do these titles look like the sport, or like a namesake?
        sampleTitles: items.map((i) => i.snippet.title).slice(0, 3),
        status: "pending",
      });
    } catch {
      // skip channels whose uploads playlist won't load
    }
  }

  candidates.sort((a, b) => (b.subscriberCount ?? 0) - (a.subscriberCount ?? 0));

  await writeFile(
    join(ROOT, "data/candidates.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        quotaUnits: quota,
        queries,
        filters: { minSubs: MIN_SUBS, activeSince: SINCE },
        candidates,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`\n  ✓ ${candidates.length} candidates → data/candidates.json`);
  console.log(`    ${quota} quota units used\n`);
  candidates.slice(0, 15).forEach((c) =>
    console.log(
      `    ${String(c.subscriberCount ?? 0).padStart(9)}  ${(c.handle ? "@" + c.handle : c.name).padEnd(26)} ${c.sampleTitles[0]?.slice(0, 46) ?? ""}`
    )
  );
  console.log(`\n  Review, then promote keepers into data/people.json by hand.\n`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
