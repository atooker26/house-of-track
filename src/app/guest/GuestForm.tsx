"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

export default function GuestForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="formcard" style={{ textAlign: "center", padding: "40px 32px" }}>
        <img src="/assets/logo-mark-navy-ink.png" alt="House of Track" style={{ height: 64, margin: "0 auto 18px" }} />
        <h3 style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", fontSize: "var(--t-h3)", lineHeight: 1.1, margin: "0 0 var(--s-3)" }}>Thank you</h3>
        <p style={{ fontFamily: "var(--font-body)", color: "var(--fg-2)" }}>Your story is now part of a bigger conversation. We&apos;ll be in touch soon.</p>
        <div style={{ marginTop: 14 }}>
          <span className="toast">&#10003; Application received</span>
        </div>
      </div>
    );
  }

  return (
    <div className="formcard">
      <form onSubmit={e => { e.preventDefault(); setSent(true); }}>
        <p className="eyebrow" style={{ margin: 0 }}>Guest application</p>
        <h3 style={{ fontFamily: "var(--font-cond)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", fontSize: "var(--t-h3)", lineHeight: 1.1, marginTop: 8, marginBottom: 22 }}>Tell us your story</h3>
        <div className="field">
          <label>Full name</label>
          <input required placeholder="Your name" />
        </div>
        <div className="field">
          <label>Email</label>
          <input required type="email" placeholder="you@email.com" />
        </div>
        <div className="field">
          <label>Discipline</label>
          <select>
            <option>Sprint</option>
            <option>Distance</option>
            <option>Field</option>
            <option>Hurdles</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label>What&apos;s your story?</label>
          <textarea rows={3} placeholder="A pivotal moment, on or off the track..." />
        </div>
        <button type="submit" className="btn btn-accent btn-lg">
          Submit application <Icon name="arrow" size={16} />
        </button>
      </form>
    </div>
  );
}
