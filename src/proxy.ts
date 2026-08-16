import { NextResponse, type NextRequest } from "next/server";

/**
 * Temporary "coming soon" gate.
 *
 * While COMING_SOON is on, every page request is redirected to /soon — the
 * email-capture holding page. The real site is still built and deployed, it
 * just isn't reachable. Turning the gate off is an env-var change plus a
 * redeploy; nothing here has to be reverted or deleted.
 *
 * Team/stakeholder bypass: hit any URL with ?key=<PREVIEW_SECRET>. That mints
 * an httpOnly cookie and drops you onto the real site for 30 days. ?key=out
 * clears it again.
 *
 * PREVIEW_SECRET must be alphanumeric. It is compared raw on both sides, and the
 * two sides decode differently: searchParams.get() plus-decodes (`?key=a+b` reads
 * as "a b") while cookie values are written verbatim, so `+`, spaces, `;` and `,`
 * break the match or the Set-Cookie header — silently, with no error surfaced.
 *
 * Next 16 renamed middleware to proxy — see
 * node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 */

const GATE_PATH = "/soon";
const BYPASS_COOKIE = "hot_preview";
const BYPASS_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function gateEnabled(): boolean {
  const flag = process.env.COMING_SOON;
  return flag === "1" || flag === "true";
}

export function proxy(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  const secret = process.env.PREVIEW_SECRET;
  const key = searchParams.get("key");

  // Hand back the keys: ?key=out drops the bypass cookie and returns you to the gate.
  if (key === "out") {
    const url = request.nextUrl.clone();
    url.pathname = GATE_PATH;
    url.search = "";
    const res = NextResponse.redirect(url);
    res.cookies.delete(BYPASS_COOKIE);
    return res;
  }

  // ?key=<secret> mints the bypass cookie, then bounces to the same URL without
  // the key so the secret doesn't linger in the address bar or get shared onward.
  if (secret && key === secret) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set(BYPASS_COOKIE, secret, {
      httpOnly: true,
      sameSite: "lax",
      // Keyed off the actual scheme, not NODE_ENV, so a local `npm run start`
      // over http can still use the bypass.
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: BYPASS_MAX_AGE,
    });
    return res;
  }

  if (secret && request.cookies.get(BYPASS_COOKIE)?.value === secret) {
    return NextResponse.next();
  }

  if (pathname === GATE_PATH) return NextResponse.next();

  // 307, not 308 — this is temporary and must not stick in anyone's browser
  // cache once the gate comes down.
  const url = request.nextUrl.clone();
  url.pathname = GATE_PATH;
  url.search = "";
  return NextResponse.redirect(url, 307);
}

export const config = {
  // /api stays open so the gate page's own form can post to /api/join.
  //
  // Every alternative is anchored with a trailing `/` or `$`. Without that these
  // are prefix matches, and a path like /apidocs or /assetsfoo would slip the
  // gate and render the real site's chrome while it's supposed to be dark.
  matcher: [
    "/((?!api/|api$|_next/|assets/|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|xml|txt)$).*)",
  ],
};
