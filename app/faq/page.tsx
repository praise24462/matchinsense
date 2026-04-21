import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "FAQ — MatchInsense" };

const faqs = [
  {
    section: "General",
    items: [
      { q: "What is MatchInsense?", a: "MatchInsense is a free live football intelligence platform with real-time scores, AI match reports, lineups, standings, head-to-head data and highlights. It has a strong focus on African football alongside top European leagues." },
      { q: "Is MatchInsense free?", a: "Yes, completely free. No sign-up, no account, no payment. Open the app and start exploring." },
      { q: "Do I need to create an account?", a: "No. MatchInsense requires no registration or login of any kind. All features are freely accessible to everyone." },
      { q: "Which leagues are covered?", a: "All major European leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1), UEFA competitions (Champions League, Europa League), CAF competitions, and African leagues including NPFL (Nigeria), Ghana Premier League, Egyptian Premier League, South African PSL and more." },
      { q: "How often are scores updated?", a: "Live match scores update automatically every 60 seconds during active matches. No need to refresh manually." },
    ],
  },
  {
    section: "AI Features",
    items: [
      { q: "What are AI Reports?", a: "AI Reports are machine-generated match analyses. They include a Match Report (post-match narrative), a Match Preview (pre-match analysis) and a Betting Insight (AI-generated market analysis). All are clearly labelled as AI-generated." },
      { q: "How accurate are AI predictions?", a: "AI insights are generated for entertainment only and should not be used as betting or financial advice. The AI analyses statistics and form data but cannot guarantee any outcome. Please gamble responsibly." },
      { q: "Where are my AI reports saved?", a: "AI reports are saved in your browser's localStorage on your device. They are never sent to our servers. You can view them on the AI Reports page and delete them any time." },
    ],
  },
  {
    section: "Data & Privacy",
    items: [
      { q: "Do you collect my personal data?", a: "No. MatchInsense collects zero personal data. No name, email, location or device tracking. See our Privacy Notice for full details." },
      { q: "Do you use cookies or trackers?", a: "No advertising cookies, no tracking pixels, no analytics trackers. We use only browser localStorage to save AI reports on your own device." },
      { q: "How do I delete my AI reports?", a: "Go to the AI Reports page and click 'Clear all'. You can also clear localStorage directly in your browser settings." },
    ],
  },
  {
    section: "Technical",
    items: [
      { q: "Why are match statistics unavailable for some games?", a: "Statistics (possession, shots, passes) are available for top European leagues and select African leagues. Smaller leagues may not provide this data. Use the AI Match Report for analysis of any match." },
      { q: "Why is the lineup tab empty?", a: "Lineups are usually confirmed by clubs around 1 hour before kick-off. Check back closer to the match start time." },
      { q: "The app is not loading — what do I do?", a: "Try refreshing the page. If the problem persists, clear your browser cache or try a different browser. Contact support@matchinsense.com if the issue continues." },
      { q: "Are scores sometimes delayed?", a: "Live scores may occasionally be delayed by up to 2 minutes depending on our data provider. For critical moments we recommend checking multiple sources." },
    ],
  },
];

export default function FAQPage() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>

      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>Support</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
            Can't find your answer?{" "}
            <Link href="/contact" style={{ color: "var(--accent)" }}>Contact us</Link>.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        {faqs.map(section => (
          <div key={section.section} style={{ marginBottom: 44 }}>
            <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 16, margin: "0 0 16px" }}>
              {section.section}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {section.items.map((item, i) => (
                <details key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                  <summary style={{ padding: "14px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text)", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    {item.q}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, color: "var(--text-3)" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </summary>
                  <div style={{ padding: "12px 16px 14px", fontSize: 13, lineHeight: 1.75, color: "var(--text-2)", borderTop: "1px solid var(--border)" }}>
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}