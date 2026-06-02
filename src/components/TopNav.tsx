"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export default function TopNav() {
  const pathname = usePathname();
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
      <div className="nav-links">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link${pathname === href ? " active" : ""}`}
          >
            {label}
          </Link>
        ))}
        <Link href="/guest" className={`btn btn-${isLight ? "primary" : "cream"}`}>
          <Icon name="mic" size={16} />
          Be a Guest
        </Link>
      </div>
    </nav>
  );
}
