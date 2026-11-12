# House of Track admin (`/admin`)

The shop's back office, built the way TEGO's other client sites do it (Cole Hocker's
shop admin, Big Green Egg's console). Lives at **www.houseoftrack.media/admin**, outside
the coming-soon gate, behind a login.

| Page | What it does |
| --- | --- |
| Overview | Sales (30 days / all time), the shipping queue, sell-through for the live drop, setup warnings. |
| Orders | To ship (oldest first) / Shipped / Refunded / All, search by order #, name or email. |
| Order | Items, address, **Mark shipped** (carrier + tracking, emails the buyer), internal note, **Refund** in full (optional restock). |
| Drops | Every drop with status, window, orders and sales. New drop. |
| Drop | Products in the drop; settings: title, blurb, draft / live / closed, open and close times (Pacific), flat shipping. |
| Product | Photos (upload, reorder, cover = first), sizes with SKU and stock (sold and held shown), details, delete if never ordered. |
| Team | Admins. Add by email (they get a set-password link from TEGO), resend a link, remove. |
| Settings | Order alerts: who gets the "New order" email (no admin login needed). Add, remove, **Send test**. Table `order_alert_recipients` (migration 0002). |
| Account | Change your password. |

The TEGO **request widget** ("Need a change?") sits bottom-right on every console page,
admin-only: requests land as tickets in the house-of-track Space.

## Access

- **Login:** Supabase Auth on the house-of-track project (email + password, no self-signup).
- **Admin:** a row in `public.admins` for that user id. A login without a row sees "Not an admin".
- **One choke point:** `getViewer()` in `src/lib/admin/auth.ts`. Every page, layout and server
  action goes through it. Moving to "Sign in with TEGO" later means changing that function.
- Shop data is read and written through Drizzle as the owner role, never the Supabase Data API.
  Every table keeps RLS on with no policies.
- Set-password and reset emails go **through TEGO** (`/api/v1/email/send`), not Supabase's
  mailer (which only reaches the project's own team). Links land on `/auth/confirm` and work
  on any device.

## Photos

Uploaded from the browser straight to the public Storage bucket `media` with the admin's own
session. Storage policies allow select/insert/update/delete only when `public.is_admin()`.
Public URLs are read by `/shop` (next.config allows the host) and by TEGO emails.

`supabase/admin.sql` holds this Supabase-only setup (function, bucket, policies). It isn't a
Drizzle migration because PGlite has no auth or storage schema. **`is_admin()` must be owned
by `postgres`, not `hot_app`**: it calls `auth.uid()`, and Supabase won't grant `hot_app` the
auth schema ("permission denied for schema auth").

## TEGO

- **Catalog feed:** `GET /api/products` (contract v1, TEGO `docs/catalog-feed.md`). Every visible
  product of every live or closed drop, one "store" per drop. Set House of Track's brand line
  "Catalog for email" to `https://www.houseoftrack.media/api/products`.
- **Emails:** receipt, order alert, shipped, admin invite and reset, all via `TEGO_API_KEY`.
- **Purchases:** each paid order lands on the buyer's TEGO contact (unchanged from the shop PR).
- **Request widget:** `NEXT_PUBLIC_TEGO_WIDGET_KEY` = the client user's widget secret in TEGO
  (`/portal/admin/c/<clientId>`). Unset = no widget.

## Environment

| Name | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, all envs | `https://gdfnftdtnilipnbutyep.supabase.co` (public). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel, all envs | The project's publishable key (public). |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel prod, Sensitive (set 2026-11-11) | Only for adding admins and password reset. Unset = those two say "ask TEGO". |
| `NEXT_PUBLIC_TEGO_WIDGET_KEY` | Vercel prod (set 2026-11-11) | Request widget key (see above). |
| `TEGO_API_KEY` | Vercel prod, Sensitive (set 2026-11-11) | Sends the invite, reset and shipped emails (docs/SHOP.md). |

## Local

    npm run db:seed:dev
    npm run db:dev:admin -- <supabase-user-uuid> <email>   # put a real login on the PGlite admin list
    npm run dev

With the two `NEXT_PUBLIC_SUPABASE_*` values in `.env.local`, you sign in with a real login
against local PGlite data.

## Adding the first admins by hand

Without the service-role key, an admin is a Supabase user plus an `admins` row. Creating
the user in SQL needs every GoTrue token column set to `''` (not NULL) and a matching
`auth.identities` row, or login fails with "Database error querying schema". Prefer the
Team page once `SUPABASE_SERVICE_ROLE_KEY` is set.
