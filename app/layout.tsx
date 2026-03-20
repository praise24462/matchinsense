import type { Metadata, Viewport } from "next";
import "../styles/globals.scss";
import Providers from "@/components/Providers";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";
import ServiceWorkerProvider from "@/components/ServiceWorkerProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "MatchInsense — Live Football Intelligence",
  description: "Live scores, AI-powered match reports, highlights and deep statistics for every football match. Built for African football fans.",
  icons: {
    icon: "/matchinsense-favicon.svg",
    apple: "/matchinsense-logo.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ServiceWorkerProvider>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </ServiceWorkerProvider>
        </Providers>
      </body>
    </html>
  );
}
