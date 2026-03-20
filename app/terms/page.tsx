import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Use — MatchInsense" };

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>

      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>Legal</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px" }}>Terms of Use</h1>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontFamily: "var(--font-mono)" }}>Last updated: March 2026</p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px", display: "flex", flexDirection: "column", gap: 32 }}>

        {[
          {
            title: "1. Acceptance of Terms",
            body: `By accessing or using MatchInsense ("the Service", "the Platform"), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the Service.

These terms apply to all visitors and users. No account registration is required to access the Service.`
          },
          {
            title: "2. Description of Service",
            body: `MatchInsense is a free, publicly accessible football intelligence platform providing:
• Live and recent match scores and fixtures
• League standings, lineups and head-to-head statistics
• AI-generated match reports, previews and betting insights
• Football highlights sourced from YouTube

The Service is provided for personal, non-commercial use only.`
          },
          {
            title: "3. No Registration Required",
            body: `MatchInsense does not require users to create an account or provide any personal information. All features of the platform are freely accessible without sign-up or login.`
          },
          {
            title: "4. Acceptable Use",
            body: `You agree not to:
• Use the Service for any unlawful purpose or in violation of applicable law
• Scrape, harvest, copy or redistribute data from the Service at scale without written permission
• Use automated bots, crawlers or scripts to access the Service in a way that imposes unreasonable load
• Attempt to reverse engineer, decompile or gain unauthorised access to our API, database or infrastructure
• Interfere with the security, integrity or availability of the Service or its servers
• Misrepresent AI-generated content as professional financial or betting advice`
          },
          {
            title: "5. AI-Generated Content",
            body: `MatchInsense includes AI-generated match reports, previews and betting insights. This content is produced automatically and is provided for entertainment and informational purposes only.

AI content is clearly labelled throughout the platform. It should not be relied upon as factually accurate in all cases. MatchInsense does not warrant the accuracy, completeness or timeliness of any AI-generated content.`
          },
          {
            title: "6. Gambling & Betting Disclaimer",
            body: `IMPORTANT NOTICE: AI-generated betting insights displayed on MatchInsense are for entertainment purposes only. They do not constitute financial advice, betting tips or a recommendation to place any wager or bet.

MatchInsense accepts no liability for any financial loss arising from decisions made based on content on this platform.

Gambling involves risk. Only gamble with money you can afford to lose.
You must be 18 years of age or older to gamble in most jurisdictions.

If you or someone you know has a gambling problem, help is available:
• BeGambleAware (UK): begambleaware.org | 0808 8020 133
• GamCare (UK): gamcare.org.uk | 0808 8020 133
• National Problem Gambling Helpline (US): 1-800-522-4700
• NAPTIP (Nigeria): naptip.gov.ng

Please gamble responsibly.`
          },
          {
            title: "7. Intellectual Property",
            body: `All original content, design, code and branding on MatchInsense are the property of MatchInsense or its licensors. All rights reserved.

Football data is provided under licence from api-sports.io. Team crests, league logos and competition badges are the intellectual property of their respective owners (including FIFA, UEFA, CAF, national associations and individual clubs). They are used solely for identification and informational purposes.

MatchInsense is not affiliated with, endorsed by, or officially connected to any football league, club, governing body or competition.

You may not reproduce, distribute, modify or create derivative works from any content on the Service without prior written consent from MatchInsense.`
          },
          {
            title: "8. Third-Party Services & Links",
            body: `The Service uses third-party providers including api-sports.io (football data), Groq AI (AI generation) and YouTube (highlights). These operate under their own terms and conditions.

The Service may link to third-party websites. MatchInsense has no control over and accepts no responsibility for the content, privacy practices or accuracy of any third-party sites.`
          },
          {
            title: "9. Disclaimers",
            body: `The Service is provided "as is" and "as available" without warranties of any kind, express or implied.

MatchInsense does not guarantee:
• The accuracy or completeness of football data (live scores may be delayed by up to 2 minutes)
• Uninterrupted or error-free availability of the Service
• The accuracy, reliability or suitability of AI-generated content for any purpose

We reserve the right to modify, suspend or discontinue the Service at any time without notice.`
          },
          {
            title: "10. Limitation of Liability",
            body: `To the fullest extent permitted by applicable law, MatchInsense and its operators shall not be liable for any direct, indirect, incidental, special, consequential or punitive damages arising from:
• Your use of or inability to use the Service
• Reliance on any data, scores or AI-generated content on the platform
• Any financial loss from betting or gambling decisions
• Any interruption, suspension or termination of the Service`
          },
          {
            title: "11. Changes to These Terms",
            body: `We reserve the right to update these Terms of Use at any time. The date of the most recent update appears at the top of this page. Continued use of the Service after any changes constitutes acceptance of the revised terms.`
          },
          {
            title: "12. Governing Law",
            body: `These Terms of Use are governed by applicable law. Any disputes shall be subject to the exclusive jurisdiction of the relevant courts in the territory where MatchInsense operates.`
          },
          {
            title: "13. Contact",
            body: `For questions about these Terms of Use, contact us at: hello@matchinsense.com`
          },
        ].map(s => (
          <div key={s.title}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 10px", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>{s.title}</h2>
            <p style={{ fontSize: 13, lineHeight: 1.85, color: "var(--text-2)", margin: 0, whiteSpace: "pre-line" }}>{s.body}</p>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.65, margin: 0 }}>
            Questions? <a href="mailto:hello@matchinsense.com" style={{ color: "var(--accent)" }}>hello@matchinsense.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}