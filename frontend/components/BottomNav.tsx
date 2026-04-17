"use client"

/*
  BottomNav.tsx

  Visible only on mobile (< 640px) via CSS.
  Fixed to the bottom of the screen.
  Three primary nav destinations + a search icon.
*/

import Link from "next/link"
import { usePathname } from "next/navigation"

const ITEMS = [
  { href: "/chat", label: "Chat", icon: <ChatIcon /> },
  { href: "/memory", label: "Memory", icon: <MemoryIcon /> },
  { href: "/plugins", label: "Plugins", icon: <PluginsIcon /> },
  { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/")
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1h-4l-3 2v-2H4a1 1 0 01-1-1V4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function MemoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <ellipse
        cx="10"
        cy="7"
        rx="6"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 7v3c0 1.66 2.69 3 6 3s6-1.34 6-3V7"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4 10v3c0 1.66 2.69 3 6 3s6-1.34 6-3v-3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}
function PluginsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect
        x="3"
        y="3"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="11"
        y="3"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="3"
        y="11"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M14 11v8M11 14h6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
