import Link from "next/link";
import Image from "next/image";
import styles from "./Footer.module.scss";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Image src="/matchinsense-logo.svg" alt="MatchInsense" width={28} height={28} style={{ borderRadius: 6 }} />
          <span className={styles.brandName}>Match<strong>Insense</strong></span>
        </div>

        <p className={styles.tagline}>
          Live scores, AI-powered match insights and football intelligence — built for African fans.
        </p>

        <nav className={styles.links}>
          <Link href="/faq" className={styles.link}>FAQ</Link>
          <span className={styles.dot}/>
          <Link href="/contact" className={styles.link}>Contact</Link>
          <span className={styles.dot}/>
          <Link href="/privacy" className={styles.link}>Privacy Notice</Link>
          <span className={styles.dot}/>
          <Link href="/terms" className={styles.link}>Terms</Link>
        </nav>

        <p className={styles.copy}>
          © {new Date().getFullYear()} MatchInsense. All rights reserved.
          <span className={styles.disclaimer}>
            {" "}Football data provided by api-sports.io. Not affiliated with any football organisation.
          </span>
        </p>
      </div>
    </footer>
  );
}