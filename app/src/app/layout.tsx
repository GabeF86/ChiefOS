import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "ChiefOS",
  description: "Personal command center for the Paoli anesthesia department.",
  applicationName: "ChiefOS",
  appleWebApp: {
    capable: true,
    title: "ChiefOS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF9F6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} antialiased`}
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
