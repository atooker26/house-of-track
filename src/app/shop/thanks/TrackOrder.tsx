"use client";

import { useEffect } from "react";
import { trackFormSubmitOnce } from "@/lib/tego-conversions";

/**
 * Counts a paid shop order as a TEGO conversion (formId "order"), so the sale is
 * credited to the visitor's channel (email, social, search…). Rendered only once
 * the Stripe webhook has marked the order paid, and at most once per checkout
 * session per tab, so a refresh or Back never double-counts. No PII is sent; the
 * revenue itself reaches TEGO server-side via /api/v1/purchases.
 */
export default function TrackOrder({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    trackFormSubmitOnce("order", "Shop order", sessionId);
  }, [sessionId]);
  return null;
}
