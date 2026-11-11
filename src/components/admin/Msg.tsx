import type { ActionResult } from "@/lib/admin/auth";

/** The one-line result under a form: green for done, red for what to fix. */
export default function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  if (r.ok) return r.message ? <p className="adm-msg ok" role="status">{r.message}</p> : null;
  return (
    <p className="adm-msg err" role="alert">
      {r.error}
    </p>
  );
}
