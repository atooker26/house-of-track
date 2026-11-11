import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { supabasePublicEnv } from "@/lib/supabase/env";

export type Viewer =
  | { state: "unconfigured" }
  | { state: "signed-out" }
  | { state: "not-admin"; email: string }
  | { state: "admin"; userId: string; email: string };

/**
 * Who is looking at /admin. The ONE place that decides admin access: every page,
 * layout and server action goes through here (requireAdmin), so swapping the
 * login (e.g. "Sign in with TEGO") means changing this function, not the console.
 *
 * Login = Supabase Auth (email + password, no self-signup). Access = a row in
 * public.admins for that user id. A login without a row is turned away.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  // Per-request, always: never prerender a console page at build time (and the
  // "not set up" branch below reads no cookies, so nothing else would force it).
  await connection();
  if (!supabasePublicEnv()) return { state: "unconfigured" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };
  const email = user.email ?? "";
  const db = await getDb();
  const [row] = await db.select({ userId: admins.userId }).from(admins).where(eq(admins.userId, user.id));
  if (!row) return { state: "not-admin", email };
  return { state: "admin", userId: user.id, email };
});

/** For pages: redirects to the login page unless the viewer is an admin. */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const v = await getViewer();
  if (v.state !== "admin") redirect("/admin/login");
  return { userId: v.userId, email: v.email };
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** For server actions: same check, but returns instead of redirecting mid-mutation. */
export async function adminOrError(): Promise<{ userId: string; email: string } | null> {
  const v = await getViewer();
  return v.state === "admin" ? { userId: v.userId, email: v.email } : null;
}

export const NOT_ALLOWED: ActionResult = { ok: false, error: "You're signed out, or this login isn't an admin. Sign in again." };
