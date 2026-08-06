// Seed data for the marketplace hub (Phase-0).
// The Library feed itself is no longer seeded here — it comes from the real
// YouTube ingest in lib/library.ts (see docs/YOUTUBE-INGEST-PLAN.md).

export type Discipline = "Sprints" | "Distance" | "Field" | "Trail";

export const DISCIPLINES: Discipline[] = ["Sprints", "Distance", "Field", "Trail"];

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
