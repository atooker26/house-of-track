"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

const I = {
  home: <path d="M3 11l9-8 9 8v10H3z M9 21v-6h6v6" />,
  orders: <path d="M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5" />,
  drops: <path d="M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7" />,
  team: <path d="M16 11a4 4 0 1 0-8 0 M4 21a8 8 0 0 1 16 0 M12 7a4 4 0 1 0 0 8a4 4 0 1 0 0-8" />,
  account: <path d="M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M4 21a8 8 0 0 1 16 0" />,
  site: <path d="M14 3h7v7 M21 3l-9 9 M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />,
  out: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9" />,
};

function Icon({ d }: { d: React.ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const NAV = [
  { href: "/admin", label: "Overview", icon: I.home },
  { href: "/admin/orders", label: "Orders", icon: I.orders, badge: true },
  { href: "/admin/drops", label: "Drops", icon: I.drops },
  { href: "/admin/team", label: "Team", icon: I.team },
  { href: "/admin/account", label: "Account", icon: I.account },
];

export default function Sidebar({ email, toShip }: { email: string; toShip: number }) {
  const pathname = usePathname();
  return (
    <aside className="adm-side">
      <Link href="/admin" className="adm-brand">
        <img src="/assets/logo-mark-cream.png" alt="" />
        <span>
          <b>House of Track</b>
          <span>Shop admin</span>
        </span>
      </Link>
      <nav className="adm-nav" aria-label="Admin">
        {NAV.map((n) => {
          const on = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
              <Icon d={n.icon} />
              {n.label}
              {n.badge && toShip > 0 && (
                <span className="adm-badge" aria-label={`${toShip} to ship`}>
                  {toShip}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="adm-side-foot">
        <div className="adm-who">{email}</div>
        <nav className="adm-nav" aria-label="Session">
          <a href="/shop" target="_blank" rel="noreferrer">
            <Icon d={I.site} />
            View shop
          </a>
          <SignOutButton>
            <Icon d={I.out} />
            Sign out
          </SignOutButton>
        </nav>
      </div>
    </aside>
  );
}
