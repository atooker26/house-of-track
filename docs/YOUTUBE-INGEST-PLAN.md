# House of Track — YouTube Ingest via Apify

> Plan for filling the Library (Layer 1) and seeding the roster (§5 GTM) with real YouTube running/track creators. Extends `docs/PRODUCT-PLAN.md`; does not supersede it. Confidential.
>
> **Status (2026-08-06):** **Phase A shipped.** The Library on `/hub` now renders **148 real videos from 19 independent channels — 93 of them from pro athletes**, click-to-load embedded and credited. The 9 fake rows are gone. Built on the free source (`--source rss`) — no Apify spend yet, and the actor path is written and waiting on `APIFY_TOKEN`.
>
> **The finding that matters:** athlete channels are real and active, but **you cannot guess their handles.** Cole Hocker is `@thecolehocker` (`@ColeHocker` is a namesake), Clayton Young is `@_Clayton_Young_`, Max Jolliffe is `@woah_max` (`@woahmax` is a music channel), and Josh Kerr and Marcus Milione have **no handle at all** — only a channelId. A first pass that guessed handles produced a roster of sneaker vloggers and dormant strangers. Every row in `data/channels.json` was opened and read before it was added. This is the strongest argument in the doc for the paid discovery actor (§4 stage 1): the mapping from *athlete name* → *real channel* is the expensive part, and it is exactly what search-based discovery automates.

## 1. What this actually buys us

Two things, and the second one is worth more than the first.

**Library fill (the obvious one).** `PRODUCT-PLAN.md` §7 lists "wire Library to the real RSS + YouTube sheet" as the remaining Phase-0 work. Apify turns a list of channel URLs into credited, embeddable video metadata on a schedule. The `LIBRARY` array in `src/lib/hub.ts:18` becomes a real feed.

**Roster seeding (the one that matters).** §5 names the #1 risk as getting both sides to show up, and prescribes **claimable profiles** as the answer. Every channel we scrape yields a name, avatar, subscriber count, description, and social links — i.e. a populated *unclaimed* creator profile, ready to claim. Scraping 300 running channels doesn't just fill a grid; it stands up a 300-person roster with real work already highlighted, which is exactly the Bandit-model flywheel §5 describes. The Library becomes the highlight engine that makes claiming worth doing.

So: **ingest is a supply-side growth mechanism wearing a content-feed costume.** Build it for the profiles, and the feed comes free.

## 2. Apify vs. the official YouTube API — read this before committing

Worth being straight about, because it changes the shape of the build.

| | Apify | YouTube Data API v3 |
|---|---|---|
| Known-channel refresh (300 channels × 50 videos) | ~$7.50/mo | **Free** — ~600 of 10,000 daily quota units |
| Discovery by search | Unlimited, $2.40/1k results | **Hard wall** — `search.list` costs 100 units, so ~100 searches/day total |
| Shorts, streams, transcripts, channel social links | One call, one shape | Multiple calls, no transcripts |
| Instagram later (open decision #3) | Same platform, same pattern | **Does not exist** |
| Setup | API token, no quota math | OAuth/key + quota accounting + rotation |
| Terms of service | Against YouTube ToS | Sanctioned |

**Recommendation: hybrid, Apify-first.** Ship entirely on Apify — it's one integration, no quota engineering, and it's the only path that extends to Instagram when Layer 1 goes multi-platform. Then, once the channel list stabilizes past ~200, move the *boring daily refresh of already-approved channels* to the free official API and keep Apify for discovery, enrichment, backfill, and IG. That split puts spend only where the API genuinely can't compete.

**What Phase A actually shipped on:** a third source neither column above anticipated — YouTube's **public per-channel Atom feed** (`/feeds/videos.xml?channel_id=…`). No key, no quota, no ToS problem, and it carries title, videoId, publish date, description and view count for each channel's 15 most recent uploads. That was enough to fill the Library today for $0. Its ceilings are real and hit fast: 15 items per channel, no backfill, no duration, no discovery, no Shorts flag, no Instagram. It is the free floor, not a replacement for the paid path — `scripts/ingest-youtube.mjs` implements both behind `--source`.

**On ToS:** scraping YouTube violates YouTube's terms; Apify operates there regardless and this is normal practice, but it is a real (if low) platform risk, not a nonexistent one. The mitigation is the posture the product already has: HOT stores **metadata and video IDs only**, embeds via YouTube's own player, never downloads or re-hosts a frame. That keeps us inside the rights/trademark position §2 already claims. Keep it that way — the moment anyone suggests caching video files, this becomes a different legal conversation.

## 3. Actors to use

| Job | Actor | Price | Key input |
|---|---|---|---|
| Per-channel video pull (the workhorse) | [`streamers/youtube-channel-scraper`](https://apify.com/streamers/youtube-channel-scraper) | **$0.50 / 1k videos** | `startUrls`, `maxResults`, `maxResultsShorts`, `oldestPostDate`, `sortVideosBy: "NEWEST"` |
| Discovery by keyword | [`streamers/youtube-scraper`](https://apify.com/streamers/youtube-scraper) | $2.40 / 1k videos | `searchQueries`, `dateFilter`, `maxResults` |

Apify's free tier is $5/mo credit. Realistic steady state:

- 300 channels × 25 new videos/refresh, weekly → 30k videos/mo → **$15/mo**
- Discovery: 40 queries × 100 results, weekly → 16k results/mo → **$38/mo**
- One-time backfill: 300 channels × 200 videos → 60k → **$30 once**

**~$55/mo at full tilt, under $10/mo if discovery runs monthly instead of weekly.** Not a budget line anyone needs to argue about. Start on the free tier — the first 10k results are covered.

## 4. Pipeline

```
David's YouTube Sheet ─┐
                       ├─► sources ──► [Apify: channel-scraper] ──► webhook /api/ingest/apify
Discovery queue ───────┘                    (daily/weekly)                    │
     ▲                                                                        ▼
     │                                                             fetch dataset items
[Apify: youtube-scraper] ◄── weekly, meet + discipline queries                │
     (candidates, human-approved)                                             ▼
                                                              normalize → classify (LLM)
                                                                              │
                                              ┌───────────────────────────────┤
                                              ▼                               ▼
                                      library_items                      creators
                                    (embed + credit)              (unclaimed → claimed)
                                              │                               │
                                              └──────► updateTag('library') ◄─┘
                                                              │
                                                    /hub Library, click-to-load embeds
```

### Stage detail

**0 — Sources.** David's YouTube Google Sheet (his §8 action item) is the seed. One-time import into a `sources` table: `channel_url`, `kind` (athlete / creative / media), `discipline_hint`, `approved_by`, `added_at`. Sheet stays the human-editable front door; the table is what the scheduler reads.

**1 — Discovery (weekly).** `streamers/youtube-scraper` with `searchQueries` generated from what we already have: the five meets in `MEETS` (`src/lib/hub.ts:41`), the four disciplines, plus athlete and creator names already in the system. Results roll up channel-by-channel into a `channel_candidates` table with counts and sample videos.

> **Discovery output is never auto-published.** It lands in an approval queue — one screen, approve/reject, David or Aidan clears it in ten minutes a week. "Running" as a search term drags in marathon vlogs, shoe reviews, and gym content; a curated library that quietly stops being curated is the failure mode that kills Layer 1.

**2 — Ingest (daily or weekly).** `streamers/youtube-channel-scraper`, `startUrls` = approved sources, `oldestPostDate` = last successful run's timestamp so each run is incremental. Driven by an **Apify Schedule** (their cron), not a Vercel cron — the run is long and async, and Apify already owns retry/concurrency.

**3 — Webhook.** Apify fires `ACTOR.RUN.SUCCEEDED` at `POST /api/ingest/apify`. Payload is `{ userId, createdAt, eventType, eventData, resource }` where `resource` is the run object, carrying `defaultDatasetId`. Auth via Apify's **headers template** with a shared secret — mirror the `X-Webhook-Secret` pattern already in `src/app/api/join/route.ts:40`. Handler pages the dataset:

```
GET https://api.apify.com/v2/datasets/{defaultDatasetId}/items?token=…&clean=true&limit=1000&offset=…
```

Paginate on `X-Apify-Pagination-Total`. Record every run in `ingest_runs` (dataset id, counts, errors) — without it, debugging a bad feed is guesswork.

**4 — Normalize + classify.** Map raw items onto `LibraryItem`. Two fields can't be scraped and need an LLM pass over title + description (AI Gateway, cheap model, **keyed by `video_id` so each video is classified exactly once, ever**):

- `discipline` — Sprints / Distance / Field / Trail, matching the existing `Discipline` union.
- `athlete` — who's *in* it. Hardest field. Expect ~70% on titles alone. Mitigate by matching against a known-athlete list first (exact-match beats inference), LLM only as fallback, and leave it nullable rather than let it hallucinate a name onto someone else's footage.
- `relevance` — is this actually track/running? Drop anything below threshold. A runner's channel is not 100% running content.

`creator` is free — it's the channel name, and that's the correct credit.

**5 — Publish.** Next 16 Cache Components: the Library read is `use cache` + `cacheTag('library')`; ingest calls `updateTag('library')`. Feed is static-fast, updates the moment a run lands, no rebuild.

**6 — Render.** Store `video_id` + thumbnail URL. **Click-to-load embeds** — render the thumbnail, swap in the `<iframe>` on click. Nine live YouTube iframes on `/hub` would wreck the page's Core Web Vitals for zero benefit. Add `i.ytimg.com` to `remotePatterns` in `next.config.ts:5`.

## 5. Data model

Extends the spine in `PRODUCT-PLAN.md` §4 — deliberately the same `unclaimed → claimed` shape, so ingest-created profiles and signup-created profiles are one table, not two.

```
sources            id, channel_url, channel_id, kind, discipline_hint, active, added_at
channel_candidates id, channel_url, found_via_query, sample_videos, status(pending/approved/rejected)
creators           id, channel_id, name, handle, avatar_url, subscriber_count, links,
                   claim_state(unclaimed|invited|claimed), claimed_by_user_id, opted_out_at
library_items      id, video_id, source_id, creator_id, title, published_at, duration,
                   thumbnail_url, view_count, kind(video|short|stream),
                   discipline, relevance_score, status(pending|published|hidden)
item_athletes      library_item_id, athlete_name, athlete_profile_id?, confidence
ingest_runs        id, actor, dataset_id, started_at, items_in, items_published, error
```

`opted_out_at` is not optional. A creator emailing "take my stuff down" must be one click, permanent, and must survive the next scrape — an ingest that re-adds someone who asked to leave is the single fastest way to burn goodwill with the exact people we're recruiting.

## 6. Storage

The repo has no database today — `package.json` is next/react/react-dom, and `/api/join` forwards to a TEGO webhook. This is the moment to stand one up.

**Recommend Supabase**, via `vercel integration add supabase`. Reasons, in order:

1. TEGO already runs Supabase across a dozen projects — same org, same tooling, zero new operational surface.
2. Phase 1 (`PRODUCT-PLAN.md` §7) needs **auth** (claim a profile), **private file storage** (JPEG uploads), and **Postgres** in one system. Provisioning Postgres alone now means adding two more services in six weeks.
3. Row-level security is the right primitive for the biometric-consent gate §4 calls the legally-loaded piece.

Neon is the lighter option if this stays feed-only forever. It won't.

## 7. Phasing

| Phase | Scope | Outcome |
|---|---|---|
| **A — Prove it** ✅ **shipped** | Verified channel list, `scripts/ingest-youtube.mjs` (both `--source rss` and the Apify actor path), normalized JSON at `src/data/library.json`, real embeds in `LibraryPreview.tsx` | **148 real videos live on `/hub`, placeholders gone.** No database, no spend. |
| **B — Automate (3–4 days)** | Supabase, schema above, `/api/ingest/apify` webhook, Apify Schedule, `updateTag` wiring | Feed refreshes itself. Placeholder data gone for good. |
| **C — Scale + curate (3–4 days)** | Discovery actor, candidate approval screen, LLM classification, relevance filter | 300+ channels, still curated. |
| **D — Claim (1 week)** | Public creator profiles from ingested data, claim flow + auth, opt-out, outreach batch | The roster becomes real people. Feeds directly into Phase 1. |

Phase A is worth doing on its own this week — it kills the fake data on a live production page and costs nothing.

## 8. Owners

| Owner | Action |
|---|---|
| **David** | Deliver the YouTube-links sheet (already his §8 item); clear the weekly discovery queue |
| **Aidan** | Phases A–C: actors, webhook, schema, Library wiring |
| **Technical partner** | Phase D — claim flow overlaps their profile/auth work; don't build it twice |

## 9. Open decisions

1. ~~**Shorts in or out?**~~ **Resolved: out.** They were ~28% of everything pulled (57 of 205) and they render as letterboxed vertical slivers in a 16:9 grid. The Atom feed exposes no duration and no type, so Phase A detects them by checking whether `youtube.com/shorts/<id>` *stays* on `/shorts/` instead of 302-ing to `/watch`. The Apify actor does this properly with `maxResultsShorts: 0` — one concrete thing the paid path buys.
2. **Discovery cadence** — weekly at ~$38/mo, or monthly at ~$10/mo. Monthly until the approval queue proves it's producing keepers.
3. **Athlete tagging bar** — publish with a blank athlete field, or hold items until a human confirms? Blank-and-publish is the right call for volume; the field is a credit, not a claim. (Phase A ships every item with `athlete: null` — on an athlete-owned channel the creator credit *is* the athlete, so the gap is smaller than it looks.)

6. **Sam Parsons has no findable YouTube channel** — `@sam_parsons` is a sneaker channel dormant since 2017. He's Instagram/podcast-first, which is the shape of the multi-platform problem: the roster we want is not all on one platform. Worth confirming with David whether the Library targets people or targets YouTube.
4. **Outreach on claim** — email, IG DM, or both? Determines whether we need to scrape contact info at all (Apify returns channel social links, which may be enough).
5. **Does the ingest feed the weekly recap email** (§5's "churning machine")? If yes, `library_items` needs a `featured_in_digest_at` column from the start.
