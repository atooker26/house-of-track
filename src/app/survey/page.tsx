import SurveyForm from "./SurveyForm";

export const metadata = {
  title: "Coach Uniform Survey — House of Track",
  description: "Three quick questions for high school track and cross country coaches about team uniforms.",
  // Shared by link with coaches, not something to rank for.
  robots: { index: false, follow: false },
};

export default function SurveyPage() {
  return (
    <section className="guest-hero section">
      <div className="wrap survey-wrap">
        <p className="eyebrow coral">For coaches</p>
        <h1>Team uniforms,<br />three questions</h1>
        <p className="survey-lede">
          We&apos;re talking to high school track and cross country coaches about how uniform orders actually get made. It
          takes under a minute.
        </p>
        <SurveyForm />
      </div>
    </section>
  );
}
