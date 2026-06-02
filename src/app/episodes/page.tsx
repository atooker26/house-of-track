import { loadEpisodes } from "@/lib/episodes";
import EpisodesClient from "./EpisodesClient";

export const metadata = {
  title: "Episodes — House of Track",
  description: "Every episode of the House of Track podcast.",
};

export default async function EpisodesPage() {
  const episodes = await loadEpisodes();
  return <EpisodesClient episodes={episodes} />;
}
