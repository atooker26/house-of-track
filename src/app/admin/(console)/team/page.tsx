import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdmins } from "@/lib/admin/queries";
import { fmtDate } from "@/lib/admin/format";
import { AddAdmin, AdminRow } from "@/components/admin/Team";

export default async function TeamPage() {
  const me = await requireAdmin();
  const rows = await listAdmins(await getDb());
  const canInvite = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Team</h1>
          <p>Everyone here can run the shop: drops, orders, refunds and this list.</p>
        </div>
      </header>
      <section className="adm-card">
        <h2>Admins</h2>
        <table className="adm-table">
          <tbody>
            {rows.map((a) => (
              <AdminRow key={a.userId} userId={a.userId} email={a.email} since={fmtDate(a.createdAt, false)} isMe={a.userId === me.userId} canInvite={canInvite} />
            ))}
          </tbody>
        </table>
      </section>
      <section className="adm-card">
        <h2>Add an admin</h2>
        {canInvite ? (
          <AddAdmin />
        ) : (
          <p className="adm-empty">Adding admins needs SUPABASE_SERVICE_ROLE_KEY in Vercel. Ask TEGO to add someone for now.</p>
        )}
      </section>
    </>
  );
}
