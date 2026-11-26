"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export default function TopNav() {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating closes it
  // without a setState-in-effect (react-hooks/set-state-in-effect).
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);
  const isLight = pathname === "/guest";
  const theme = isLight ? "light" : "dark";

  const links = [
    { href: "/", label: "Home" },
    { href: "/episodes", label: "Podcast" },
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav className={`nav ${theme}`}>
      <Link href="/" className="nav-logo">
        <img
          src={`/assets/logo-mark-${isLight ? "navy-ink" : "cream"}.png`}
          alt="House of Track"
          style={{ height: 30 }}
        />
        <span className="nm">House of Track</span>
      </Link>
      <button
        className="nav-toggle"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <Icon name={open ? "x" : "menu"} size={24} />
      </button>
      <div className={`nav-links${open ? " open" : ""}`}>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link${pathname === href ? " active" : ""}`}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
        <Link href="/#join" className={`btn btn-${isLight ? "primary" : "cream"}`} data-tego-cta="join-network-nav" onClick={() => setOpen(false)}>
          <Icon name="users" size={16} />
          Join the Network
        </Link>
      </div>
    </nav>
  );
}
