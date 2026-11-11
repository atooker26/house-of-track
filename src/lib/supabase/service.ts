import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only, and only for what a signed-in admin's own
 * session can't do: creating a login for a new admin and minting set-password /
 * reset links (which are emailed through TEGO, not Supabase's mailer: Supabase's
 * built-in mailer only reaches the project's own team). Null when the key is unset.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
