"use client"

import { useState } from "react"
import Sidebar from "@/components/SideBar"
import ContextPanel from "./ContextPanel"
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"

export { useSidebar } from "@/components/ui/sidebar"

export default function ShellProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <ShellLayout>{children}</ShellLayout>
    </SidebarProvider>
  )
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const { open: sidebarOpen } = useSidebar()
  const [contextOpen, setContextOpen] = useState(true)

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : ""}`}>
      <Sidebar />
      <SidebarInset>
        {/* Inject toggle into children via context */}
        <ContextToggleProvider value={{ contextOpen, setContextOpen }}>
          {children}
        </ContextToggleProvider>
      </SidebarInset>
      <ContextPanel
        isOpen={contextOpen}
        onToggle={() => setContextOpen((v) => !v)}
      />
    </div>
  )
}

// ── Simple context for passing toggle to page headers ─────────────
import { createContext, useContext } from "react"

interface ContextToggleValue {
  contextOpen: boolean
  setContextOpen: (v: boolean) => void
}

const ContextToggleCtx = createContext<ContextToggleValue>({
  contextOpen: true,
  setContextOpen: () => {},
})

export function ContextToggleProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: ContextToggleValue
}) {
  return (
    <ContextToggleCtx.Provider value={value}>
      {children}
    </ContextToggleCtx.Provider>
  )
}

export function useContextPanel() {
  return useContext(ContextToggleCtx)
}
