"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { adminOrError, NOT_ALLOWED, type ActionResult } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail, tegoConfigured } from "@/lib/shop/tego";

async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.houseoftrack.media";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function linkEmail(kind: "invite" | "reset", url: string) {
  const invite = kind === "invite";
  const title = invite ? "You're an admin" : "Reset your password";
  const lead = invite
    ? "You've been added to the House of Track shop admin. Set a password to sign in."
    : "Someone asked to reset the password for the House of Track shop admin.";
  const button = invite ? "Set your password" : "Set a new password";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#EDE9D8;font-family:Helvetica,Arial,sans-serif;color:#2B2928">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px">House of Track</p>
<h1 style="font-size:26px;text-transform:uppercase;margin:0 0 18px">${title}</h1>
<p style="font-size:15px;line-height:1.5">${lead}</p>
<p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#4540BF;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${button}</a></p>
<p style="font-size:13px;color:#555;line-height:1.5">The link works once and expires in an hour.${
    invite ? "" : " If you didn't ask for this, ignore this email; your password hasn't changed."
  }</p>
</div></body></html>`;
  const text = `${lead}\n\n${button}: ${url}\n\nThe link works once and expires in an hour.`;
  return { subject: invite ? "Your House of Track admin login" : "Reset your House of Track admin password", html, text };
}

/**
 * Mints a one-time recovery link (works for both "set your first password" and
 * "reset") and emails it through TEGO. The link lands on /auth/confirm, which
 * verifies the token_hash, so it works from any device or browser.
 */
async function emailLink(kind: "invite" | "reset", email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient();
  if (!sb) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY isn't set." };
  if (!tegoConfigured()) return { ok: false, error: "TEGO_API_KEY isn't set, so no email can go out." };
  const { data, error } = await sb.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data?.properties?.hashed_token) return { ok: false, error: error?.message ?? "Couldn't make a link." };
  const url = `${await siteOrigin()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  try {
    await sendEmail({
      to: email,
      ...linkEmail(kind, url),
      // Each link is single-use, so each send is its own email.
      idempotencyKey: `hot-admin-${kind}-${email}-${Date.now()}`,
    });
    return { ok: true };
  } catch (err) {
    console.error(`[admin] ${kind} email to ${email} failed:`, err);
    return { ok: false, error: "The email didn't send. Try again in a minute." };
  }
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email");

/** Adds an admin: creates their login if they don't have one, puts them on the list, emails a set-password link. */
export async function addAdmin(rawEmail: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Enter a valid email" };
  const email = p.data;
  const sb = createServiceClient();
  if (!sb) return { ok: false, error: "Adding admins needs SUPABASE_SERVICE_ROLE_KEY in Vercel. Ask TEGO." };

  const created = await sb.auth.admin.createUser({ email, email_confirm: true });
  let userId = created.data.user?.id;
  if (!userId) {
    // Already has a login: find it. The project is tiny, so one page covers it.
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
  }
  if (!userId) return { ok: false, error: created.error?.message ?? "Couldn't create the login." };

  const db = await getDb();
  await db.insert(admins).values({ userId, email }).onConflictDoUpdate({ target: admins.userId, set: { email } });
  revalidatePath("/admin/team");

  const sent = await emailLink("invite", email);
  if (!sent.ok) return { ok: true, message: `Added ${email}, but no email went out: ${sent.error}` };
  return { ok: true, message: `Added ${email} and emailed a set-password link.` };
}

export async function resendInvite(userId: string): Promise<ActionResult> {
  if (!(await adminOrError())) return NOT_ALLOWED;
  const db = await getDb();
  const [row] = await db.select().from(admins).where(eq(admins.userId, userId));
  if (!row) return { ok: false, error: "Not on the admin list." };
  const sent = await emailLink("invite", row.email);
  return sent.ok ? { ok: true, message: `Emailed a fresh link to ${row.email}.` } : { ok: false, error: sent.error };
}

/** Takes someone off the list. Their login stays (harmless without the row). You can't remove yourself or the last admin. */
export async function removeAdmin(userId: string): Promise<ActionResult> {
  const me = await adminOrError();
  if (!me) return NOT_ALLOWED;
  if (me.userId === userId) return { ok: false, error: "You can't remove yourself." };
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(admins);
  if (n <= 1) return { ok: false, error: "There has to be at least one admin." };
  await db.delete(admins).where(eq(admins.userId, userId));
  revalidatePath("/admin/team");
  return { ok: true, message: "Removed." };
}

/**
 * "Forgot password?" on the login page. Always answers the same way, so the form
 * can't be used to find out which emails are admins; real failures are logged.
 */
export async function requestPasswordReset(rawEmail: string): Promise<ActionResult> {
  const p = emailSchema.safeParse(rawEmail);
  if (!p.success) return { ok: false, error: "Enter a valid email" };
  const email = p.data;
  const db = await getDb();
  const [row] = await db.select().from(admins).where(eq(admins.email, email));
  if (!row) return { ok: true };
  const sent = await emailLink("reset", email);
  if (!sent.ok) {
    console.error("[admin] password reset:", sent.error);
    return { ok: false, error: "Password reset isn't available right now. Contact TEGO." };
  }
  return { ok: true };
}
