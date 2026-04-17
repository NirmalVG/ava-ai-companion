"use client"

/*
  components/ShellProvider.tsx

  Hosts the app shell using a local shadcn-style sidebar pattern so the same
  navigation system works across desktop and mobile.
*/

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

function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { open } = useSidebar()

  return (
    <div className={`app-shell ${open ? "sidebar-open" : ""}`}>
      <Sidebar />
      <SidebarInset>{children}</SidebarInset>
      <ContextPanel />
    </div>
  )
}
