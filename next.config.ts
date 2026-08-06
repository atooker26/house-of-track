import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "i.scdn.co" },
      { hostname: "mosaic.scdn.co" },
      { hostname: "image-cdn-ak.spotifycdn.com" },
      { hostname: "image-cdn-fa.spotifycdn.com" },
      // Library video thumbnails. Metadata + embeds only — no video is ever hosted here.
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**", search: "" },
    ],
  },
};

export default nextConfig;
