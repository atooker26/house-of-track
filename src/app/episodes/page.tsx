import { loadEpisodes } from "@/lib/episodes";
import Link from "next/link";
import Icon from "@/components/Icon";
import EpisodesClient from "./EpisodesClient";

export const metadata = {
  title: "Podcast — House of Track",
  description: "Every episode of the House of Track podcast.",
};

export default async function EpisodesPage() {
  const episodes = await loadEpisodes();
  return (
    <>
      <EpisodesClient episodes={episodes} />
      {/* Be a Guest (moved here from the homepage, 11/18) */}
      <section className="grain guest-cta-band" style={{ background: "radial-gradient(120% 130% at 80% 20%, #2A2E6B, #0D112D)" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow coral">Your story matters</p>
          <h2 className="guest-cta-h2">Be a Guest on HOT</h2>
          <p className="guest-cta-sub">
            This isn&apos;t an interview — it&apos;s a conversation. We keep it raw and real. Come share your journey.
          </p>
          <Link href="/guest" className="btn btn-cream btn-lg" data-tego-cta="be-a-guest">
            <Icon name="mic" size={16} />
            Apply to join the House
          </Link>
        </div>
      </section>
    </>
  );
}
