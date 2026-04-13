import type { Metadata } from "next"
import { DM_Serif_Display, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"

/*
  Typography strategy:
  - DM Serif Display: Ava's name/identity — elegant, intelligent, not a tech cliché
  - IBM Plex Mono: Chat messages — monospace feels precise and technical,
    perfect for an AI that reasons through problems
*/
const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Ava",
  description: "AGI-level personal assistant",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${ibmPlexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
