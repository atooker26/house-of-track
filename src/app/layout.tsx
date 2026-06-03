import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Open_Sans } from "next/font/google";
import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-open-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "House of Track — Redefining the Narrative",
  description: "A podcast and storytelling platform dedicated to redefining the narrative of track and field. Share. Connect. Inspire.",
  openGraph: {
    title: "House of Track",
    description: "Authentic, human-centered storytelling that celebrates the person behind the athlete.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body>
        <TopNav />
        <main>{children}</main>
        <Footer />
        <Script
          src="https://www.tegomarketing.com/tego.js"
          data-slug="house-of-track"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
