import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../styles/globals.scss";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

// ── Replace with your real GA Measurement ID from analytics.google.com ──
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://matchinsense.com"),

  title: {
    default: "MatchInsense — Live Football Intelligence",
    template: "%s | MatchInsense",
  },
  description:
    "Live scores, AI-powered match reports, lineups and betting predictions for Premier League, La Liga, NPFL and more. Built for African football fans.",

  keywords: [
    "football analysis",
    "match prediction",
    "AI football",
    "NPFL",
    "Premier League",
    "live scores",
    "betting tips",
    "African football",
    "match report",
  ],

  authors: [{ name: "MatchInsense" }],
  creator: "MatchInsense",
  publisher: "MatchInsense",

  icons: {
    icon: "/matchinsense-favicon.svg",
    apple: "/matchinsense-logo.svg",
  },

  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://matchinsense.com",
    siteName: "MatchInsense",
    title: "MatchInsense — Live Football Intelligence",
    description:
      "AI-powered match reports, live scores and predictions for every football match. Built for African fans.",
    images: [
      {
        url: "/og-image.png", // create a 1200×630 image and drop it in /public
        width: 1200,
        height: 630,
        alt: "MatchInsense – AI Football Intelligence",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "MatchInsense — Live Football Intelligence",
    description:
      "AI match reports, live scores and betting predictions. Built for African football fans.",
    images: ["/og-image.png"],
    creator: "@matchinsense", // update when you create the account
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  alternates: {
    canonical: "https://matchinsense.com",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthenticatedLayout>{children}</AuthenticatedLayout>

        {/* Google Analytics — only loads when GA_ID is set */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}