import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "14px", textAlign: "center", padding: "24px", paddingTop: "54px",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.2em",
        textTransform: "uppercase", color: "var(--text-3)",
      }}>Error 404</div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontSize: "64px", fontWeight: 800,
        color: "var(--text)", margin: 0, letterSpacing: "0.06em", lineHeight: 1,
      }}>OFF PITCH</h1>
      <p style={{ fontSize: "13px", color: "var(--text-3)", maxWidth: "280px", lineHeight: 1.65, margin: 0 }}>
        This page doesn't exist. Head back to the matches.
      </p>
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <Link href="/" style={{
          padding: "9px 20px", background: "var(--accent)", color: "#000",
          borderRadius: "6px", fontWeight: 700, fontSize: "12px",
          fontFamily: "var(--font-display)", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>Back to Matches</Link>
      </div>
    </div>
  );
}