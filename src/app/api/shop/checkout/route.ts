import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { attachSession, createPendingOrder, MAX_QTY, releaseOrder, ShopError } from "@/lib/shop/orders";
import {
  applicationFeeCents,
  CHECKOUT_HOLD_MINUTES,
  checkoutOpen,
  connectedAccountId,
  getStripe,
  STATEMENT_DESCRIPTOR_SUFFIX,
} from "@/lib/shop/stripe";

export const runtime = "nodejs";

const Body = z.object({
  variantId: z.number().int().positive(),
  qty: z.number().int().min(1).max(MAX_QTY),
});

function siteUrl(req: NextRequest): string {
  const configured = process.env.SITE_URL?.trim();
  return (configured || req.nextUrl.origin).replace(/\/$/, "");
}

/** Absolute image URL for Stripe's checkout page, or nothing. */
function absoluteImage(base: string, src: string | null): string[] {
  if (!src) return [];
  if (/^https:\/\//.test(src)) return [src];
  return base.startsWith("https://") ? [`${base}${src.startsWith("/") ? "" : "/"}${src}`] : [];
}

const STATUS: Record<ShopError["code"], number> = { NOT_FOUND: 404, NOT_OPEN: 409, SOLD_OUT: 409, BAD_QTY: 400 };

export async function POST(req: NextRequest) {
  // No connected account = no checkout. Never take money onto TEGO's platform account.
  const destination = connectedAccountId();
  if (!checkoutOpen() || !destination) {
    return NextResponse.json({ error: { code: "NOT_OPEN", message: "The shop opens soon." } }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION", message: "Pick a size and quantity." } }, { status: 400 });
  }

  const db = await getDb();
  let order;
  try {
    order = await createPendingOrder(db, parsed.data);
  } catch (err) {
    if (err instanceof ShopError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: STATUS[err.code] });
    }
    throw err;
  }

  const base = siteUrl(req);
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: order.qty,
          price_data: {
            currency: "usd",
            unit_amount: order.unitPriceCents,
            product_data: {
              name: `${order.productName} — ${order.variantLabel}`,
              images: absoluteImage(base, order.productImage),
            },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: order.shippingCents ? "Standard shipping" : "Free shipping",
            fixed_amount: { amount: order.shippingCents, currency: "usd" },
          },
        },
      ],
      phone_number_collection: { enabled: false },
      client_reference_id: order.number,
      metadata: { site: "house-of-track", orderId: String(order.orderId), orderNumber: order.number },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_HOLD_MINUTES * 60,
      success_url: `${base}/shop/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/shop/${order.productSlug}`,
      payment_intent_data: {
        statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX,
        // Fee on the full charge (items + shipping); no tax is collected yet.
        application_fee_amount: applicationFeeCents(order.totalCents),
        transfer_data: { destination },
        metadata: { site: "house-of-track", orderNumber: order.number },
      },
    });
    await attachSession(db, order.orderId, session.id);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    // Give the units back right away rather than holding them for nothing.
    await releaseOrder(db, { orderId: order.orderId }).catch(() => {});
    console.error("[shop] checkout session failed", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: "STRIPE", message: "Checkout couldn't start. Try again in a minute." } },
      { status: 502 },
    );
  }
}
