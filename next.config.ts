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
      // Channel avatars for creator profiles.
      { protocol: "https", hostname: "yt3.ggpht.com" },
      // Podcast CDN. loadEpisodes() prefers the Spotify oEmbed thumbnail, but that
      // only exists for episodes listed in SPOTIFY_EP — episode 9 onward falls back
      // to the feed's own image, which 400s if this host isn't allowed.
      { protocol: "https", hostname: "d3t3ozftmdmh3i.cloudfront.net" },
    ],
  },
};

export default nextConfig;
