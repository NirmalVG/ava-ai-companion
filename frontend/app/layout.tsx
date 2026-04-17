/*
  app/layout.tsx — Root layout (Server Component)

  Handles: HTML structure, fonts, metadata.
  Delegates client-side shell (drawer state, context) to ShellProvider.
*/

import type { Metadata } from "next"
import { Rajdhani, Space_Mono, Geist } from "next/font/google"
import "./globals.css"
import ShellProvider from "@/components/ShellProvider"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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

export const metadata: Metadata = {
  title: "AVA — Adaptive Virtual Agent",
  description: "AGI-level personal assistant command interface",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn(rajdhani.variable, spaceMono.variable, "font-sans", geist.variable)}>
      <body>
        <ShellProvider>{children}</ShellProvider>
      </body>
    </html>
  )
}
