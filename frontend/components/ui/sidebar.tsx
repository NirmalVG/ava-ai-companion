"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SidebarContextValue {
  isMobile: boolean
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function SidebarProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)")
    const sync = () => {
      const nextIsMobile = mediaQuery.matches
      setIsMobile(nextIsMobile)
      if (!nextIsMobile) {
        setOpen(false)
      }
    }

    sync()
    mediaQuery.addEventListener("change", sync)
    return () => mediaQuery.removeEventListener("change", sync)
  }, [])

  const value = React.useMemo(
    () => ({
      isMobile,
      open,
      setOpen,
      toggleSidebar: () => setOpen((current) => !current),
    }),
    [isMobile, open],
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }

  return context
}

export function Sidebar({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { setOpen } = useSidebar()

  return (
    <>
      <div
        className="sidebar-overlay"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside className={cn("sidebar", className)}>{children}</aside>
    </>
  )
}

export function SidebarInset({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <main className={cn("main-content", className)}>{children}</main>
}

export function SidebarHeader({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("sidebar-logo", className)}>{children}</div>
}

export function SidebarContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <nav className={cn("sidebar-nav", className)}>{children}</nav>
}

export function SidebarFooter({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("sidebar-footer", className)}>{children}</div>
}

export function SidebarTrigger({
  className,
}: {
  className?: string
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      type="button"
      className={cn("mobile-menu-btn", className)}
      onClick={toggleSidebar}
      aria-label="Open menu"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M2 3.5h10M2 7h10M2 10.5h10"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
