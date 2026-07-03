// Seed data for the marketplace hub (Phase-0 preview).
// Library items are SAMPLES for layout only — the real feed comes from the
// podcast RSS feed + David's YouTube/creator sheet (see docs/PRODUCT-PLAN.md).

export type Discipline = "Sprints" | "Distance" | "Field" | "Trail";

export const DISCIPLINES: Discipline[] = ["Sprints", "Distance", "Field", "Trail"];

export interface LibraryItem {
  id: string;
  discipline: Discipline;
  title: string;
  creator: string; // who shot / made it
  athlete: string; // who's in it
  platform: "youtube" | "instagram";
}

export const LIBRARY: LibraryItem[] = [
  { id: "l1", discipline: "Distance", title: "The final 200 — kick of the season", creator: "Miguel A.", athlete: "Josh Kerr", platform: "youtube" },
  { id: "l2", discipline: "Distance", title: "Sub-13 at altitude, full race edit", creator: "Xavier R.", athlete: "Cole Hocker", platform: "youtube" },
  { id: "l3", discipline: "Sprints", title: "Blocks to line, shot at 240fps", creator: "House of Track", athlete: "Emily Mackay", platform: "instagram" },
  { id: "l4", discipline: "Sprints", title: "Relay exchange, meet-day gallery", creator: "Miguel A.", athlete: "Western Oregon TF", platform: "instagram" },
  { id: "l5", discipline: "Field", title: "Long jump board work, slow-mo", creator: "Jake S.", athlete: "Holly Mills", platform: "youtube" },
  { id: "l6", discipline: "Field", title: "Throws circle, golden hour", creator: "House of Track", athlete: "PTF athletes", platform: "instagram" },
  { id: "l7", discipline: "Trail", title: "Skyline ridge, first light", creator: "Currently Running", athlete: "Portland crew", platform: "youtube" },
  { id: "l8", discipline: "Trail", title: "Beer mile pop-up, guerrilla cut", creator: "House of Track", athlete: "PTF community", platform: "instagram" },
  { id: "l9", discipline: "Distance", title: "Warmup laps + start-line nerves", creator: "Xavier R.", athlete: "Christian Jackson", platform: "youtube" },
];

export interface Meet {
  name: string;
  location: string;
  window: string;
  credentialed: boolean; // HOT already holds this credential
}

export const MEETS: Meet[] = [
  { name: "Portland Track Festival", location: "Portland, OR", window: "Jun", credentialed: true },
  { name: "USATF Outdoor Championships", location: "Eugene, OR", window: "Jul", credentialed: true },
  { name: "Prefontaine Classic", location: "Eugene, OR", window: "Sep", credentialed: false },
  { name: "Camel City Elite", location: "Winston-Salem, NC", window: "Feb", credentialed: false },
  { name: "Millrose Games", location: "New York, NY", window: "Feb", credentialed: false },
];

export const PARTNERS = ["Portland Track Festival", "USATF", "Tracklandia", "Currently Running"];

const GRADS = [
  "radial-gradient(120% 120% at 30% 20%, #2A2E6B, #0D112D)",
  "radial-gradient(120% 120% at 70% 15%, #3A3E86, #0D112D)",
  "linear-gradient(135deg, #1B2150, #2A1426)",
  "radial-gradient(120% 120% at 25% 25%, #22285C, #161B45)",
];

export function libThumb(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}
