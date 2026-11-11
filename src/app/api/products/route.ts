import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { buildProductFeed, FeedNotFound, feedSiteUrl, parseFeedQuery } from "@/lib/shop/feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/products — TEGO catalog feed (contract v1, TEGO docs/catalog-feed.md).
 * TEGO reads it server-side, so no CORS. Point House of Track's brand line at
 * https://www.houseoftrack.media/api/products ("Catalog for email" in TEGO).
 * /api is outside the coming-soon gate, so it answers while the site is dark.
 */
const HEADERS = {
  "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(request: Request) {
  const query = parseFeedQuery(new URL(request.url).searchParams);
  try {
    const feed = await buildProductFeed(await getDb(), query, feedSiteUrl());
    return NextResponse.json(feed, { headers: HEADERS });
  } catch (err) {
    if (err instanceof FeedNotFound) return NextResponse.json({ error: "Not found" }, { status: 404, headers: HEADERS });
    throw err;
  }
}
