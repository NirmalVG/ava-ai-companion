"use client"

/*
  app/memory/page.tsx — Memory Vault

  Matches Image 2:
  - Hero: "MEMORY VAULT" large display title + subtitle
  - Filter tabs: ALL / EVENTS / CONTACTS / PREFERENCES
  - Cards: type badge + confidence score + title + description + timestamp
  - Context panel shows: Neural_Indexer_v4 tool + memory snippets
  - Card types: PREFERENCE (teal), EVENT (purple), FACT (green)

  Each card has a colored left indicator bar matching its type.
  The confidence bar fills proportionally.
*/

import { useState } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"

// ─── Types ───────────────────────────────────────────────────────
type MemoryType = "preference" | "event" | "fact"
type FilterTab = "all" | "events" | "contacts" | "preferences"

interface MemoryEntry {
  id: string
  type: MemoryType
  title: string
  description: string
  confidence: number // 0–100
  timestamp: string
  icon: string
  tags?: string[]
}

// ─── Color mapping per type ───────────────────────────────────────
const TYPE_COLORS: Record<
  MemoryType,
  { indicator: string; badge: string; text: string; bg: string }
> = {
  preference: {
    indicator: "#00c8ff",
    badge: "rgba(0,200,255,0.08)",
    text: "#00c8ff",
    bg: "rgba(0,200,255,0.05)",
  },
  event: {
    indicator: "#7c3aed",
    badge: "rgba(124,58,237,0.12)",
    text: "#a78bfa",
    bg: "rgba(124,58,237,0.05)",
  },
  fact: {
    indicator: "#00ff94",
    badge: "rgba(0,255,148,0.08)",
    text: "#00ff94",
    bg: "rgba(0,255,148,0.05)",
  },
}

// ─── Seed data ───────────────────────────────────────────────────
const MEMORY_DATA: MemoryEntry[] = [
  {
    id: "1",
    type: "preference",
    title: "Prefers Dark Mode",
    description:
      "Automatically detected user frustration with light themes during evening hours. Logic confirmed across 3 sessions.",
    confidence: 98,
    timestamp: "Oct 24, 2023 // 19:42",
    icon: "◈",
    tags: ["ui", "display"],
  },
  {
    id: "2",
    type: "event",
    title: "Met with CEO",
    description:
      "Strategic briefing session completed. Topic: Q4 Infrastructure Expansion. Action items recorded in Command Center.",
    confidence: 100,
    timestamp: "Oct 23, 2023 // 10:18",
    icon: "◉",
    tags: ["work", "meeting"],
  },
  {
    id: "3",
    type: "fact",
    title: "Birthday: Oct 12",
    description:
      "Extracted from historical correspondence data. High reliability verification via calendar entry sync.",
    confidence: 99,
    timestamp: "Oct 20, 2023 // 14:22",
    icon: "◎",
    tags: ["personal"],
  },
  {
    id: "4",
    type: "preference",
    title: "Espresso: No Sugar",
    description:
      "Inferred from morning routine orders. User consistently bypasses sweetener options.",
    confidence: 95,
    timestamp: "Oct 18, 2023 // 08:30",
    icon: "◈",
    tags: ["food", "routine"],
  },
  {
    id: "5",
    type: "fact",
    title: "Location: Thrissur",
    description:
      "System geolocation confirmed. Kerala, India — IST timezone active for all scheduling operations.",
    confidence: 100,
    timestamp: "Oct 15, 2023 // 22:10",
    icon: "◎",
    tags: ["location"],
  },
  {
    id: "6",
    type: "event",
    title: "Project Sonar Launch",
    description:
      "Successful deployment of 3D particle globe. System metrics showing improvement in render performance.",
    confidence: 94,
    timestamp: "Oct 12, 2023 // 11:00",
    icon: "◉",
    tags: ["project", "dev"],
  },
  {
    id: "7",
    type: "preference",
    title: "Malayalam Cinema",
    description:
      "Strong preference for Mollywood films — Lijo Jose Pellissery, Fahadh Faasil. Frequently referenced in conversation.",
    confidence: 97,
    timestamp: "Oct 10, 2023 // 20:15",
    icon: "◈",
    tags: ["culture", "cinema"],
  },
  {
    id: "8",
    type: "fact",
    title: "Stack: Next.js + FastAPI",
    description:
      "Primary engineering stack confirmed across multiple project discussions. Groq as LLM provider.",
    confidence: 100,
    timestamp: "Oct 08, 2023 // 14:00",
    icon: "◎",
    tags: ["tech", "work"],
  },
]

const FILTER_MAP: Record<FilterTab, (m: MemoryEntry) => boolean> = {
  all: () => true,
  events: (m) => m.type === "event",
  contacts: (m) => m.tags?.includes("personal") ?? false,
  preferences: (m) => m.type === "preference",
}

// ─── Component ───────────────────────────────────────────────────
export default function MemoryVaultPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [search, setSearch] = useState("")

  const filtered = MEMORY_DATA.filter(FILTER_MAP[activeFilter]).filter(
    (m) =>
      search === "" ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase()),
  )

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "events", label: "Events" },
    { key: "contacts", label: "Contacts" },
    { key: "preferences", label: "Preferences" },
  ]

  return (
    <>
      {/* Header */}
      <header className="page-header">
        <SidebarTrigger />
        <span className="page-header-brand">AVA COMMAND</span>
        <div className="page-header-spacer" />
        <div className="header-actions">
          <div className="header-search">
            <SearchIcon />
            <input
              placeholder="SEARCH MEMORY..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn">
            <BellIcon />
          </button>
          <button className="icon-btn">
            <GridIcon />
          </button>
          <button className="icon-btn">
            <UserIcon />
          </button>
        </div>
      </header>

      {/* Page body — scrollable */}
      <div className="page-body">
        {/* Hero */}
        <div className="page-hero">
          <div className="page-hero-title">Memory Vault</div>
          <div className="page-hero-sub">
            Structured intelligence persistent storage. Synchronized across all
            tactical nodes.
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`filter-tab ${activeFilter === f.key ? "active" : ""}`}
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Memory cards */}
        <div className="memory-list">
          {filtered.length === 0 && (
            <div className="page-empty-state">No memory entries match this filter.</div>
          )}

          {filtered.map((entry, i) => (
            <MemoryCard key={entry.id} entry={entry} delay={i * 40} />
          ))}

          {/* AGI stable badge — appears at bottom of list */}
          {activeFilter === "all" && filtered.length > 0 && (
            <div className="memory-status-row">
              <div className="memory-status-badge">
                <span className="memory-status-dot">■</span>
                AGI_STABLE: MEMORY_SYNC_ACTIVE
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Memory Card ─────────────────────────────────────────────────
function MemoryCard({ entry, delay }: { entry: MemoryEntry; delay: number }) {
  const colors = TYPE_COLORS[entry.type]

  return (
    <div
      className="memory-card fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {/* Left indicator bar */}
      <div
        className="memory-card-indicator"
        style={{ background: colors.indicator }}
      />

      {/* Card body */}
      <div className="memory-card-body">
        {/* Top row: type badge + confidence */}
        <div className="memory-card-top">
          <div className="memory-card-type">
            {/* Icon */}
            <div
              className="memory-card-icon"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.indicator}40`,
                color: colors.text,
              }}
            >
              {entry.icon}
            </div>

            {/* Type badge */}
            <span
              className="memory-type-badge"
              style={{
                background: colors.badge,
                color: colors.text,
                border: `1px solid ${colors.indicator}30`,
              }}
            >
              Type: {entry.type}
            </span>
          </div>

          {/* Confidence */}
          <div className="memory-confidence-group">
            <ConfidenceBar value={entry.confidence} color={colors.indicator} />
            <span className="memory-confidence">
              CONFIDENCE: {entry.confidence}%
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="memory-card-title">{entry.title}</div>

        {/* Description */}
        <div className="memory-card-desc">{entry.description}</div>

        {/* Timestamp + tags */}
        <div className="memory-card-time">
          <span className="memory-time-icon">◷</span>
          {entry.timestamp}
          {entry.tags &&
            entry.tags.map((tag) => (
              <span key={tag} className="memory-tag">
                {tag}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}

// ─── Confidence bar ───────────────────────────────────────────────
function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="confidence-bar">
      <div
        className="confidence-bar-fill"
        style={{
          width: `${value}%`,
          background: color,
        }}
      />
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}
    >
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 8l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1.5A4 4 0 003 5.5V9l-1 1.5h10L11 9V5.5A4 4 0 007 1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 11a1.5 1.5 0 003 0"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="2"
        y="2"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="8"
        y="2"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="2"
        y="8"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <rect
        x="8"
        y="8"
        width="4"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1.5 13c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
