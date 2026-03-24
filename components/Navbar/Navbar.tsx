"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";
import styles from "./Navbar.module.scss";

export default function Navbar() {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [path]);

  const links = [
    { href: "/",          label: "Matches",          active: path === "/" || path.startsWith("/match") || path.startsWith("/team") },
    { href: "/schedule",  label: "Upcoming Matches", active: path === "/schedule" },
    { href: "/feed",      label: "Clubs",            active: path === "/feed" },
    { href: "/summaries", label: "AI Reports",       active: path === "/summaries" },
    { href: "/favorites", label: "Favorites",        active: path === "/favorites" },
  ];

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>

          {/* Logo */}
          <Link href="/" className={styles.logo}>
            <Image src="/matchinsense-lockup v2.svg" alt="MatchInsense" width={200} height={42} style={{ objectFit: "contain" }} />
          </Link>

          {/* Desktop nav — right */}
          <nav className={styles.nav}>
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`${styles.link} ${l.active ? styles.linkActive : ""}`}>
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Hamburger — mobile only */}
          <button className={styles.hamburger} onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`${styles.mobileLink} ${l.active ? styles.mobileLinkActive : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}