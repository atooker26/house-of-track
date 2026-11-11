"use client";

import { usePathname } from "next/navigation";

/** The public site's chrome (nav, footer, TEGO pixel) stays off /admin and its auth pages. */
export function isConsolePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ["/admin", "/auth"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function HideOnAdmin({ children }: { children: React.ReactNode }) {
  return isConsolePath(usePathname()) ? null : <>{children}</>;
}
