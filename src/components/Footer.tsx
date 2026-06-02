import Link from "next/link";

export default function Footer() {
  return (
    <footer className="footer grain">
      <div className="footer-inner">
        <div className="footer-logo">
          <img src="/assets/logo-mark-cream.png" alt="House of Track" style={{ height: 64 }} />
          <p>
            A podcast and storytelling platform redefining the narrative of track and field.
            Share &middot; Connect &middot; Inspire.
          </p>
        </div>
        <div>
          <h5>Explore</h5>
          <Link href="/">The Show</Link>
          <Link href="/episodes">Episodes</Link>
          <Link href="/team">Team</Link>
          <Link href="/guest">Be a Guest</Link>
        </div>
        <div>
          <h5>Follow</h5>
          <a href="https://www.instagram.com/houseoftrack.hot/" target="_blank" rel="noopener">
            Instagram
          </a>
          <a href="https://www.youtube.com/@House_of_Track" target="_blank" rel="noopener">
            YouTube
          </a>
          <a href="https://open.spotify.com/show/0Vnmcv13lSwnCR7wCcEJta" target="_blank" rel="noopener">
            Spotify
          </a>
          <a href="https://bsky.app" target="_blank" rel="noopener">
            Bluesky
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; {new Date().getFullYear()} House of Track</span>
        <span>Celebrating the human behind the athlete.</span>
      </div>
    </footer>
  );
}
