import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — House of Track",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
