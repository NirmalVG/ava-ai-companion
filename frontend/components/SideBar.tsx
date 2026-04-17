"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar as AppSidebarShell,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: <ChatIcon /> },
  { href: "/memory", label: "Memory Vault", icon: <MemoryIcon /> },
  { href: "/plugins", label: "Plugins", icon: <PluginsIcon /> },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isMobile, setOpen } = useSidebar()

  const handleNavigate = () => {
    if (isMobile) {
      setOpen(false)
    }
  }

  return (
    <AppSidebarShell>
      <SidebarHeader>
        <div className="sidebar-logo-text">AVA</div>
        <div className="sidebar-logo-sub">Adaptive Virtual Agent</div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={handleNavigate}
              title={item.label}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <Link
          href="/settings"
          className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
          onClick={handleNavigate}
          title="Settings"
          style={{ borderRadius: 6 }}
        >
          <span className="nav-item-icon">
            <SettingsIcon />
          </span>
          <span className="nav-label">Settings</span>
        </Link>

        <div className="user-card">
          <div className="user-avatar">N</div>
          <div className="user-info">
            <div className="user-info-name">OPERATOR 01</div>
            <div className="user-info-status">● SYSTEM LINKED</div>
          </div>
        </div>
      </SidebarFooter>
    </AppSidebarShell>
  )
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 2v-2H3a1 1 0 01-1-1V3z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MemoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse
        cx="8"
        cy="5"
        rx="5"
        ry="2.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M3 5v3c0 1.38 2.24 2.5 5 2.5S13 9.38 13 8V5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M3 8v3c0 1.38 2.24 2.5 5 2.5S13 12.38 13 11V8"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function PluginsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="2"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="9"
        y="2"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="2"
        y="9"
        width="5"
        height="5"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M11.5 9v6M9 11.5h6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
