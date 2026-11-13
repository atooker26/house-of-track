# Gallery: photo delivery from creatives to athletes

Status (2026-11-13): **plan only, nothing built.** Layer 2 of docs/PRODUCT-PLAN.md
("photo delivery"). Nothing here is decided until David and David sign off.

## What it is

A creative shoots a meet, uploads the finals, and every athlete in those photos is told
their shots are ready. The athlete opens a link, sees their photos, and downloads them
with the creative credited. It answers the question every athlete asks after a race:
"did anyone get photos of me?"

The same photos become the raw material for House of Track's own posts and emails,
with the creative's permission.

## Hard lines (from the product call)

- **Finished JPEGs only.** No RAW, no video.
- **About 100 photos per upload.** A cap per shoot keeps storage and review sane.
- **Credit the creative every time**, on the page, in the download, and in any email.
- **Consent first.** An athlete is only notified, tagged or shown if they agreed
  (the athlete join form already asks for photo consent). Removal sticks: a
  removed photo or athlete is a tombstone, never re-added by a later upload. Same
  rule as creator profiles (docs/YOUTUBE-INGEST-PLAN.md, `optedOut`).

## How it works

1. **Creative uploads.** A signed-in creative picks the meet, drops up to ~100 JPEGs.
   Stored in Supabase Storage (the shop already uses it), resized on upload for web,
   original kept for download.
2. **Matching athletes to photos.** Phase 1 is manual: the creative or House of Track
   tags athletes (search by name, bib, event). Face matching is Phase 2. It touches
   biometric privacy law (Illinois BIPA, Texas, Washington), so it needs explicit
   opt-in and legal review before it exists.
3. **Notify.** Each tagged athlete gets "Your photos from <meet> are ready", sent
   through TEGO (the same path as shop receipts), with a private link.
4. **Athlete page.** Their photos from that meet, download, credit line, "remove me".
5. **Public gallery.** A meet page shows only photos where every tagged athlete
   consented and the creative allowed public display.

## Data

| Table | What |
|---|---|
| `meets` | name, date, location, slug |
| `shoots` | creative, meet, status (draft / published), photo count |
| `photos` | shoot, storage path, width/height, public flag, removed_at |
| `photo_tags` | photo, athlete (person), tagged_by, removed_at |
| `people` | moves out of `data/people.json` into the database once tagging writes to it |

Access follows the shop: tables owned by the app role, RLS on with no policies, admin
and creative screens behind Supabase Auth (later "Sign in with TEGO").

## TEGO connection

- **Emails:** "your photos are ready" goes through TEGO `/api/v1/email/send`, so
  athletes and creatives land as TEGO contacts.
- **Audience:** athletes and creatives are tagged in TEGO (`role:athlete`,
  `role:creative`, `meet:<slug>`). That's the audience for merch drops and the weekly
  recap, for those who opted into email.
- **Photos in emails:** TEGO's email builder can read a client site's media through
  `GET /api/media`. A gallery endpoint there lets HOT drop real meet photos straight
  into a campaign (consented, credited photos only).
- **Requests:** creatives and athletes reporting a problem use the same TEGO ticket
  path as the admin widget.

## Costs to watch

Storage and egress are the real cost. 100 photos at ~3 MB each is ~300 MB per shoot.
Keep a web-sized copy for viewing and serve originals only on download. Revisit the
cap after the first real meet.

## Order of work

1. **Pilot with the Portland Track Festival photos** House of Track already holds
   rights to: a meet page and athlete tagging by House of Track only. No creative
   uploads yet.
2. **Notify + athlete page**, through TEGO email.
3. **Creative uploads** with their own login.
4. **Face matching**, only after legal review and an explicit opt-in flow.

## Open questions for David and David

1. Who tags athletes in the pilot: House of Track, or the creative?
2. Is the public gallery on by default for consented photos, or opt-in per shoot?
3. Do creatives get anything for uploading in v1 (credit and exposure only, or a
   path to paid work later)?
4. Which meet is the first real test after Portland Track Festival?
