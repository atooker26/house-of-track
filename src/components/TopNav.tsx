"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export default function TopNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  const isLight = pathname === "/guest";
  const theme = isLight ? "light" : "dark";

  const links = [
    { href: "/", label: "The Show" },
    { href: "/episodes", label: "Episodes" },
    { href: "/team", label: "Team" },
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
        <Link href="/guest" className={`btn btn-${isLight ? "primary" : "cream"}`} onClick={() => setOpen(false)}>
          <Icon name="mic" size={16} />
          Be a Guest
        </Link>
      </div>
    </nav>
  );
}
