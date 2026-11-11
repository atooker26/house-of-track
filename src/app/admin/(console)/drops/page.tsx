import Link from "next/link";
import { getDb } from "@/db";
import { listDrops } from "@/lib/admin/queries";
import { fmtDate, STATUS_LABEL } from "@/lib/admin/format";
import { formatCents } from "@/lib/shop/catalog";

export default async function DropsPage() {
  const rows = await listDrops(await getDb());
  return (
    <>
      <header className="adm-head">
        <div>
          <h1>Drops</h1>
          <p>/shop shows the newest live drop. Drafts stay hidden until you set them live.</p>
        </div>
        <Link href="/admin/drops/new" className="adm-btn primary">
          New drop
        </Link>
      </header>
      <section className="adm-card">
        {rows.length === 0 ? (
          <p className="adm-empty">
            No drops yet. <Link href="/admin/drops/new">Set up the first one</Link>.
          </p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Drop</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th className="num">Products</th>
                  <th className="num">Orders</th>
                  <th className="num">Sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link className="row-link" href={`/admin/drops/${d.id}`}>
                        {d.title}
                      </Link>
                      <div className="adm-sub">/{d.slug}</div>
                    </td>
                    <td>
                      <span className={`adm-pill ${d.status}`}>{STATUS_LABEL[d.status]}</span>
                      {d.status === "live" && d.phase !== "open" && (
                        <>
                          {" "}
                          <span className={`adm-pill ${d.phase}`}>{STATUS_LABEL[d.phase]}</span>
                        </>
                      )}
                    </td>
                    <td className="adm-sub">
                      {d.startsAt ? fmtDate(d.startsAt) : "Now"} → {d.endsAt ? fmtDate(d.endsAt) : "sold out"}
                    </td>
                    <td className="num">{d.productCount}</td>
                    <td className="num">{d.orders}</td>
                    <td className="num">{formatCents(d.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
