# Coming-soon gate

A temporary email-capture holding page that stands in front of the whole site
while the marketplace backend gets built. The real site stays built and
deployed — it just isn't reachable from the outside.

## Turning it on and off

| | |
|---|---|
| **Gate on** | `COMING_SOON=1` |
| **Gate off** | delete the var, or set it to anything else |

It's an environment variable on the Vercel project, so flipping it **requires a
redeploy** to take effect. Nothing needs to be reverted, branched, or deleted in
either direction.

```
vercel env add COMING_SOON production     # value: 1
vercel env add PREVIEW_SECRET production  # value: the bypass key (alphanumeric)
vercel --prod                             # redeploy so the proxy picks it up
```

To take the gate down later: `vercel env rm COMING_SOON production` and redeploy.

**Before flipping it on, confirm `TEGO_WEBHOOK_SECRET` is set in production.**
The gate's only conversion path is `/api/join`, which returns 500 without it —
the form then shows "That didn't go through" and the signup is lost with no
retry and nothing logged anywhere you'd see. After the gate goes up, submit one
real signup and confirm it lands in the TEGO inbox.

## Seeing the real site while it's gated

Visit **any** URL with `?key=<PREVIEW_SECRET>`:

```
https://<domain>/?key=<PREVIEW_SECRET>
```

That sets an httpOnly cookie good for 30 days and strips the key back out of the
address bar, so you can browse the whole site normally afterwards. Share that one
link with David or anyone you're demoing to.

To drop back to the visitor's view, hit any URL with `?key=out`.

> **Never write the real key in this file.** This repo is public. The value lives
> in `.env.local` (gitignored) and in the Vercel project settings — nowhere else.
> Keep it **alphanumeric**: it travels as a query param and as a cookie value, and
> characters like `+`, space, `;` or `,` silently break one or the other.

It is not the same thing as a password — it's a share link, so treat it as
semi-public and rotate it if it gets around.

## How it works

- `src/proxy.ts` — Next 16's proxy (what used to be `middleware.ts`). When the
  gate is on it **307-redirects** every page request to `/soon`. 307 and not 308
  on purpose: a permanent redirect would stick in visitors' browser caches after
  the gate came down.
- `src/app/soon/page.tsx` + `SoonForm.tsx` — the holding page. The form posts to
  the existing `/api/join` with `formType: "newsletter"`, so signups land in the
  same TEGO webhook inbox as everything else. No new infrastructure.
- `src/app/globals.css` — a `.gate-page` block at the bottom of the file, which
  also hides the site nav and footer. The whole block is deletable.
- `/api/*` is excluded from the proxy matcher so the form can reach `/api/join`.

## Things to know

- **The gate page is `noindex`.** Every URL serves identical content while gated,
  and without `noindex` Google would learn the site as one duplicate splash page.
  The `robots` export in `src/app/soon/page.tsx` comes out when the gate does.
- **The podcast itself is unaffected.** The RSS feed is hosted at
  `anchor.fm/s/107c9fe84/podcast/rss`, not here, so Spotify/Apple/YouTube keep
  working normally. What breaks is web links to `/episodes/<slug>` — those land
  on the holding page until the gate comes down.
- **Existing pages still build.** `/hub`, `/creators/*`, `/episodes/*` are all
  intact; nothing was removed to make room for the gate.
