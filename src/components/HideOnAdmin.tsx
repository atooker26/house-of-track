"use client";

import { usePathname } from "next/navigation";

/** The public site's chrome (nav, footer, TEGO pixel) stays off /admin and its auth pages. */
export function isConsolePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ["/admin", "/auth"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Pages shared by link that stand alone: no nav or footer, so a respondent stays
 * on the task (David R, 11/18: the coach survey shouldn't lead into the site).
 * The analytics pixel still loads there.
 */
export function isStandalonePath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ["/survey"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function HideOnAdmin({ children, standalone = false }: { children: React.ReactNode; standalone?: boolean }) {
  const pathname = usePathname();
  if (isConsolePath(pathname)) return null;
  if (standalone && isStandalonePath(pathname)) return null;
  return <>{children}</>;
}
