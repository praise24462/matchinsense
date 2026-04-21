import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "../styles/globals.scss";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { NotificationPrompt } from "@/components/NotificationPrompt/NotificationPrompt";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar/ServiceWorkerRegistrar";

/**
 * Google Analytics 4 Measurement ID
 * Set via NEXT_PUBLIC_GA_ID environment variable
 */

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://matchinsense.com"),

  title: {
    default: "MatchInsense — Live Football Intelligence",
    template: "%s | MatchInsense",
  },
  description:
    "Live scores, AI-powered match reports, lineups and betting predictions for Premier League, La Liga, NPFL and more." ,

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

  manifest: "/manifest.json",
  icons: {
    icon: "/matchinsense-favicon.svg",
    apple: "/matchinsense-logo.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MatchInsense",
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
      "AI match reports, live scores and betting predictions.",
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

        {/* Phase 1: Goal notifications + PWA */}
        <NotificationPrompt />
        <ServiceWorkerRegistrar />

        {/* Google Analytics 4 */}
        <GoogleAnalytics />

        {/* Load gtag.js script globally */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />

        {/* Initialize Google Analytics */}
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { page_path: window.location.pathname });
          `}
        </Script>
      </body>
    </html>
  );
}