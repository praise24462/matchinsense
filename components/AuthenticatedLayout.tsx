"use client";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", width: "100%" }}>
      <Navbar />
      <main style={{ flex: 1, width: "100%", minWidth: 0, overflow: "hidden" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}