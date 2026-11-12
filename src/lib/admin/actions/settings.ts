"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { orderAlertRecipients } from "@/db/schema";
import { adminOrError, NOT_ALLOWED, type ActionResult } from "@/lib/admin/auth";
import { envAlertRecipients, sendEmail, tegoConfigured } from "@/lib/shop/tego";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");

/**
 * The first add copies ORDER_ALERT_EMAILS into the list, so taking over from the env
 * var never silently drops someone who was already getting alerts.
 */
export async function addAlertRecipient(raw: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = emailSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Enter a valid email" };
  const db = await getDb();
  const existing = await db.select().from(orderAlertRecipients);
  const seed = existing.length ? [] : envAlertRecipients();
  const emails = [...new Set([...seed, p.data])];
  await db
    .insert(orderAlertRecipients)
    .values(emails.map((email) => ({ email })))
    .onConflictDoNothing();
  revalidatePath("/admin/settings");
  return { ok: true, message: `${p.data} will get an email for every new order.` };
}

export async function removeAlertRecipient(email: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  await db.delete(orderAlertRecipients).where(eq(orderAlertRecipients.email, email));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Removed." };
}

/** A real send through TEGO, so you can see it arrives (and check spam) before a drop. */
export async function sendTestAlert(email: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  if (!tegoConfigured()) return { ok: false, error: "Email is off until TEGO_API_KEY is set." };
  const p = emailSchema.safeParse(email);
  if (!p.success) return { ok: false, error: "Not a valid email." };
  const text = "This is a test of the House of Track order alert. Real ones arrive the moment an order is paid, with what to pack and where to ship it.";
  try {
    await sendEmail({
      to: p.data,
      subject: "Test: House of Track order alert",
      html: `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#2B2928;background:#EDE9D8;margin:0"><div style="max-width:520px;margin:0 auto;padding:32px 24px"><p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px">House of Track</p><h1 style="font-size:24px;text-transform:uppercase;margin:0 0 16px">Order alerts work</h1><p style="font-size:15px;line-height:1.5">${text}</p></div></body></html>`,
      text,
      idempotencyKey: `hot-alert-test-${p.data}-${Date.now()}`,
    });
    return { ok: true, message: `Sent to ${p.data}. If it isn't in the inbox, check spam.` };
  } catch (err) {
    console.error("[admin] test alert failed:", err);
    return { ok: false, error: "The email didn't send. Try again in a minute." };
  }
}
