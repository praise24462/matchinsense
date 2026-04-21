import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact — MatchInsense" };

const contacts = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    title: "General Enquiries",
    desc: "Questions about the app, features or how things work.",
    email: "hello@matchinsense.com",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    title: "Technical Support",
    desc: "Bug reports, errors or anything not working as expected.",
    email: "support@matchinsense.com",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    title: "Privacy & Data",
    desc: "Privacy concerns or questions about how we handle data.",
    email: "privacy@matchinsense.com",
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
    title: "Partnerships",
    desc: "Media partnerships, collaborations or press enquiries.",
    email: "partners@matchinsense.com",
  },
];

export default function ContactPage() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>

      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>Get in touch</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>Contact Us</h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
            We'd love to hear from you — feedback, bug reports, partnerships or general enquiries.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 32 }}>
          {contacts.map(c => (
            <div key={c.title} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: "22px 20px" }}>
              <div style={{ width: 38, height: 38, background: "var(--accent-dim)", border: "1px solid var(--accent-mid)", borderRadius: "var(--r-md)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                {c.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>{c.title}</h3>
              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65, margin: "0 0 12px" }}>{c.desc}</p>
              <a href={`mailto:${c.email}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>{c.email}</a>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.65 }}>
            We aim to respond within <strong style={{ color: "var(--text-2)" }}>2 business days</strong>. For urgent issues, include "URGENT" in your subject line.
          </p>
        </div>
      </div>
    </div>
  );
}