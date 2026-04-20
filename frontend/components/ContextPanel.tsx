"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"
const POLL_INTERVAL = 5000

interface Tool {
  name: string
  type: "core" | "plugin"
  status: string
}

interface Memory {
  id: number
  type: string
  title: string
  description: string
  confidence: number
  tags: string[]
}

interface Stats {
  message_count: number
  last_active: string
  total_memories: number
  preference_count: number
  fact_count: number
  event_count: number
  active_tools: number
  installed_plugins: number
}

interface ContextData {
  tools: Tool[]
  memories: Memory[]
  installed_plugins: { name: string; tool_name: string }[]
  stats: Stats
}

const TOOL_ICONS: Record<string, string> = {
  get_current_time: "◷",
  get_weather: "☁",
  calculate: "∑",
  web_search: "⌕",
  execute_code: "▶",
  read_file: "◎",
  write_file: "◈",
  github_repo: "⌥",
  dictionary: "≡",
  crypto_price: "◈",
}

const TOOL_STATUS_COLORS: Record<string, string> = {
  core: "var(--color-teal-dim)",
  plugin: "var(--color-green-dim)",
}

const MEMORY_COLORS: Record<string, string> = {
  preference: "#00c8ff",
  event: "#a78bfa",
  fact: "#00ff94",
}

export default function ContextPanel({
  isOpen,
  onToggle,
}: {
  isOpen: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState("")

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/context/${USER_ID}`)
      if (!res.ok) return
      const json: ContextData = await res.json()
      setData(json)
      setLastUpdated(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      )
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContext()
    const interval = setInterval(fetchContext, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchContext])

  const route = pathname.startsWith("/memory")
    ? "memory"
    : pathname.startsWith("/plugins")
      ? "plugins"
      : pathname.startsWith("/settings")
        ? "settings"
        : "chat"

  return (
    <>
      {/* Toggle tab — always visible, sits on the edge of the panel */}
      <button
        onClick={onToggle}
        style={{
          position: "fixed",
          right: isOpen ? "var(--spacing-context-w)" : 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 60,
          width: 20,
          height: 56,
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-default)",
          borderRight: isOpen
            ? "none"
            : "1px solid var(--color-border-default)",
          borderRadius: isOpen ? "4px 0 0 4px" : "0 4px 4px 0",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontSize: 8,
          transition: "right 0.25s ease, color 0.15s",
          writingMode: "vertical-rl",
          letterSpacing: "0.08em",
        }}
        title={isOpen ? "Close context panel" : "Open context panel"}
      >
        {isOpen ? "›" : "‹"}
      </button>

      {/* Panel itself */}
      <aside
        style={{
          width: isOpen ? "var(--spacing-context-w)" : 0,
          minWidth: isOpen ? "var(--spacing-context-w)" : 0,
          overflow: "hidden",
          transition: "width 0.25s ease, min-width 0.25s ease",
          flexShrink: 0,
          background: "var(--color-bg-sidebar)",
          borderLeft: isOpen ? "1px solid var(--color-border-subtle)" : "none",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="context-panel-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="context-panel-title">Context Panel</div>
            <div className="context-panel-sub">
              {loading ? "Connecting..." : `Updated ${lastUpdated}`}
            </div>
          </div>
          <button
            onClick={onToggle}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border-default)",
              borderRadius: 4,
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
            title="Close context panel"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="context-panel-body">
          {loading ? (
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-secondary)",
                letterSpacing: "0.1em",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              Loading context...
            </div>
          ) : data ? (
            <>
              <StatsBar stats={data.stats} />
              {route === "chat" && <ChatContext data={data} />}
              {route === "memory" && <MemoryContext data={data} />}
              {route === "plugins" && <PluginsContext data={data} />}
              {route === "settings" && <SettingsContext data={data} />}
            </>
          ) : (
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-secondary)",
                letterSpacing: "0.1em",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              No data available.
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: Stats }) {
  const items = [
    { label: "MESSAGES", value: stats.message_count },
    { label: "MEMORIES", value: stats.total_memories },
    { label: "TOOLS", value: stats.active_tools },
    { label: "PLUGINS", value: stats.installed_plugins },
  ]
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        marginBottom: 20,
      }}
    >
      {items.map(({ label, value }) => (
        <div
          key={label}
          style={{
            background: "var(--color-bg-elevated)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 5,
            padding: "8px 10px",
          }}
        >
          <div
            style={{
              fontSize: 8,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-text-secondary)",
              marginBottom: 3,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Chat Context ──────────────────────────────────────────────────
function ChatContext({ data }: { data: ContextData }) {
  return (
    <>
      <div>
        <SectionLabel label="Active Tools" badge={String(data.tools.length)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.tools.slice(0, 6).map((tool) => (
            <ToolRow key={tool.name} tool={tool} />
          ))}
          {data.tools.length > 6 && (
            <div
              style={{
                fontSize: 9,
                color: "var(--color-text-secondary)",
                letterSpacing: "0.1em",
                textAlign: "center",
                padding: "4px 0",
              }}
            >
              +{data.tools.length - 6} more
            </div>
          )}
        </div>
      </div>

      {data.memories.length > 0 && (
        <div>
          <SectionLabel label="Memory Snippets" />
          {data.memories.slice(0, 3).map((mem) => (
            <MemorySnippet key={mem.id} memory={mem} />
          ))}
        </div>
      )}

      <SystemStatus lastActive={data.stats.last_active} />
    </>
  )
}

// ── Memory Context ────────────────────────────────────────────────
function MemoryContext({ data }: { data: ContextData }) {
  const { stats } = data
  const breakdown = [
    { label: "Preferences", value: stats.preference_count, color: "#00c8ff" },
    { label: "Facts", value: stats.fact_count, color: "#00ff94" },
    { label: "Events", value: stats.event_count, color: "#a78bfa" },
  ]
  return (
    <>
      <div>
        <SectionLabel label="Memory Breakdown" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {breakdown.map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                padding: "7px 10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-secondary)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </span>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {data.memories.length > 0 && (
        <div>
          <SectionLabel label="Recent Extractions" />
          {data.memories.map((mem) => (
            <MemorySnippet key={mem.id} memory={mem} />
          ))}
        </div>
      )}

      {data.memories.length === 0 && (
        <div
          style={{
            fontSize: 10,
            color: "var(--color-text-secondary)",
            letterSpacing: "0.05em",
            lineHeight: 1.5,
            padding: "8px 0",
          }}
        >
          No memories yet. Start chatting and Ava will extract facts
          automatically.
        </div>
      )}

      <SystemStatus lastActive={data.stats.last_active} />
    </>
  )
}

// ── Plugins Context ───────────────────────────────────────────────
function PluginsContext({ data }: { data: ContextData }) {
  return (
    <>
      <div>
        <SectionLabel
          label="Active Plugins"
          badge={String(data.installed_plugins.length)}
        />
        {data.installed_plugins.length === 0 ? (
          <div
            style={{
              fontSize: 10,
              color: "var(--color-text-secondary)",
              letterSpacing: "0.05em",
              lineHeight: 1.5,
              padding: "6px 0",
            }}
          >
            No plugins installed. Install from the marketplace to extend Ava.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.installed_plugins.map((p) => (
              <div key={p.tool_name} className="tool-card">
                <div className="tool-icon" style={{ fontSize: 11 }}>
                  {TOOL_ICONS[p.tool_name] ?? "⚡"}
                </div>
                <div>
                  <div className="tool-name">{p.name}</div>
                  <div className="tool-status tool-status-green">Active</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel
          label="Core Tools"
          badge={String(data.tools.filter((t) => t.type === "core").length)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.tools
            .filter((t) => t.type === "core")
            .map((tool) => (
              <ToolRow key={tool.name} tool={tool} compact />
            ))}
        </div>
      </div>

      <SystemStatus lastActive={data.stats.last_active} />
    </>
  )
}

// ── Settings Context ──────────────────────────────────────────────
function SettingsContext({ data }: { data: ContextData }) {
  return (
    <>
      <div>
        <SectionLabel label="System Overview" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Total Messages", value: data.stats.message_count },
            { label: "Memory Entries", value: data.stats.total_memories },
            { label: "Active Tools", value: data.stats.active_tools },
            { label: "Plugins", value: data.stats.installed_plugins },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 10px",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel label="Memory Types" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            {
              label: "Preferences",
              value: data.stats.preference_count,
              color: "#00c8ff",
            },
            { label: "Facts", value: data.stats.fact_count, color: "#00ff94" },
            {
              label: "Events",
              value: data.stats.event_count,
              color: "#a78bfa",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 10px",
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
              }}
            >
              <span
                style={{ fontSize: 10, color: "var(--color-text-secondary)" }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color,
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <SystemStatus lastActive={data.stats.last_active} />
    </>
  )
}

// ── Shared sub-components ─────────────────────────────────────────
function SectionLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <div className="context-section-label">
      {label}
      {badge && <span className="context-badge">{badge}</span>}
    </div>
  )
}

function ToolRow({ tool, compact = false }: { tool: Tool; compact?: boolean }) {
  const icon = TOOL_ICONS[tool.name] ?? "⚡"
  const color = TOOL_STATUS_COLORS[tool.type] ?? "var(--color-teal-dim)"
  const label = tool.name.replace(/_/g, " ")

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 4,
        }}
      >
        <span style={{ fontSize: 10, color: "var(--color-teal)", width: 12 }}>
          {icon}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--color-text-secondary)",
            letterSpacing: "0.05em",
            flex: 1,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 7, color, letterSpacing: "0.1em" }}>
          {tool.type.toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <div className="tool-card">
      <div className="tool-icon" style={{ fontSize: 11 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tool-name" style={{ fontSize: 10 }}>
          {label}
        </div>
        <div className="tool-status" style={{ color }}>
          {tool.type === "plugin" ? "Plugin · Active" : "Core · Ready"}
        </div>
      </div>
    </div>
  )
}

function MemorySnippet({ memory }: { memory: Memory }) {
  const color = MEMORY_COLORS[memory.type] ?? "#00c8ff"
  return (
    <div
      className="snippet-card"
      style={{ borderLeft: `2px solid ${color}30` }}
    >
      <div className="snippet-label" style={{ color }}>
        {memory.type.toUpperCase()} · {memory.confidence}%
      </div>
      <div
        className="snippet-body"
        style={{ fontWeight: 500, marginBottom: 2 }}
      >
        {memory.title}
      </div>
      <div className="snippet-body" style={{ fontSize: 9 }}>
        {memory.description}
      </div>
    </div>
  )
}

function SystemStatus({ lastActive }: { lastActive: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        background: "var(--color-bg-elevated)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 4,
        marginTop: 4,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--color-green)",
          animation: "var(--animate-cursor-blink)",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 8,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--color-green)",
          }}
        >
          AGI_STABLE · ONLINE
        </div>
        <div
          style={{
            fontSize: 8,
            color: "var(--color-text-secondary)",
            marginTop: 1,
            letterSpacing: "0.05em",
          }}
        >
          Last active: {lastActive}
        </div>
      </div>
    </div>
  )
}
