import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

// Ported from the prototype's Google Fonts import in src/style.css:
// Space Grotesk (500,700) for headings, Source Sans 3 (400,600) for
// body copy, IBM Plex Mono (400,500) for metadata/labels/data.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
  subsets: ["latin"],
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans",
  weight: ["400", "600"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

// The web app manifest itself lives in app/manifest.ts (linked
// automatically); this is the matching per-page metadata so the
// installed app is named and iconed consistently on Android and iOS.
export const metadata: Metadata = {
  title: "Shamba Space — Everything farming. In one space.",
  description:
    "Everything farming. In one space. Learn from farmers, share your farm, and get weather insights, communities, farming guides and a marketplace.",
  applicationName: "Shamba Space",
  appleWebApp: {
    capable: true,
    title: "Shamba Space",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3eedc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${sourceSans3.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
