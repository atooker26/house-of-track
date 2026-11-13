# House of Track shop

`/shop` sells limited drops. Buy goes straight to Stripe Checkout (one item per
order, no cart), stock is held while the buyer pays, and Pyramid Printing ships.

- `/shop`: the current drop (newest `live`, else newest `closed`; drafts never show),
  a countdown before `starts_at`, sold-out states, and the newsletter signup.
- `/shop/<product>`: photos, size picker, quantity (max 5), Buy now. "Limited run of N ·
  M left" when every size has a count. The drop's ships-by date and policy line. When it
  can't be bought (not open, checkout off, sold out): "Email me when it drops", which
  makes the address a TEGO contact tagged `shop-notify` + `drop:<slug>`. Shared links
  show the product's cover photo.
- `/shop/thanks?session_id=…`: the order (noindex).
- `POST /api/shop/checkout`, `POST /api/shop/webhook` (Stripe).

While `COMING_SOON=1`, the gate in `src/proxy.ts` lets `OPEN_PATHS` (`/shop` and
everything under it) through and keeps the rest of the site dark. `/creatives` and
`/gallery` get added to that list when they launch.

## How money moves

TEGO's platform Stripe account (`STRIPE_SECRET_KEY`) takes the payment as a
**destination charge** to House of Track's connected account
(`STRIPE_CONNECTED_ACCOUNT_ID`). TEGO keeps an application fee of 1% + 2.9% + 30¢
(LB Mile's formula), so House of Track carries its own card costs. Card statements
read `TEGO LLC* HOUSEOFTRACK`.

**No connected account = no checkout.** Without `STRIPE_CONNECTED_ACCOUNT_ID` the
pages show "Opening soon" and the API refuses with 503. Money never sits on TEGO's
platform account.

Shipping is a flat US rate per drop (`drops.shipping_cents`). **No sales tax is
collected yet** (see Open questions).

## Stock

`variants.stock_qty` (null = unlimited), `reserved`, `sold`. Checkout reserves with
one conditional `UPDATE … WHERE stock_qty - sold - reserved >= qty`, and a CHECK
constraint refuses any oversell underneath it. The Stripe session expires after 30
minutes: `checkout.session.expired` puts the units back, `checkout.session.completed`
moves them from reserved to sold and marks the order paid. Each Stripe event id is
handled once (`processed_stripe_events`). Orders are numbered `HOT-1001`, `HOT-1002`, …

## Signups → TEGO contacts

`/api/join` forwards every form to TEGO's submissions inbox. The two "email me" forms
also become TEGO email contacts through `POST /api/v1/contacts` (the site key needs
`contacts:write`, added 2026-11-13): the newsletter (tag `newsletter`) and drop notify
(tags `shop-notify`, `drop:<slug>`), each with `consentSource` + `consentAt`. A drop's
launch email in TEGO targets `drop:<slug>`. The creative/athlete join forms don't become
email contacts: joining the roster isn't asking for marketing email.

## After payment

Best-effort, after the response; a failure is logged and never fails the webhook:

1. Receipt to the buyer, via TEGO `POST /api/v1/email/send` (with the drop's ships-by date, if set).
2. Order alert to every address in /admin → Settings (fallback `ORDER_ALERT_EMAILS`) (Pyramid ships it; House of
   Track sees it), reply-to the buyer.
3. The sale on the buyer's TEGO contact, via `POST /api/v1/purchases`
   (externalId `house-of-track-shop:<order number>`).

Emails send with an `Idempotency-Key` per order + recipient, so a re-sent webhook
never mails twice. With no `TEGO_API_KEY`, nothing is sent and the log says so.

## Environment variables

| Name | What |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler (:6543). App runtime. |
| `POSTGRES_URL_NON_POOLING` | Supabase session pooler (:5432). Migrations only. |
| `STRIPE_SECRET_KEY` | TEGO's platform secret key. |
| `STRIPE_CONNECTED_ACCOUNT_ID` | House of Track's connected account (`acct_…`). Unset = checkout off. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the endpoint below. |
| `TEGO_API_KEY` | House of Track's TEGO API key, scopes `email:send` + `purchases:write` + `contacts:write`. |
| `TEGO_ACCOUNT_ID` | Only if the key is an admin key; an account-bound key doesn't need it. |
| `TEGO_API_URL` | Optional, defaults to `https://www.tegomarketing.com`. |
| `ORDER_ALERT_EMAILS` | Optional fallback. Who gets "New order" emails is set in /admin → Settings; this comma-separated list is used only while that list is empty (the first add there copies it in). |
| `SITE_URL` | Optional; Stripe return URLs. Defaults to the request's origin. |

Values live in Vercel only. **This repo is public: never put a key, account id or
address in a file here.**

## Local development

    npm run db:seed:dev        # .pglite/ with "Drop 01 — Corduroy Hat", 50 units (stand-in price + photos)
    npm run dev                # no DATABASE_URL → PGlite at .pglite/
    npm run test:shop          # stock + order state on in-memory PGlite

PGlite locks its directory: stop `next dev` before running a script against it.
`npm run db:seed:dev -- --upcoming` seeds a drop that opens in 3 days (countdown).

## Launch checklist

Status 2026-11-11: steps 2 (TEGO API key), 4 (database) and 5 (Stripe webhook) are done,
and the shop pages are live behind the coming-soon gate (`/shop` is open, checkout is off).
The admin is live too (docs/ADMIN.md), including Settings for order alerts. Left before
checkout can turn on: Stripe Connect onboarding (step 3), order-alert recipients (step 6),
the real drop (step 7), one real test order (step 8), and DKIM (step 1).

Production env vars set as of 2026-11-11: `DATABASE_URL`, `POSTGRES_URL_NON_POOLING`,
`TEGO_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TEGO_WIDGET_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`. Not set: `STRIPE_CONNECTED_ACCOUNT_ID` (checkout stays off until
it is). Order alerts are set in /admin → Settings, not an env var.

On the **existing** House of Track client account in TEGO (already linked to the
house-of-track Space, with its email account set up):

1. **Email:** sending-domain verification for houseoftrack.media was started in TEGO
   (2026-11-10) and shows 3 DKIM CNAMEs. Add them in the DNS of the Cloudflare
   account that actually holds the zone (the registrar is Cloudflare; it is not the
   GoHighLevel account), then re-check in TEGO. **Blocked (2026-11-11):** the zone isn't
   in TEGO's Cloudflare account and the domain is being recovered from the old
   registrant. Until DKIM is in, TEGO email from hello@houseoftrack.media can land in
   spam (admin invites included).
2. **API key (done 2026-11-11):** "House of Track site — shop email + purchases" in TEGO
   (Admin → API keys), scopes `email:send` + `purchases:write` only, bound to the House
   of Track client → Vercel `TEGO_API_KEY`. TEGO's create form starts with **every**
   scope selected: turn the others off, don't click the two you want.
3. **Stripe Connect:** House of Track completes onboarding through TEGO → Vercel
   `STRIPE_CONNECTED_ACCOUNT_ID`. `STRIPE_SECRET_KEY` is done (2026-11-11): a live
   standard key on TEGO's platform account named "House of Track", so it can be rolled
   without touching the other sites. Creating a key needs the account owner's Touch ID.
4. **Database (done 2026-11-10):** Supabase project `house-of-track`, migration
   `0000_shop` applied and recorded in `public.__drizzle_migrations`. A least-privilege
   app role **owns** the tables: RLS is on with no policies, so only the owner can read
   them (a non-owner role sees zero rows). Use the `aws-1-…` session/transaction
   pooler host; `aws-0` answers "tenant not found". Both pooler URLs are in Vercel
   production. Later migrations: `POSTGRES_URL_NON_POOLING=… npm run db:migrate`.
5. **Stripe webhook (done 2026-11-11):** destination `house-of-track` on TEGO's platform
   account (Your account, Snapshot payload). Endpoint
   `https://www.houseoftrack.media/api/shop/webhook` with events
   `checkout.session.completed` and `checkout.session.expired` → Vercel
   `STRIPE_WEBHOOK_SECRET`. The endpoint ignores sessions from TEGO's other sites
   (anything without `metadata.site = "house-of-track"`). Verification goes through
   `getStripe()`, so the endpoint needs `STRIPE_SECRET_KEY` as well as the signing
   secret, or every event gets a 400. Live mode has no "send test event": the first real
   delivery shows up under the destination's Event deliveries.
6. **Alerts:** add who gets "New order" emails in /admin → Settings (Kirk at Pyramid +
   House of Track), then **Send test** on each and check it isn't in spam.
7. **Catalog:** set up the real drop, products, photos and stock in `/admin` (docs/ADMIN.md).
   Keep the drop `draft` until it's ready, then `live` with an open time for a countdown.
8. **Redeploy after adding env vars** (`vercel --prod`): a deploy made before a var
   exists doesn't get it. Then run one real low-value order end to end and refund it.

## Open questions

- **Sales tax.** None is collected. House of Track is in Oregon (no sales tax) and far
  below other states' thresholds, but confirm before volume grows; Stripe Tax is the
  switch.
- **Admin.** Built: `/admin`, see docs/ADMIN.md. Orders are marked shipped there, which
  emails the buyer their tracking.
