export const HOST = "David Ribich";
export const RSS_URL = "https://anchor.fm/s/107c9fe84/podcast/rss";
export const RSS_API = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}`;
export const SPOTIFY_SHOW = "0Vnmcv13lSwnCR7wCcEJta";
export const SPOTIFY_EP: Record<number, string> = {
  5: "3TE8qJGofmNxxu2cjJwYNm",
  4: "659NPghSdRdre1wALeWIoj",
  3: "14Vmknlu0VcSy7ayTZWjRl",
  2: "2A5ajTINutbeLesAuMLbHb",
  1: "4OlGEtUMF7rIepnhz1dTha",
};
export const PLATFORMS = [
  { id: "spotify", label: "Spotify", url: `https://open.spotify.com/show/${SPOTIFY_SHOW}` },
  { id: "apple", label: "Apple Podcasts", url: "https://podcasts.apple.com/us/podcast/house-of-track/id1873013767" },
  { id: "youtube", label: "YouTube", url: "https://www.youtube.com/@House_of_Track" },
] as const;
export const VALUES = [
  { i: "01", h: "Authenticity", p: "Bringing track and field to life through inclusive storytelling true to every athlete's experience." },
  { i: "02", h: "Humanity", p: "The shared dreams and emotions that connect us all — the person behind the athlete." },
  { i: "03", h: "Achievement", p: "Recognizing the inspiring journey and the extraordinary it brings to life." },
  { i: "04", h: "Innovation", p: "Fresh perspectives and dynamic storytelling that elevate the sport." },
];

export function spotifyUrlFor(n: number): string {
  return SPOTIFY_EP[n]
    ? `https://open.spotify.com/episode/${SPOTIFY_EP[n]}`
    : `https://open.spotify.com/show/${SPOTIFY_SHOW}`;
}

export function coverFor(n: string | number): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><radialGradient id='g' cx='30%' cy='20%'><stop offset='0' stop-color='#2A2E6B'/><stop offset='1' stop-color='#0D112D'/></radialGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='50%' y='52%' fill='#EDE9D8' font-family='Open Sans,sans-serif' font-size='200' font-weight='800' text-anchor='middle' dominant-baseline='middle' opacity='.9'>H</text><text x='50%' y='70%' fill='#EDE9D8' font-family='Open Sans,sans-serif' font-size='34' font-weight='700' letter-spacing='6' text-anchor='middle' opacity='.55'>EP ${n || ""}</text></svg>`
    )
  );
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}
