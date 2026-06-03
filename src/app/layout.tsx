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
    siteName: "House of Track",
    images: [{ url: "/assets/og-image.svg", width: 1200, height: 630, alt: "House of Track — Redefining the Narrative" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "House of Track",
    description: "Authentic, human-centered storytelling that celebrates the person behind the athlete.",
    images: ["/assets/og-image.svg"],
  },
};

const podcastJsonLd = {
  "@context": "https://schema.org",
  "@type": "PodcastSeries",
  name: "House of Track",
  description: "A podcast and storytelling platform dedicated to redefining the narrative of track and field.",
  url: "https://house-of-track.vercel.app",
  author: { "@type": "Person", name: "David Ribich" },
  image: "/assets/og-image.svg",
  webFeed: "https://anchor.fm/s/107c9fe84/podcast/rss",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={openSans.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(podcastJsonLd) }}
        />
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
