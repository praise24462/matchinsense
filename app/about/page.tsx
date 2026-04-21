import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About — MatchInsense" };

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>
      {/* Header Section */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>
            About Us
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>
            About MatchInsense
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", maxWidth: 480, lineHeight: 1.7, margin: 0 }}>
            Built for football fans who want intelligent insights, not just scores.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        {/* Mission Section */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 20, margin: "0 0 20px" }}>
            Our Mission
          </h2>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "24px 26px" }}>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-2)", margin: "0 0 16px" }}>
              MatchInsense exists to bring <strong>intelligent football analysis to every fan</strong>, with special focus on African football that's often overlooked by mainstream platforms.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-2)", margin: 0 }}>
              We believe that every match tells a story—through form, head-to-head history, team structure, injury status, and statistical patterns. Our mission is to uncover these stories using AI and data, making football <strong>smarter, more interactive, and more enjoyable</strong>.
            </p>
          </div>
        </section>

        {/* What Makes Us Different */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 20, margin: "0 0 20px" }}>
            What Makes Us Different
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Feature 1 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>🌍</span> African Football First
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                While most platforms focus on Europe, we spotlight African leagues with equal prominence. NPFL, Ghana Premier League, CAF competitions—all live and analyzed.
              </p>
            </div>

            {/* Feature 2 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>🤖</span> AI-Powered Insights
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                Our AI analyzes team form, head-to-head records, injury news, and statistical patterns to generate intelligent match reports and pre-match previews automatically.
              </p>
            </div>

            {/* Feature 3 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>🔓</span> Completely Free & Independent
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                No ads, no sign-up, no paywall. Access everything instantly. We're not owned by betting companies—we're built for fans, by football enthusiasts.
              </p>
            </div>

            {/* Feature 4 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>🛡️</span> Your Privacy, Protected
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                We collect zero personal data. No tracking, no profiling, no analytics cookies. Your football intelligence stays yours alone.
              </p>
            </div>

            {/* Feature 5 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>⚡</span> Real-Time & Comprehensive
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                Live scores update every 60 seconds. Access lineups, standings, head-to-head records, injury lists, and weather data all in one place.
              </p>
            </div>

            {/* Feature 6 */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "20px 22px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color: "var(--accent)" }}>📊</span> Data-Driven Accuracy
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
                Every prediction and insight is backed by historical data, team statistics, and AI model calibration. No guesswork—just intelligent analysis.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "32px 26px", textAlign: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>
            Have questions or feedback?
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 20px" }}>
            We'd love to hear from you. Reach out with suggestions, bug reports, or just to say hello.
          </p>
          <Link href="/contact" style={{ display: "inline-block", padding: "10px 24px", background: "var(--accent)", color: "var(--text)", fontWeight: 600, fontSize: 13, borderRadius: "var(--r-md)", textDecoration: "none", transition: "opacity 0.2s" }}>
            Get in Touch
          </Link>
        </section>
      </div>
    </div>
  );
}
