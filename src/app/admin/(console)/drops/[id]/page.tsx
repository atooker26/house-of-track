import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getDrop } from "@/lib/admin/queries";
import { STATUS_LABEL, toPacificInput } from "@/lib/admin/format";
import { formatCents } from "@/lib/shop/catalog";
import DropForm from "@/components/admin/DropForm";
import NewProduct from "@/components/admin/NewProduct";

export default async function DropPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getDrop(await getDb(), id);
  if (!data) notFound();
  const { drop: d, phase, products } = data;

  return (
    <>
      <p className="adm-crumb">
        <Link href="/admin/drops">Drops</Link> / {d.title}
      </p>
      <header className="adm-head">
        <div>
          <h1>{d.title}</h1>
          <p>
            <span className={`adm-pill ${d.status}`}>{STATUS_LABEL[d.status]}</span>
            {d.status === "live" && (
              <>
                {" "}
                <span className={`adm-pill ${phase}`}>{STATUS_LABEL[phase]}</span>
              </>
            )}
          </p>
        </div>
        {d.status !== "draft" && (
          <a className="adm-btn ghost" href="/shop" target="_blank" rel="noreferrer">
            View on /shop
          </a>
        )}
      </header>

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>Products</h2>
        </div>
        {products.length === 0 ? (
          <p className="adm-empty">No products yet. Add the first one below.</p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }} />
                  <th>Product</th>
                  <th>Sizes</th>
                  <th className="num">Price</th>
                  <th className="num">Sold</th>
                  <th className="num">Left</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const sold = p.variants.reduce((n, v) => n + v.sold, 0);
                  const unlimited = p.variants.some((v) => v.available === null);
                  const left = p.variants.reduce((n, v) => n + (v.available ?? 0), 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        {p.images[0] ? <img className="adm-thumb" src={p.images[0]} alt="" /> : <div className="adm-thumb" />}
                      </td>
                      <td>
                        <Link className="row-link" href={`/admin/products/${p.id}`}>
                          {p.name}
                        </Link>
                        <div className="adm-sub">
                          /shop/{p.slug}
                          {!p.active && (
                            <>
                              {" "}
                              · <span className="adm-pill closed">Hidden</span>
                            </>
                          )}
                          {p.images.length === 0 && (
                            <>
                              {" "}
                              · <span className="adm-pill warn">No photos</span>
                            </>
                          )}
                          {p.variants.length === 0 && (
                            <>
                              {" "}
                              · <span className="adm-pill warn">No sizes</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="adm-sub">{p.variants.map((v) => v.label).join(", ") || "—"}</td>
                      <td className="num">{formatCents(p.priceCents)}</td>
                      <td className="num">{sold}</td>
                      <td className="num">{unlimited ? "∞" : left}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <NewProduct dropId={d.id} nextSort={products.length} />
      </section>

      <section className="adm-card">
        <h2>Drop settings</h2>
        <DropForm
          id={d.id}
          initial={{
            title: d.title,
            slug: d.slug,
            blurb: d.blurb,
            status: d.status,
            startsAt: toPacificInput(d.startsAt),
            endsAt: toPacificInput(d.endsAt),
            shipping: (d.shippingCents / 100).toFixed(d.shippingCents % 100 ? 2 : 0),
          }}
        />
      </section>
    </>
  );
}
