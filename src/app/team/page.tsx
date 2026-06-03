import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata = {
  title: "Team — House of Track",
  description: "The people behind House of Track.",
};

export default function TeamPage() {
  return (
    <div>
      <section className="team-hero grain">
        <div className="team-hero-inner">
          <p className="eyebrow coral">The People</p>
          <h1>Behind<br />the House</h1>
          <p>House of Track is built by people who love this sport and the humans inside it. It starts with one — and a belief that every story deserves to be told well.</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap profile">
          <div className="profile-portrait">
            <span className="profile-tag"><span className="tag tag-ink">Founder</span></span>
            <img src="/assets/david-portrait-2.jpg" alt="David Ribich" />
          </div>
          <div>
            <p className="profile-role">Founder · Host</p>
            <h2>David Ribich</h2>
            <p className="sub">Professional middle-distance runner</p>
            <p className="bio">David is the founder of House of Track and the voice behind every conversation. A professional middle-distance runner, he started HOT to tell the stories the sport too often skips — the fear, the failure, the people who show up before anyone&apos;s watching.</p>
            <p className="bio">His approach is simple: this isn&apos;t an interview, it&apos;s a conversation. Track and field is the language we all share, but the human is always the story.</p>

            <div className="profile-quote">
              <p>&ldquo;Our vision is to redefine the narrative of track and field — connecting people through extraordinary stories and inspiring a deeper appreciation for the sport and the individuals behind it.&rdquo;</p>
              <cite>— David Ribich, Founder</cite>
            </div>

            <div className="profile-stats">
              <div className="profile-stat"><div className="num">Founder</div><div className="cap">House of Track</div></div>
              <div className="profile-stat"><div className="num">Host</div><div className="cap">Every Episode</div></div>
              <div className="profile-stat"><div className="num">Pro</div><div className="cap">Middle Distance</div></div>
            </div>

            <div className="profile-social">
              <a className="social-btn" href="https://www.instagram.com/houseoftrack.hot/" target="_blank" rel="noopener" aria-label="Instagram"><Icon name="instagram" size={19} /></a>
              <a className="social-btn" href="https://www.youtube.com/@House_of_Track" target="_blank" rel="noopener" aria-label="YouTube"><Icon name="youtube" size={19} /></a>
              <a className="social-btn" href="https://open.spotify.com/show/0Vnmcv13lSwnCR7wCcEJta" target="_blank" rel="noopener" aria-label="Spotify"><Icon name="spotify" size={19} /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="section grain" style={{ background: "var(--navy-700)", paddingTop: 0 }}>
        <div className="wrap" style={{ paddingTop: 64 }}>
          <div className="sec-head">
            <div>
              <p className="eyebrow on-dark">How the House works</p>
              <h2 style={{ color: "var(--cream)" }}>One Conversation at a Time</h2>
            </div>
          </div>
          <div className="team-band">
            <div className="team-rolecard"><span className="ri">01</span><h4>Story First</h4><p>Every guest is met as a person, not a resume. We find the moment that matters and let it breathe.</p></div>
            <div className="team-rolecard"><span className="ri">02</span><h4>Raw &amp; Real</h4><p>No rehearsed answers, no script. The best moments come from the unexpected detours.</p></div>
            <div className="team-rolecard"><span className="ri">03</span><h4>Built to Share</h4><p>Full episodes, clips and promos — produced so every story reaches the people who need it.</p></div>
          </div>
          <div style={{ marginTop: 40, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/guest" className="btn btn-cream btn-lg">
              <Icon name="mic" size={16} />
              Be a Guest
            </Link>
            <Link href="/episodes" className="btn btn-outline-cream btn-lg">
              Hear the Show <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
