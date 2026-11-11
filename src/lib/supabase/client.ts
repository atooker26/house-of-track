import { createBrowserClient } from "@supabase/ssr";

/** Browser client: sign-in, password change, and photo uploads to the `media` bucket. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export const MEDIA_BUCKET = "media";
