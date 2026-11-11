import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getProduct } from "@/lib/admin/queries";
import { ProductDetails, DeleteProduct } from "@/components/admin/ProductForm";
import Photos from "@/components/admin/Photos";
import Variants from "@/components/admin/Variants";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getProduct(await getDb(), id);
  if (!data) notFound();
  const { product: p, drop, hasOrders } = data;

  return (
    <>
      <p className="adm-crumb">
        <Link href="/admin/drops">Drops</Link> / <Link href={`/admin/drops/${drop.id}`}>{drop.title}</Link> / {p.name}
      </p>
      <header className="adm-head">
        <div>
          <h1>{p.name}</h1>
          <p>{p.active ? <>On /shop/{p.slug} while the drop is live.</> : <span className="adm-pill closed">Hidden</span>}</p>
        </div>
        {drop.status !== "draft" && p.active && (
          <a className="adm-btn ghost" href={`/shop/${p.slug}`} target="_blank" rel="noreferrer">
            View on /shop
          </a>
        )}
      </header>

      <section className="adm-card">
        <h2>Photos</h2>
        <Photos productId={p.id} images={p.images} />
      </section>

      <section className="adm-card">
        <h2>Sizes and stock</h2>
        <Variants productId={p.id} productSlug={p.slug} variants={p.variants} />
      </section>

      <section className="adm-card">
        <h2>Details</h2>
        <ProductDetails
          id={p.id}
          initial={{
            name: p.name,
            slug: p.slug,
            description: p.description,
            price: (p.priceCents / 100).toFixed(p.priceCents % 100 ? 2 : 0),
            active: p.active === 1,
            sort: String(p.sort),
          }}
          hasOrders={hasOrders}
        />
      </section>

      {!hasOrders && <DeleteProduct id={p.id} />}
    </>
  );
}
