import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { orderAlertRecipients } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { envAlertRecipients, tegoConfigured } from "@/lib/shop/tego";
import { AddAlertRecipient, AlertRow } from "@/components/admin/Settings";

export default async function SettingsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(orderAlertRecipients).orderBy(asc(orderAlertRecipients.createdAt));
  const fallback = rows.length ? [] : envAlertRecipients();
  const emailOn = tegoConfigured();
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Settings</h1>
          <p>Who hears about new orders.</p>
        </div>
      </header>
      <section className="adm-card">
        <h2>Order alerts</h2>
        <p className="adm-note" style={{ marginTop: 0 }}>
          Everyone here gets an email the moment an order is paid: what was bought, the size, and the shipping address. Add whoever packs and ships.
        </p>
        {!emailOn && <p className="adm-empty">Email is off until TEGO_API_KEY is set, so no alerts go out yet.</p>}
        {rows.length > 0 ? (
          <table className="adm-table">
            <tbody>
              {rows.map((r) => (
                <AlertRow key={r.email} email={r.email} canTest={emailOn} />
              ))}
            </tbody>
          </table>
        ) : fallback.length > 0 ? (
          <p className="adm-empty">
            Using the default list from Vercel: {fallback.join(", ")}. Adding someone here copies those in, and from then on this list is the one used.
          </p>
        ) : (
          <p className="adm-empty">Nobody gets order alerts yet.</p>
        )}
        <AddAlertRecipient />
      </section>
    </>
  );
}
