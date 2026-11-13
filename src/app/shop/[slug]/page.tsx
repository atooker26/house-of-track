import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { formatCents, formatShipsBy, getProductPage, type ShopDrop } from "@/lib/shop/catalog";
import { checkoutOpen } from "@/lib/shop/stripe";
import BuyBox from "./BuyBox";
import NotifyForm from "./NotifyForm";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getProductPage(await getDb(), slug);
  if (!page) return { title: "Shop — House of Track" };
  const title = `${page.product.name} — House of Track`;
  const description = page.product.description.slice(0, 160) || `${page.product.name} from ${page.drop.title}.`;
  const cover = page.product.images[0];
  // A shared link should show the product, not the site logo.
  const images = cover ? [{ url: cover, alt: page.product.name }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images } : {}) },
  };
}

function closedLabel(drop: ShopDrop): string | null {
  if (drop.phase === "ended") return "This drop has ended";
  if (drop.phase === "upcoming") {
    return drop.startsAt
      ? `Opens ${drop.startsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" })} PT`
      : "Not open yet";
  }
  if (!checkoutOpen()) return "Opening soon";
  return null;
}

export default async function ProductPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const page = await getProductPage(await getDb(), slug);
  if (!page) notFound();
  const { drop, product } = page;
  const canBuy = drop.phase === "open" && checkoutOpen();
  const [cover, ...rest] = product.images;

  return (
    <section className="section shop-product">
      <div className="wrap">
        <p className="shop-crumb">
          <Link href="/shop">Shop</Link> / {drop.title}
        </p>
        <div className="shop-product-grid">
          <div className="shop-gallery">
            <div className="shop-gallery-main">
              {cover ? <Image src={cover} alt={product.name} fill priority sizes="(max-width: 768px) 100vw, 55vw" /> : null}
              {product.soldOut ? <span className="shop-badge">Sold out</span> : null}
            </div>
            {rest.length ? (
              <div className="shop-gallery-thumbs">
                {rest.map((src, i) => (
                  <div key={src} className="shop-gallery-thumb">
                    <Image src={src} alt={`${product.name}, photo ${i + 2}`} fill sizes="25vw" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="shop-product-info">
            <p className="eyebrow coral">{drop.title}</p>
            <h1 className="shop-product-name">{product.name}</h1>
            <p className="shop-product-price">{formatCents(product.priceCents)}</p>
            {product.run ? (
              <p className="shop-product-run">
                Limited run of {product.run.made}
                {drop.phase !== "upcoming" ? ` · ${product.run.left === 0 ? "sold out" : `${product.run.left} left`}` : ""}
              </p>
            ) : null}
            {product.description ? <p className="shop-product-desc">{product.description}</p> : null}
            <BuyBox
              variants={product.variants.map((v) => ({ id: v.id, label: v.label, available: v.available, heldOnly: v.heldOnly }))}
              canBuy={canBuy}
              closedLabel={closedLabel(drop)}
            />
            {!canBuy || product.soldOut ? <NotifyForm dropSlug={drop.slug} soldOut={product.soldOut} /> : null}
            <p className="shop-product-ship">
              Ships in the US{drop.shippingCents ? `, ${formatCents(drop.shippingCents)} flat` : ", free"}
              {drop.shipsBy ? `, by ${formatShipsBy(drop.shipsBy)}` : ""}. Secure checkout with Stripe.
            </p>
            {drop.policy ? <p className="shop-product-policy">{drop.policy}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
