import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The shop. One drop at a time is the normal case, but drops are rows so the
 * next one can be set up while the current one is still selling.
 *
 * Money is integer cents everywhere. Every table has RLS on with no policies
 * (see drizzle/0000): the app connects as a server-side role, and nothing here
 * should ever be reachable through Supabase's Data API.
 */

export const DROP_STATUSES = ["draft", "live", "closed"] as const;
export type DropStatus = (typeof DROP_STATUSES)[number];

export const drops = pgTable("drops", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  blurb: text("blurb").notNull().default(""),
  /** draft = hidden; live = on /shop (selling once startsAt passes); closed = shown, not selling. */
  status: text("status").$type<DropStatus>().notNull().default("draft"),
  /** Before this, /shop shows a countdown and checkout is refused. Null = open now. */
  startsAt: timestamp("starts_at", { withTimezone: true }),
  /** After this, checkout is refused. Null = open until sold out or closed. */
  endsAt: timestamp("ends_at", { withTimezone: true }),
  /** Flat US shipping per order for this drop. */
  shippingCents: integer("shipping_cents").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    dropId: integer("drop_id")
      .notNull()
      .references(() => drops.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    /** Public image paths/URLs, first is the cover. */
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    active: integer("active").notNull().default(1),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("products_drop_idx").on(t.dropId), check("products_price_nonneg", sql`${t.priceCents} >= 0`)],
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    /** What the buyer picks: "One size", "M", "Navy / L". */
    label: text("label").notNull(),
    sku: text("sku").notNull().unique(),
    /** Units that exist. Null = unlimited (print-to-order). */
    stockQty: integer("stock_qty"),
    /** Held by open checkouts. Released on expiry, moved to `sold` on payment. */
    reserved: integer("reserved").notNull().default(0),
    sold: integer("sold").notNull().default(0),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    check("variants_counts_nonneg", sql`${t.reserved} >= 0 and ${t.sold} >= 0`),
    // The oversell guard in the database itself, not just in the UPDATE's WHERE.
    check("variants_no_oversell", sql`${t.stockQty} is null or ${t.sold} + ${t.reserved} <= ${t.stockQty}`),
  ],
);

export const ORDER_STATUSES = ["pending", "paid", "fulfilled", "cancelled", "refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type ShippingAddress = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Human order number, e.g. HOT-1001. Also the TEGO purchase externalId. */
    number: text("number").notNull().unique(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    dropId: integer("drop_id")
      .notNull()
      .references(() => drops.id),
    email: text("email"),
    name: text("name"),
    shipping: jsonb("shipping").$type<ShippingAddress>(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    stripeSessionId: text("stripe_session_id").unique(),
    paymentIntentId: text("payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Set from /admin when the order ships. Tracking is optional (a hand-delivered order has none). */
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    trackingCarrier: text("tracking_carrier"),
    trackingNumber: text("tracking_number"),
    /** Internal only: never shown to the buyer or sent anywhere. */
    adminNote: text("admin_note").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id),
    /** Snapshotted at checkout so later catalog edits don't rewrite history. */
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    sku: text("sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_qty_pos", sql`${t.qty} > 0`)],
);

/** Stripe retries webhooks; each event id is handled once. */
export const processedStripeEvents = pgTable("processed_stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Who can use /admin. Keyed on the Supabase Auth user id (auth.users.id); a login
 * that isn't in here is turned away. Read by the app as the table owner, and by
 * the SQL function public.is_admin() for the storage bucket's policies (see
 * supabase/admin.sql, which is Supabase-only and stays out of these migrations
 * so PGlite can still run them).
 */
export const admins = pgTable("admins", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Who gets the "New order" email. Edited in /admin/settings. When this is empty the
 * ORDER_ALERT_EMAILS env var is the fallback, so an existing setup keeps working.
 */
export const orderAlertRecipients = pgTable("order_alert_recipients", {
  email: text("email").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
