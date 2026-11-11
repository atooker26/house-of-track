import Script from "next/script";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { orderCounts } from "@/lib/admin/queries";
import Sidebar from "@/components/admin/Sidebar";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const counts = await orderCounts(await getDb());
  const widgetKey = process.env.NEXT_PUBLIC_TEGO_WIDGET_KEY?.trim();

  return (
    <div className="adm-shell">
      <Sidebar email={me.email} toShip={counts.toShip} />
      <main className="adm-main">{children}</main>
      {/* TEGO request widget: admin only, never on the public site. Edits and feature
          requests land as tickets in the house-of-track Space, with the signed-in
          admin's email so TEGO's reply reaches them. The key is the client's TEGO
          widget secret (it ships in the page by design); regenerating it in TEGO
          breaks this until NEXT_PUBLIC_TEGO_WIDGET_KEY is updated. */}
      {widgetKey && (
        <Script
          id="tego-tickets"
          src="https://www.tegomarketing.com/tego-tickets.js"
          data-slug="house-of-track"
          data-key={widgetKey}
          data-accent="#4540BF"
          data-title="Need a change?"
          data-subtitle="Ask for an edit or a new feature. It goes straight to TEGO as a ticket."
          data-collect-email="false"
          data-email={me.email}
          data-position="bottom-right"
          strategy="afterInteractive"
        />
      )}
    </div>
  );
}
