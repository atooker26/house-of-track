import GuestForm from "./GuestForm";
import Icon from "@/components/Icon";

export const metadata = {
  title: "Be a Guest — House of Track",
  description: "Apply to be a guest on the House of Track podcast.",
};

export default function GuestPage() {
  const tips = [
    { h: "Be yourself", p: "Your personality is what makes the episode great." },
    { h: "A conversation, not an interview", p: "No rehearsed answers — we keep it raw and real." },
    { h: "Bring your story", p: "Think about pivotal moments, in sport and in life." },
  ];

  return (
    <section className="guest-hero section">
      <div className="wrap guest-grid">
        <div>
          <p className="eyebrow coral">Be a Guest</p>
          <h1>Welcome to the<br />House of Track Family</h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 17, color: "var(--fg-2)", maxWidth: "46ch" }}>
            We are excited to share your journey. Being a guest on HOT is a unique experience — not just for those sharing their story, but for the listeners connecting with it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 30 }}>
            {tips.map(({ h, p }) => (
              <div key={h} style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: 6, background: "var(--navy-700)", color: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="plus" size={16} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em", fontSize: 16 }}>{h}</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--fg-2)" }}>{p}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <GuestForm />
      </div>
    </section>
  );
}
