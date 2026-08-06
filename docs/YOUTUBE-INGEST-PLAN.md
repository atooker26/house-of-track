# House of Track — The Library & Creator Roster

> How the Library (Layer 1) gets filled and how the claimable roster (§5 GTM) gets seeded. Extends `docs/PRODUCT-PLAN.md`; does not supersede it. Confidential.
>
> Originally written as an Apify plan. It isn't one any more — see §2. Retitled accordingly.

> **Status (2026-08-06) — shipped, on branch `feat/library-youtube-ingest`:**
> - **The Library** on `/hub`: **148 real videos from 19 channels**, click-to-load embedded and credited, never re-hosted. The 9 placeholder rows are gone.
> - **29 creator pages** at `/creators/<slug>`, each anchored on the person's House of Track episode.
> - **19 unclaimed creator profiles**, 3.24M combined subscribers, with avatars and reach.
> - **Opt-out** that survives re-ingest.
> - Cost so far: **$0.** A full roster refresh is 58 quota units of the 10,000/day free allowance.

## 1. What this actually buys us

Two things, and the second is worth more.

**Library fill (the obvious one).** `PRODUCT-PLAN.md` §7 listed "wire Library to the real RSS + YouTube sheet" as remaining Phase-0 work. Done.

**Roster seeding (the one that matters).** §5 names the #1 risk as getting both sides to show up, and prescribes **claimable profiles** as the answer. Each ingested channel yields a name, avatar, subscriber count and body of work — a populated *unclaimed* profile, ready to claim. The Library is the highlight engine that makes claiming worth doing.

So: **ingest is a supply-side growth mechanism wearing a content-feed costume.** Build it for the profiles; the feed comes free.

## 2. Which source, and why it isn't Apify

The original recommendation here was "Apify-first." That was wrong, and the quota math is why.

| | YouTube Data API v3 | Atom feed | Apify |
|---|---|---|---|
| Cost | **Free** — 10,000 units/day, ~1 unit/call | Free | $0.50–2.40 / 1k results |
| Full roster refresh | **58 units (0.6%)** | free | ~$1 |
| Avatars + subscriber counts | **yes** | no | yes |
| Durations | yes | no | yes |
| Backfill | unlimited | **15/channel cap** | unlimited |
| Discovery by search | 100 searches/day | no | unlimited |
| Transcripts | no | no | **yes** |
| Instagram / TikTok | **no** | no | **yes** |
| Terms of service | sanctioned | sanctioned | against YouTube ToS |
| Setup | API key, no OAuth | nothing | API token |

**The reversal:** the earlier case for Apify leaned on `search.list` costing 100 units, capping discovery at ~100 searches/day. True, but overweighted — our discovery need is a few hundred **one-time** athlete lookups, not continuous crawling. That's two or three days of free quota, not a wall. Everything else the API does better and free.

**Current setup.** Google Cloud project `house-of-track` (under `aidan@tegomarketing.com`), YouTube Data API v3 enabled, key restricted to that API alone, stored as `YOUTUBE_API_KEY` in `.env.local` (gitignored). `--source api` is the default.

`scripts/ingest-youtube.mjs` implements all three behind `--source`:
- **`api`** (default) — the real one.
- **`rss`** — zero-setup fallback, no key at all. Capped at 15 recent uploads, no durations.
- **`apify`** — written and untested against live actor output. Kept for what the API genuinely can't do: transcripts, and Instagram/TikTok when Layer 1 goes multi-platform. **That's the only reason to ever pay.**

**On ToS:** the API path is sanctioned, so this is no longer a live concern. It becomes one again the moment anyone enables `--source apify`. Either way the product posture holds: HOT stores **metadata and video IDs only** and embeds via YouTube's own player. The moment anyone proposes caching video files, this becomes a different legal conversation.

## 3. The roster is people, not channels

The most important structural decision here, and it was forced by data rather than taste.

Of **8 podcast guests** and **18 YouTube creators**, exactly **one person is both** (Josh Kerr). Five guests have no YouTube channel at all; three have empty auto-created ones (0 subs, 0 videos). Keyed on channels, **7 of the 8 people House of Track actually has a relationship with would have had no page.**

So `data/people.json` is keyed by person, and platform accounts hang off them:

```
person: Cole Hocker    accounts: youtube @thecolehocker · faves @colehocker
person: Josh Kerr      episode #6 · youtube UCm3ERq… (no handle)
person: Trevor Bassitt episode #8 · (no accounts yet)
```

### Handles cannot be guessed

This bit everything, repeatedly. Cole Hocker is `@thecolehocker` on YouTube but `@colehocker` on Faves. `@ColeHocker`, `@JoeKlecker`, `@ClaytonYoung`, `@SamParsons`, `@connormantz` and `@woahmax` are all namesakes or dead channels — sneaker unboxings, fountain-pen reviews, a music channel. `@GrantFisher` has 803 subscribers and is not the medallist. Josh Kerr and Marcus Milione have **no handle at all**, only a channelId.

**The person → platform-handle mapping is the scarce asset in this project.** `data/people.json` stores it; nothing re-derives it. Every row was opened and read before it was added. This is also the strongest argument for paid discovery later — that mapping is exactly what search-based discovery automates.

## 4. Creator pages, anchored on the podcast

`/creators/<slug>`, 29 pages prerendered. Order matters:

1. **Hero** — avatar, discipline, reach, outbound links, "claim this profile".
2. **The House of Track episode**, when they have one. This is the point of the page.
3. **Their work** — their Library items.
4. **Opt-out** (§5).

The podcast is the only asset HOT owns that nobody else has, and it was siloed at `/episodes`. Leading with it does four things: it makes the page worth *claiming* (a page mirroring someone's YouTube is mildly useful to them; a page leading with their episode is their hub), it creates a flywheel when they share it, it turns the roster into the podcast's distribution, and it upgrades the ask for the next guest from "come on the pod" to "come on the pod, and here's the page you get."

Both halves degrade cleanly: Marquis Dendy has an episode and no video; kofuzi has 12 videos and no episode. Neither renders an empty section.

Marquis Dendy also closed the **Field** gap — he's a long jumper, so that discipline now has a real person behind it.

## 5. Opt-out

Every profile is built from public data about someone who never asked for it, as an act of recruitment. That needs a graceful no.

**The half that matters is the ingest, not the page.** Removal used to mean deleting a row from `people.json` — but the roster is rebuilt by an automated pipeline, so a later discovery pass or a re-import of David's sheet would silently put them back. `optedOut: true` is therefore a **tombstone**: the row stays, and the flag is honoured on every future run.

- `lib/people.ts` filters opted-out people at the `PEOPLE` export, not per call site, so a new page can't forget the check.
- The ingest never fetches them, and **logs the count every run** — a silent exclusion is indistinguishable from a bug.
- `RemovalRequest` on each profile posts to the existing TEGO webhook as `profile-removal`, so requests land in the same inbox as the join forms.

Verified by flagging one person: 148 items → 138, 19 profiles → 18, page no longer generated. Flag then reverted.

Note this is *not* the same category as the biometric-consent gate in `PRODUCT-PLAN.md` §4. Face recognition on photos is genuinely legally loaded; embedding public videos with credit is not. Don't conflate them.

## 6. Pipeline

```
data/people.json ──► channels with accounts.youtube
        │
        ▼
  channels.list ──► avatar, subs, uploads playlist   (1 unit / 50 channels)
        │
        ▼
  playlistItems.list ──► video ids, paged to cap/date  (1 unit / 50)
        │
        ▼
  videos.list ──► duration, views, description         (1 unit / 50)
        │
        ├──► Shorts filter: <=60s dropped, >180s kept,
        │    only the 60–180s band pays for a network check
        ▼
  classify (keyword; LLM in Phase C) ──► interleave by creator
        │
        ├──► src/data/library.json { creators[], items[] }
        ▼
  /hub Library  +  /creators/<slug>
```

**Shorts.** Resolved: out. They were 57 of 205 items and render as letterboxed slivers in a 16:9 grid. Shorts can run to 3 minutes, so duration alone can't decide it — hence the three-way split above, which costs 14 network checks instead of 205.

**Classification.** Title decides; description is only a fallback. Summing both let long sponsor blobs outvote titles and filed "Berlin Marathon Training Week 2" as **Field**. The LLM classifier is Phase C.

**Ordering.** Round-robin by creator, not reverse-chronological — sorted purely by date, whoever posts most that week owns the entire top row, which reads as a wire feed rather than a curated library.

**Rendering.** Click-to-load embeds; the iframe only mounts on click. Two image decisions that look contradictory but aren't:
- **Video thumbnails: unoptimized.** Already CDN-sized; 148 optimizer transforms cost money for no gain and saturate the dev optimizer badly enough that cards fail to paint.
- **Creator avatars: optimized.** `yt3.ggpht.com` is blocked outright by common privacy extensions, so a direct `<img>` shows an empty circle for those visitors. Serving via `/_next/image` makes it same-origin. ~19 avatars, so the transform cost is negligible. **Volume is what flips the decision.**

## 7. Data model (for Phase B, when Postgres lands)

Extends the spine in `PRODUCT-PLAN.md` §4 — deliberately the same `unclaimed → claimed` shape, so ingest-created and signup-created profiles are one table.

```
people             id, slug, name, kind, discipline, podcast_episode, opted_out_at
accounts           person_id, platform(youtube|instagram|faves|tiktok), handle, channel_id
creators           person_id, avatar_url, subscriber_count, video_count,
                   claim_state(unclaimed|invited|claimed), claimed_by_user_id
library_items      id, video_id, person_id, title, published_at, duration, thumbnail_url,
                   view_count, kind, discipline, relevance_score, status
item_athletes      library_item_id, athlete_name, person_id?, confidence
channel_candidates id, url, found_via_query, sample_videos, status
ingest_runs        id, source, started_at, items_in, items_published, quota_units, error
```

`opted_out_at` is not optional — see §5.

## 8. Storage

Still no database; `library.json` is a committed snapshot. That works at 148 items and stops working somewhere in the low hundreds, where every refresh becomes a multi-thousand-line diff.

**Recommend Supabase** when it's time, via `vercel integration add supabase`:
1. TEGO already runs Supabase across a dozen projects — same org, same tooling.
2. Phase 1 needs **auth** (claim a profile), **private file storage** (JPEG uploads) and **Postgres** in one system.
3. RLS is the right primitive for the biometric-consent gate.

## 9. Phasing

| Phase | Scope | State |
|---|---|---|
| **A — Prove it** | Verified roster, ingest script, real embeds on `/hub` | ✅ **shipped** |
| **A2 — Official API** | `--source api`, avatars + subs + durations + backfill, 58 units/run | ✅ **shipped** |
| **A3 — Creator pages** | Person-centric roster, `/creators/<slug>`, podcast anchor, opt-out | ✅ **shipped** |
| **B — Kill the staleness** | Vercel Cron → ingest → Blob, `cacheTag`/`updateTag`. **Postgres deferred** — the snapshot works until claiming introduces writes | next |
| **C — Scale + curate** | Roster expansion, candidate approval screen, LLM classification + relevance filter | |
| **D — Claim** | Auth, claim flow, creators supply their own socials, outreach batch | |

**The most urgent gap is B.** `library.json` is frozen at its last run; nothing refreshes it, and staleness degrades silently.

## 10. Owners

| Owner | Action |
|---|---|
| **David** | The YouTube-links sheet (his §8 item) — now a **people** sheet: name, episode, and handles per platform. Fill the gaps in §11. |
| **Aidan** | Phases B–C |
| **Technical partner** | Phase D — claim flow overlaps their profile/auth work; don't build it twice |

## 11. Open decisions & roster gaps

1. ~~**Shorts in or out?**~~ **Resolved: out** (§6).
2. ~~**Apify or the official API?**~~ **Resolved: official API** (§2). Apify only for transcripts and Instagram/TikTok.
3. **Athlete tagging bar** — publish with a blank athlete field, or hold for a human? Blank-and-publish is right for volume; the field is a credit, not a claim. On an athlete-owned channel the creator credit *is* the athlete, so the gap is smaller than it looks.
4. **Outreach on claim** — email or IG DM? The 8 podcast guests are the obvious first batch: they've already said yes to HOT once, which also makes them the safest cohort to contact first.
5. **Does the ingest feed the weekly recap email** (§5's "churning machine")? If yes, `library_items` needs `featured_in_digest_at` from the start.

### Deferred to a later roadmap piece

**Faves.xyz integration.** An athlete marketing platform — 900+ athletes across 43 sports, clean `/@handle` URLs, athlete↔brand commerce with a roster system moving from product seeding to paid partnerships, $3M raised. Three separate things, worth not conflating:
- *As data* — Cole Hocker and Conner Mantz confirmed live. Client-rendered SPA, no public API; some socials sit in the initial HTML. Pulling it at scale means scraping, which is genuinely an Apify job.
- *As discovery* — probably the best-targeted roster source found so far, better than YouTube keyword search.
- *As a strategic actor* — it sits close to HOT's own §6 monetization ladder (brand→creative jobs at 15%). Linking out pipes HOT traffic into their funnel. There's an obvious partnership shape — HOT has the creative supply their athletes need for content; they have the brand relationships HOT eventually wants — and that conversation should happen before any scraping does.

Faves links already render on creator pages where a handle is known; anything deeper waits.

### Roster gaps for David's sheet

- **Sam Parsons** — no YouTube channel found (`@sam_parsons` is a sneaker channel dormant since 2017). Instagram/podcast-first.
- **Tara Davis-Woodhall** — on Faves, would add Field reach. Handle not resolved.
- **Grant Fisher** — the real channel, not the 803-subscriber namesake.
- **Conner Mantz** — on Faves and Instagram, no YouTube.
- **The 7 podcast guests without accounts** — Trevor Bassitt, Liam Meirow, Xavier Gallo, Valery Tobias, Marquis Dendy, Sinclaire Johnson, Craig Nowak, Ahmed Muhumed. Their pages exist and are anchored on their episode; adding an Instagram handle each would make them substantially richer.
