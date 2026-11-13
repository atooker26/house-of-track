import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import Icon from "@/components/Icon";
import Subscribe from "@/app/hub/Subscribe";
import { getDb } from "@/db";
import { formatCents, getCurrentDrop } from "@/lib/shop/catalog";
import { checkoutOpen } from "@/lib/shop/stripe";
import Countdown from "./Countdown";

export const metadata: Metadata = {
  title: "Shop — House of Track",
  description: "Limited House of Track drops. When they're gone, they're gone.",
};

export default async function ShopPage() {
  await connection();
  const drop = await getCurrentDrop(await getDb());
  const selling = drop?.phase === "open" && checkoutOpen();

  return (
    <div>
      <section className="hero grain shop-hero">
        <div className="wrap shop-hero-inner">
          <p className="eyebrow on-dark">The House of Track shop</p>
          <h1>{drop ? drop.title : "Next drop soon"}</h1>
          {drop?.blurb ? <p className="lead">{drop.blurb}</p> : null}
          {drop?.phase === "upcoming" && drop.startsAt ? <Countdown to={drop.startsAt.toISOString()} /> : null}
          {drop?.phase === "ended" ? <p className="shop-flag">This drop has ended</p> : null}
          {drop?.phase === "open" && !checkoutOpen() ? <p className="shop-flag">Opening soon</p> : null}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {!drop || drop.products.length === 0 ? (
            <p className="shop-empty">Nothing in the shop right now. Get on the list below and you&apos;ll hear first.</p>
          ) : (
            <div className="shop-grid">
              {drop.products.map((p) => (
                <Link key={p.id} href={`/shop/${p.slug}`} className="shop-card">
                  <div className="shop-card-art">
                    {p.images[0] ? (
                      <Image src={p.images[0]} alt={p.name} fill sizes="(max-width: 768px) 100vw, 33vw" />
                    ) : null}
                    {p.soldOut ? <span className="shop-badge">Sold out</span> : null}
                  </div>
                  <div className="shop-card-body">
                    <h2 className="shop-card-name">{p.name}</h2>
                    {p.run && drop.phase !== "upcoming" && !p.soldOut ? <p className="shop-card-left">{p.run.left} left</p> : null}
                    <p className="shop-card-price">
                      {formatCents(p.priceCents)}
                      {selling && !p.soldOut ? (
                        <span className="shop-card-cta">
                          Shop <Icon name="arrow" size={14} />
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section shop-list grain">
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow on-dark">Drops sell out</p>
          <h2 className="shop-list-h">Hear about the next one first</h2>
          <Subscribe />
        </div>
      </section>
    </div>
  );
}
