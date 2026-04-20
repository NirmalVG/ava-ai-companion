/*
  app/layout.tsx — Root layout (Server Component)

  Handles: HTML structure, fonts, metadata.
  Delegates client-side shell (drawer state, context) to ShellProvider.
*/

import type { Metadata } from "next"
import { Rajdhani, Space_Mono, Geist } from "next/font/google"
import "./globals.css"
import ShellProvider from "@/components/ShellProvider"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
})

export const viewport = {
  themeColor: "#000000", // Important for the mobile browser address bar color
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevents iOS from zooming in on input focus
}

export const metadata: Metadata = {
  title: {
    default: "AVA — Adaptive Virtual Agent",
    template: "%s | AVA",
  },
  description: "AGI-level personal assistant command interface",
  manifest: "/manifest.json",
  icons: [
    {
      rel: "icon",
      url: "/icon-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      rel: "icon",
      url: "/icon-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      rel: "apple-touch-icon",
      url: "/apple-touch-icon.png",
      sizes: "192x192",
    },
    {
      rel: "shortcut icon",
      url: "/icon-192x192.png",
    },
  ],
  openGraph: {
    type: "website",
    title: "AVA — Adaptive Virtual Agent",
    description: "AGI-level personal assistant command interface",
    siteName: "AVA",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "AVA logo",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AVA — Adaptive Virtual Agent",
    description: "AGI-level personal assistant command interface",
    images: ["/icon-512x512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AVA",
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cn(
        rajdhani.variable,
        spaceMono.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body>
        <ShellProvider>{children}</ShellProvider>
      </body>
    </html>
  )
}
