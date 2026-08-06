# House of Track — Product Plan

> Updated definition of the product following the 2026-07-03 team call (David Ribich, Aidan, technical partner). Supersedes the brand→creative framing in _House of Track — The Creator Marketplace_ (June 2026 deck) where the two conflict. Confidential.

> **Status (2026-07-03):** Phase 0 shipped — the marketplace hub is **live in production at [`/hub`](https://house-of-track.vercel.app/hub)** (the existing podcast homepage at `/` is unchanged). Library content is placeholder pending the real RSS + creator sheet; forms post to the TEGO webhook via `/api/join`.

## 1. What the product is now

**House of Track is the hub for track & field's creatives and athletes — a curated content library on the front, a creative↔athlete marketplace underneath, with the podcast and brand behind the curtain.**

The June deck sold a **brand → creative jobs marketplace with a 15% fee**. The call re-centered on a **creative ↔ athlete photo-delivery + content-hub** wedge, because it solves a felt, daily pain ("did you get photos of me?") and can be seeded and shipped cheaply now. The 15% jobs marketplace becomes a _later_ monetization layer once the roster and credibility exist.

## 2. The three layers

**Layer 1 — The Library (consumer top-of-funnel).** A "Netflix scroll" of existing athlete/creative content — YouTube / IG / RSS **embedded and credited, not hosted**. Browsable by discipline ("sprints / middle distance," not "drama / comedy"). Feeds a **weekly recap email**. Earns consumer attention without the ~8-hours-per-episode cost of net-new content. Near-zero storage, no rights risk, trademark-covered (non-downloadable video).

**Layer 2 — The Marketplace (the two-sided core).** Two entry doors — "I'm a creative / athlete → get involved." Two subsystems:
- **Photo delivery** — "our own Dropbox with facial recognition that auto-notifies everyone." Creative uploads a shoot → faces matched to athlete profiles → athletes notified their shots are ready. **JPEG final-only, ~100-photo cap** (no RAW, no video — the call's hard line).
- **Credentialing hub** — a directory of every credential location + links, where a creative can "shop where to shoot." HOT lends its name (already credentialed at USATF + PTF); later becomes the direct relationship.

**Layer 3 — The engine (behind the curtain).** Podcast keeps the lights on and supplies credibility/relationships; brand/merch is existing revenue; monetization layers bolt on later.

## 3. The site (Phase-0 build)

Marketplace-first landing page, in the HOT design system:
1. **Two-door hero** — creative/athlete "get involved" vs consumer "watch the sport."
2. **Creative form + athlete form** — the two sign-up funnels.
3. **Library preview** — discipline tabs, credited embeds (seed with RSS + David's YouTube sheet).
4. **Credentialing module** — upcoming meets + "credential through HOT" ("Prefontaine Classic — pencil me in").
5. **Credibility band** — partner logos (Portland Track, USATF), "where we've been."
6. **Subscription capture** — email opt-in (the database is the compounding asset).
7. **Team page** — Aidan + David (not just David).

Build with the real Portland Track Festival photos (in the Drive; HOT holds rights via Miguel's full drop).

## 4. Build architecture — the two decisions that make this cheap

| Decision | Consequence |
|---|---|
| **Library = aggregate/embed, don't host** | No video infra, no storage, no rights problem. Embeds + metadata + a cron for the weekly email. |
| **Marketplace = JPEG final-only, ~100 cap** | ~0.8 GB/creative/meet, not 10–80 GB. Vercel Blob (private) + Postgres + on-the-fly resize. No Mux, no R2. |

**Data model spine:** users → role (creative/athlete/both) → **profile with `unclaimed → claimed` state** (for seeding) → meets → media assets (owner, meet, JPEG variants) → **face-tags (with explicit biometric-consent flag)** → credentials → library items (external embeds).

**The one real engineering piece** is the facial-recognition pipeline (buy: AWS Rekognition or a face-embedding service) plus the biometric-consent gate — the only legally-loaded part (Illinois BIPA-style consent must be built in from day one).

## 5. Go-to-market is baked into the product

The team's stated #1 risk is not the build — it's getting both sides to show up. Seeding is a product requirement:
- **Claimable profiles** — prop up accounts for real creatives/athletes, highlight + credit their work, let them claim.
- **"The sauce" (Bandit model)** — creatives shoot for free just to have work highlighted; the Library _is_ that highlight engine, so supply seeds itself.
- **Weekly recap email** — keeps attention warm between podcast drops (the "churning machine").

## 6. Monetization ladder (deferred)

Lightest-lift first: **newsletter sponsors → featured listings → credentialing fee → brand→creative jobs + 15% Stripe Connect → training/coaching vertical (trademark-covered) → merch (existing).** Design the schema to allow these; don't build at launch.

## 7. Phased roadmap

- **Phase 0 — Front page + Library — ✅ shipped at `/hub`:** two-door landing, role-toggle join forms (with athlete photo-consent), credentialing meet list, Library preview, weekly-recap capture. Live in production; pitch asset for trails + Steve DeCoker / Hoka Portland Fly (August).
  - **Library is real** (2026-08-06): 148 credited, embedded videos from 19 channels via the YouTube Data API, plus **29 creator pages at `/creators/<slug>`** anchored on each person's podcast episode, and 19 unclaimed profiles totalling 3.24M subscribers. Placeholder athlete names are gone. Cost $0. See `docs/YOUTUBE-INGEST-PLAN.md`.
  - _Remaining:_ automate the Library refresh (it's a committed snapshot today), and expand the roster from David's sheet.
- **Phase 1 — Marketplace MVP (technical partner):** claimable profiles, JPEG upload (capped), meet tagging, athlete notification. Facial recognition manual → automated.
- **Phase 2 — Credentialing live + weekly email automation.**
- **Phase 3 — Monetization layers + physical pop-up anchor.** Tie the digital roadmap to a physical launch date (Bandit-style event / Flash Awards) to force momentum.

## 8. Owners (from the call)

| Owner | Action |
|---|---|
| **Aidan** | Two-door landing page + Library scroll + team page, using Drive PTF photos |
| **David** | Credentialing-links spreadsheet; YouTube-links Google Sheet; social-strategist outreach; pop-up ideas; IG login |
| **Technical partner** | Own the platform build (upload, profiles, recognition) |

## 9. Open decisions

1. **Who pays, and when?** Monetization was unresolved. Athlete free forever (attention play), brands/sponsors pay? Creative subscription? Determines when to build Stripe.
2. **Facial recognition now or later?** The magic, but the only legally-loaded piece. Manual meet-tagging could ship first.
3. **Library scope** — YouTube-only to start, or IG too (harder to embed)?
4. **Launch date** — pick a physical-event anchor to work backward from.
