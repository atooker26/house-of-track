import Stripe from "stripe";

/**
 * Payments run on TEGO's platform Stripe account, the same setup as LB Mile and
 * Pyramid: `STRIPE_SECRET_KEY` is TEGO's key, and every charge is a destination
 * charge to House of Track's connected account (`STRIPE_CONNECTED_ACCOUNT_ID`).
 *
 * No connected account = no checkout. Money is never left sitting on TEGO's
 * platform account; the shop shows "Opening soon" instead (see checkoutOpen()).
 */

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(secretKey, { typescript: true });
  }
  return _stripe;
}

export function connectedAccountId(): string | null {
  const id = process.env.STRIPE_CONNECTED_ACCOUNT_ID?.trim();
  return id && id.startsWith("acct_") ? id : null;
}

/** Checkout needs both the platform key and House of Track's connected account. */
export function checkoutOpen(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && connectedAccountId());
}

// Card statements read "TEGO LLC* HOUSEOFTRACK", never a bare "TEGO LLC": LB Mile
// had entries disputed as fraud by people who didn't recognise the TEGO name.
// Stripe allows 22 characters for prefix + "* " + suffix; "TEGO LLC* " is 10.
export const STATEMENT_DESCRIPTOR_SUFFIX = "HOUSEOFTRACK";
export const STATEMENT_DESCRIPTOR = `TEGO LLC* ${STATEMENT_DESCRIPTOR_SUFFIX}`;

// LB Mile's fee: TEGO's 1% plus Stripe's US card price (2.9% + 30¢), so the
// platform nets its 1% and the shop carries its own card costs. The charge lands
// on TEGO's platform account (destination charge), so Stripe bills TEGO.
export const PLATFORM_FEE_BPS = 100;
export const STRIPE_FEE_BPS = 290;
export const STRIPE_FEE_FIXED_CENTS = 30;

export function applicationFeeCents(totalChargeCents: number): number {
  if (totalChargeCents <= 0) return 0;
  const fee =
    Math.round((totalChargeCents * (PLATFORM_FEE_BPS + STRIPE_FEE_BPS)) / 10000) + STRIPE_FEE_FIXED_CENTS;
  return Math.min(fee, totalChargeCents);
}

/** Checkout sessions hold stock for this long, then Stripe expires them. Stripe's minimum is 30 minutes. */
export const CHECKOUT_HOLD_MINUTES = 30;
