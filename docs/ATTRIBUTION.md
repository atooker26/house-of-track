# Conversions and sale attribution (TEGO)

House of Track reports conversions to TEGO so sign-ups and sales can be credited to a
channel (email, paid, social, organic search, referral, direct). Live since 2026-11-26
(PR #31). The client sees it in TEGO → Site → **Conversions**; the operator view is
Client workspace → Conversions.

## How it works

- **Pixel:** `tego.js` with `data-slug="house-of-track"`, loaded in `src/app/layout.tsx`
  on every page except /admin. An inline queue stub in `<head>` (`src/lib/tego-stub.ts`)
  keeps calls made before the script loads; tego.js drains the queue when it boots.
- **Sign-ups:** `trackFormSubmit(formId, label)` from `src/lib/tego-conversions.ts`, called
  only after the API answered OK. Never send names, emails or free text in the event.

  | formId | Form |
  | --- | --- |
  | `network-join` | Join the Network (home) |
  | `newsletter` | Newsletter (hub, /soon) |
  | `drop-notify` | Notify me (home featured item, product page) |
  | `creative-signup` / `athlete-signup` | Roster sign-up (hub) |
  | `guest-application` | Be a guest |
  | `coach-survey` | Coach survey |

  Profile-removal requests are deliberately not counted.
- **Sales:** `/shop/thanks` renders `TrackOrder` (formId `order`) only once the Stripe
  webhook has marked the order paid, at most once per checkout session per tab
  (`trackFormSubmitOnce`), so a refresh or Back doesn't double-count.
- **CTA clicks:** `data-tego-cta="<name>"` on an element; tego.js sends the click itself.
  Current names: `listen`, `join-network`, `join-network-nav`, `shop-featured`,
  `notify-featured`, `checkout`, `be-a-guest`. tel:/mailto: links are tracked
  automatically.
- **Revenue:** server-side, not the pixel. After payment the order is sent to TEGO
  `POST /api/v1/purchases` (docs/SHOP.md, "After payment"). TEGO's email attribution
  credits a purchase to a campaign when the buyer clicked (5 days) or opened (5 days) one
  of its emails first. Those are TEGO's defaults; House of Track has no override.

## Adding one

- New form: call `trackFormSubmit("<kebab-id>", "<Human label>")` right after the
  successful response, and add it to the table above.
- New primary button: add `data-tego-cta="<kebab-name>"`.
- Test without polluting the numbers: visit once with `?tego_internal=1` to mark your
  browser as internal.

## Caveats

- Visits from before 2026-11-26 show as "Not recorded".
- The `order` path can't be seen live until checkout is on (`STRIPE_CONNECTED_ACCOUNT_ID`)
  and the first real order is placed.
