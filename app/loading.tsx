export default function Loading() {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)", display: "flex",
      alignItems: "center", justifyContent: "center", paddingTop: "54px",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          border: "2px solid var(--border-hi)", borderTopColor: "var(--accent)",
          animation: "spin 0.7s linear infinite",
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-3)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          SCOREEDGE
        </span>
      </div>
    </div>
  );
}