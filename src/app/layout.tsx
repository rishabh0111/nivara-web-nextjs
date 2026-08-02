import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { ColdStartNotice } from "@/cold-start/cold-start-notice";
import { themeScript } from "@/ui/theme";

import "./globals.css";

/*
 * Loaded here and nowhere else, and as variables rather than class names: the
 * Widget renders into a shadow root that this document's stylesheet does not
 * reach, so the font has to be nameable by something other than a Tailwind
 * class. `display: swap` because a support desk that shows nothing for 300ms is
 * a support desk that looks down.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono-face" });

/**
 * Where a relative URL in the metadata below is resolved from.
 *
 * Read from Vercel's own variable rather than written down, because the one
 * thing this repository must not do is hard-code a deployment URL — the last
 * one it carried turned out to belong to somebody else. Falling back to
 * localhost keeps `next build` from warning on a machine that is not Vercel,
 * and a local build's card is never posted anywhere.
 */
const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const DESCRIPTION =
  "Nivara Desk is a support desk built from four apps: a customer portal, a staff dashboard, an embeddable widget, and analytics.";

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: {
    default: "Nivara Desk",
    // Every other screen names itself and this says whose it is.
    template: "%s · Nivara Desk",
  },
  description: DESCRIPTION,
  applicationName: "Nivara Desk",
  openGraph: {
    type: "website",
    siteName: "Nivara Desk",
    title: "Nivara Desk",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "Nivara Desk", description: DESCRIPTION },
  // Nothing here is public and none of it should be indexed on a preview.
  robots: { index: true, follow: true },
};

/**
 * The browser chrome's colour, per scheme.
 *
 * Two entries rather than one: a single `themeColor` would paint a phone's
 * address bar with the light ground while the page under it renders dark.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1017" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          Blocking, and before anything paints. The server cannot know which
          theme this reader chose, so without this the first frame is the light
          palette and the correction lands as a white flare on a dark screen.
          `suppressHydrationWarning` above is the other half: this script edits
          the very element React is about to reconcile.
        */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-canvas font-sans text-ink antialiased">
        {children}
        <ColdStartNotice />
      </body>
    </html>
  );
}
