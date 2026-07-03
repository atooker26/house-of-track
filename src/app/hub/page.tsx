import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Lanes from "@/components/Lanes";
import Icon from "@/components/Icon";
import LibraryPreview from "./LibraryPreview";
import JoinForms from "./JoinForms";
import Subscribe from "./Subscribe";
import { MEETS } from "@/lib/hub";

export const metadata: Metadata = {
  title: "House of Track — The Creative Network for Track & Field",
  description:
    "Where the sport's creatives and athletes connect. Get credentialed, get discovered, and get the shots of you from every meet.",
};

export default function HubPage() {
  return (
    <div>
      {/* Hero — two doors */}
      <section className="hero grain">
        <div className="hero-inner">
          <div className="fade">
            <p className="eyebrow on-dark">The creative network for track &amp; field</p>
            <h1>
              The sport&apos;s
              <br />
              creatives + athletes,
              <br />
              in one place.
            </h1>
            <p className="lead">
              Track&apos;s only home for the people who shoot it — and the athletes who need them.
              Get credentialed, get discovered, and get the shots of you from every meet.
            </p>
            <div className="hub-hero-cta">
              <Link href="#join" className="btn btn-cream btn-lg">
                <Icon name="camera" size={16} />
                Join as a creative
              </Link>
              <Link href="#join" className="btn btn-outline-cream btn-lg">
                <Icon name="users" size={16} />
                Join as an athlete
              </Link>
            </div>
            <p style={{ margin: "6px 0 0" }}>
              <a href="#library" className="listen-on-link" style={{ color: "var(--fg-on-dark-2)" }}>
                Just here to watch? Explore the library <Icon name="arrow" size={15} />
              </a>
            </p>
            <Lanes />
          </div>
          <div className="hero-mark fade">
            <Image
              src="/assets/logo-mark-cream.png"
              alt="House of Track"
              width={320}
              height={320}
              priority
            />
          </div>
        </div>
      </section>

      {/* Two sides, one network */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head two-sides-head">
            <div>
              <p className="eyebrow coral">How it works</p>
              <h2 style={{ color: "var(--ink)" }}>Two sides, one network</h2>
            </div>
            <p className="two-sides-lede">
              Creatives bring the lens. Athletes bring the story. House of Track closes the gap
              between them.
            </p>
          </div>

          <div className="two-sides">
            {/* Creatives — dark side */}
            <div className="side side-dark grain">
              <div className="side-head">
                <span className="side-num">01</span>
                <span className="tag tag-out-dark">
                  <Icon name="camera" size={13} /> Creatives
                </span>
              </div>
              <h3 className="side-title">Shoot the sport you love</h3>
              <p className="side-sub">Credentials, discovery, and a platform to build your name.</p>
              <ul className="side-feats">
                <li className="side-feat">
                  <span className="fi"><Icon name="ticket" size={16} /></span>
                  <p>Get credentialed to shoot partnered meets under the House of Track banner.</p>
                </li>
                <li className="side-feat">
                  <span className="fi"><Icon name="camera" size={16} /></span>
                  <p>Get discovered by athletes and brands who need track-native talent.</p>
                </li>
                <li className="side-feat">
                  <span className="fi"><Icon name="share" size={16} /></span>
                  <p>Deliver your work, get credited, and reach the whole sport.</p>
                </li>
              </ul>
              <Link href="#join" className="btn btn-cream">
                Join as a creative <Icon name="arrow" size={16} />
              </Link>
            </div>

            {/* Athletes — light side */}
            <div className="side side-light">
              <div className="side-head">
                <span className="side-num">02</span>
                <span className="tag tag-out">
                  <Icon name="users" size={13} /> Athletes
                </span>
              </div>
              <h3 className="side-title">Never miss your shot</h3>
              <p className="side-sub">The photos of you from every meet — found, tagged, and sent.</p>
              <ul className="side-feats">
                <li className="side-feat">
                  <span className="fi"><Icon name="camera" size={16} /></span>
                  <p>Get the photos of you from every meet — no more DMing around asking who shot you.</p>
                </li>
                <li className="side-feat">
                  <span className="fi"><Icon name="bell" size={16} /></span>
                  <p>Get auto-notified the moment a creative tags you in their shoot.</p>
                </li>
                <li className="side-feat">
                  <span className="fi"><Icon name="users" size={16} /></span>
                  <p>Connect with the creatives who cover your events and tell your story.</p>
                </li>
              </ul>
              <Link href="#join" className="btn btn-accent">
                Join as an athlete <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Credentialing */}
      <section className="section" style={{ background: "var(--paper)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Credentialing</p>
              <h2 style={{ color: "var(--ink)" }}>One pass to shoot the sport</h2>
            </div>
          </div>
          <p style={{ color: "var(--fg-2)", maxWidth: "60ch", marginTop: "-12px", marginBottom: 28 }}>
            There&apos;s no master list for getting credentialed in track &amp; field — every meet is
            a separate ask. House of Track is building the single hub, and lending our name to
            creatives who do great work. We&apos;re already credentialed at USATF and Portland Track
            Festival.
          </p>
          <div className="meet-list">
            {MEETS.map((m) => (
              <div className="meet-row" key={m.name}>
                <div>
                  <p className="m-name">{m.name}</p>
                  <p className="m-meta">
                    {m.location} · {m.window}
                  </p>
                </div>
                {m.credentialed ? (
                  <span className="tag tag-ink">
                    <Icon name="check" size={13} /> HOT credentialed
                  </span>
                ) : (
                  <span className="tag tag-out">Credential available</span>
                )}
                <Link href="#join" className="btn btn-ghost">
                  <Icon name="ticket" size={16} /> Request credential
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Library — watch the sport */}
      <section className="section grain on-navy" style={{ background: "var(--navy-700)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow on-dark">Watch the sport</p>
              <h2 style={{ color: "var(--cream)" }}>The library</h2>
            </div>
            <span className="tag tag-out-dark">Sample — feeds from RSS + creator sheet</span>
          </div>
          <LibraryPreview />
        </div>
      </section>

      {/* Join */}
      <section className="section guest-hero" id="join">
        <div className="wrap">
          <div className="guest-grid">
            <div>
              <p className="eyebrow coral">Get involved</p>
              <h1 className="guest-hero-h1">Join the network</h1>
              <p style={{ color: "var(--fg-2)", fontSize: 18, maxWidth: "46ch" }}>
                Whether you&apos;re behind the camera or on the track, this is your way in. Tell us
                who you are — we&apos;re seeding the roster now, ahead of the next meet.
              </p>
              <ul className="path-list" style={{ marginTop: 24 }}>
                <li>
                  <Icon name="check" size={16} /> Free to join while we build.
                </li>
                <li>
                  <Icon name="check" size={16} /> Credentials handled through House of Track.
                </li>
                <li>
                  <Icon name="check" size={16} /> Your work, credited and distributed.
                </li>
              </ul>
            </div>
            <JoinForms />
          </div>
        </div>
      </section>

      {/* Weekly recap */}
      <section
        className="grain guest-cta-band"
        style={{ background: "radial-gradient(120% 130% at 80% 20%, #2A2E6B, #0D112D)" }}
      >
        <div className="wrap" style={{ textAlign: "center" }}>
          <p className="eyebrow coral">The weekly recap</p>
          <h2 className="guest-cta-h2">Everything the sport made this week</h2>
          <p className="guest-cta-sub">
            One email. Every athlete and creative who posted, in one place. No noise.
          </p>
          <Subscribe />
        </div>
      </section>
    </div>
  );
}
