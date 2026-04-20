"use client"

import { useState, useEffect, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useContextPanel } from "@/components/ShellProvider"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"

type MemoryType = "preference" | "event" | "fact"
type FilterTab = "all" | "events" | "preferences" | "facts"

interface MemoryEntry {
  id: number
  type: MemoryType
  title: string
  description: string
  confidence: number
  tags: string[]
  created_at: string
}

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

const TYPE_ICONS: Record<MemoryType, string> = {
  preference: "◈",
  event: "◉",
  fact: "◎",
}

export default function MemoryVaultPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [search, setSearch] = useState("")
  const { contextOpen, setContextOpen } = useContextPanel()

  const fetchMemories = useCallback(async (filter: FilterTab) => {
    setLoading(true)
    try {
      const typeParam =
        filter === "facts"
          ? "fact"
          : filter === "events"
            ? "event"
            : filter === "preferences"
              ? "preference"
              : "all"
      const res = await fetch(
        `${API_BASE}/memory/vault/${USER_ID}?type_filter=${typeParam}`,
      )
      if (!res.ok) return
      setEntries(await res.json())
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemories(activeFilter)
  }, [activeFilter, fetchMemories])

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${API_BASE}/memory/vault/${USER_ID}/${id}`, {
        method: "DELETE",
      })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch {}
  }

  const filtered = entries.filter(
    (e) =>
      search === "" ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase()),
  )

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "events", label: "Events" },
    { key: "facts", label: "Facts" },
    { key: "preferences", label: "Preferences" },
  ]

  return (
    <>
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
          <button
            className="icon-btn"
            title="Refresh"
            onClick={() => fetchMemories(activeFilter)}
          >
            <RefreshIcon />
          </button>
          <button
            className="icon-btn"
            title={contextOpen ? "Close context panel" : "Open context panel"}
            onClick={() => setContextOpen(!contextOpen)}
            style={
              contextOpen
                ? {
                    color: "var(--color-teal)",
                    borderColor: "var(--color-teal-dim)",
                  }
                : {}
            }
          >
            <PanelIcon />
          </button>
        </div>
      </header>

      <div className="page-body">
        <div className="page-hero">
          <div className="page-hero-title">Memory Vault</div>
          <div className="page-hero-sub">
            Structured intelligence extracted from your conversations.
            {entries.length > 0 && (
              <span style={{ color: "var(--color-teal)", marginLeft: 8 }}>
                {entries.length} {entries.length === 1 ? "entry" : "entries"}{" "}
                stored.
              </span>
            )}
          </div>
        </div>

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

        <div className="memory-list">
          {loading && (
            <div className="page-empty-state">Scanning memory banks...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="page-empty-state">
              {entries.length === 0
                ? "No memories yet. Start chatting and Ava will learn about you automatically."
                : "No entries match this filter."}
            </div>
          )}
          {!loading &&
            filtered.map((entry, i) => (
              <MemoryCard
                key={entry.id}
                entry={entry}
                delay={i * 40}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          {!loading && filtered.length > 0 && activeFilter === "all" && (
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

function MemoryCard({
  entry,
  delay,
  onDelete,
}: {
  entry: MemoryEntry
  delay: number
  onDelete: () => void
}) {
  const colors = TYPE_COLORS[entry.type] ?? TYPE_COLORS.fact
  const icon = TYPE_ICONS[entry.type] ?? "◎"
  return (
    <div
      className="memory-card fade-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div
        className="memory-card-indicator"
        style={{ background: colors.indicator }}
      />
      <div className="memory-card-body">
        <div className="memory-card-top">
          <div className="memory-card-type">
            <div
              className="memory-card-icon"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.indicator}40`,
                color: colors.text,
              }}
            >
              {icon}
            </div>
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
          <div className="memory-confidence-group">
            <ConfidenceBar value={entry.confidence} color={colors.indicator} />
            <span className="memory-confidence">
              CONFIDENCE: {entry.confidence}%
            </span>
            <button
              className="memory-delete-btn"
              onClick={onDelete}
              title="Delete memory"
            >
              <DeleteIcon />
            </button>
          </div>
        </div>
        <div className="memory-card-title">{entry.title}</div>
        <div className="memory-card-desc">{entry.description}</div>
        <div className="memory-card-time">
          <span className="memory-time-icon">◷</span>
          {entry.created_at}
          {entry.tags.filter(Boolean).map((tag) => (
            <span key={tag} className="memory-tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="confidence-bar">
      <div
        className="confidence-bar-fill"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  )
}

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
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M12 7A5 5 0 112 7M12 7V4M12 7h-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M1.5 3h9M4.5 3V2h3v1M10 3l-.5 7a1 1 0 01-1 .9H3.5a1 1 0 01-1-.9L2 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
function PanelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="1"
        y="1"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9 1v12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
