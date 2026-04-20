"use client"

import { useState, useEffect } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"

// ─── Types ───────────────────────────────────────────────────────
interface Plugin {
  id: string
  tool_name: string
  name: string
  by: string
  icon: string
  iconBg: string
  stars: number
  tags: string[]
  category: string
  installed: boolean
}

// ─── Built-in plugin catalogue ────────────────────────────────────
const BUILTIN_PLUGINS: Omit<Plugin, "installed">[] = [
  {
    id: "github_repo",
    tool_name: "github_repo",
    name: "GitHub Repo",
    by: "Built-in",
    icon: "⌥",
    iconBg: "#1a2230",
    stars: 5,
    tags: ["Read Only", "Dev"],
    category: "dev",
  },
  {
    id: "dictionary",
    tool_name: "dictionary",
    name: "Dictionary",
    by: "Free Dictionary API",
    icon: "≡",
    iconBg: "#1a1a1a",
    stars: 4,
    tags: ["Read Only", "Language"],
    category: "tools",
  },
  {
    id: "crypto_price",
    tool_name: "crypto_price",
    name: "Crypto Price",
    by: "CoinGecko",
    icon: "◈",
    iconBg: "#0d1f2d",
    stars: 4,
    tags: ["Read Only", "Finance"],
    category: "finance",
  },
  {
    id: "notion",
    tool_name: "notion",
    name: "Notion",
    by: "Notion Labs",
    icon: "≡",
    iconBg: "#1a1a1a",
    stars: 5,
    tags: ["Full Access", "Syncing"],
    category: "tools",
  },
  {
    id: "github",
    tool_name: "github",
    name: "GitHub Issues",
    by: "GitHub Inc.",
    icon: "⌥",
    iconBg: "#1a2230",
    stars: 5,
    tags: ["Read/Write", "Automation"],
    category: "dev",
  },
  {
    id: "stripe",
    tool_name: "stripe",
    name: "Stripe",
    by: "Stripe Engineering",
    icon: "◈",
    iconBg: "#0d1f2d",
    stars: 5,
    tags: ["Financials", "Webhooks"],
    category: "finance",
  },
  {
    id: "weather",
    tool_name: "weather",
    name: "Weather",
    by: "wttr.in",
    icon: "☀",
    iconBg: "#1f1a0d",
    stars: 4,
    tags: ["Read Only", "Geo-Data"],
    category: "data",
  },
  {
    id: "calendar",
    tool_name: "calendar",
    name: "Google Calendar",
    by: "Google LLC",
    icon: "◷",
    iconBg: "#1a0d0d",
    stars: 5,
    tags: ["Read/Write", "Events"],
    category: "tools",
  },
  {
    id: "supabase",
    tool_name: "supabase",
    name: "Supabase",
    by: "Supabase Inc.",
    icon: "⚡",
    iconBg: "#0d1f1a",
    stars: 5,
    tags: ["Database", "Realtime"],
    category: "dev",
  },
]

// ─── Main Component ───────────────────────────────────────────────
export default function PluginsPage() {
  const [installedTools, setInstalledTools] = useState<Set<string>>(new Set())
  const [loadingInstall, setLoadingInstall] = useState<string | null>(null)
  const [showSkillModal, setShowModal] = useState(false)
  const [searchQuery, setSearch] = useState("")
  const [dragOver, setDragOver] = useState(false)

  const installed = installedTools.size

  // Load installed plugins on mount
  useEffect(() => {
    async function loadInstalled() {
      try {
        const res = await fetch(`${API_BASE}/plugins/${USER_ID}`)
        if (!res.ok) return
        const data: { tool_name: string; installed: boolean }[] =
          await res.json()
        const installedSet = new Set(
          data.filter((p) => p.installed).map((p) => p.tool_name),
        )
        setInstalledTools(installedSet)
      } catch {
        // silently fail — UI still works
      }
    }
    loadInstalled()
  }, [])

  const handleInstall = async (tool_name: string) => {
    setLoadingInstall(tool_name)
    try {
      const res = await fetch(`${API_BASE}/plugins/${USER_ID}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_name }),
      })
      if (res.ok) {
        setInstalledTools((prev) => new Set([...prev, tool_name]))
      }
    } catch {
      // silently fail
    } finally {
      setLoadingInstall(null)
    }
  }

  const handleUninstall = async (tool_name: string) => {
    setLoadingInstall(tool_name)
    try {
      const res = await fetch(`${API_BASE}/plugins/${USER_ID}/${tool_name}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setInstalledTools((prev) => {
          const next = new Set(prev)
          next.delete(tool_name)
          return next
        })
      }
    } catch {
      // silently fail
    } finally {
      setLoadingInstall(null)
    }
  }

  const filtered = BUILTIN_PLUGINS.filter(
    (p) =>
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.by.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  return (
    <>
      {/* Header */}
      <header className="page-header">
        <SidebarTrigger />
        <div className="page-header-title-group">
          <span className="page-header-brand page-header-brand-tight">
            AVA COMMAND
          </span>
          <span className="header-breadcrumb-separator">—</span>
          <span className="header-breadcrumb">MARKETPLACE / ALL PLUGINS</span>
        </div>

        <div className="page-header-spacer" />

        <div className="header-actions">
          <div className="header-search">
            <SearchIcon />
            <input
              placeholder="SEARCH EXTENSIONS..."
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="icon-btn">
            <BellIcon />
          </button>
          <button className="icon-btn">
            <GridIcon />
          </button>
          <button
            className="icon-btn"
            style={{
              color: "var(--color-teal)",
              borderColor: "var(--color-teal-dim)",
            }}
            onClick={() => setShowModal(true)}
            title="Initialize new skill"
          >
            <PlusIcon />
          </button>
        </div>
      </header>

      {/* Page body */}
      <div className="page-body">
        {/* Hero */}
        <div className="plugins-hero">
          <div className="plugins-hero-title">
            Extend your{" "}
            <strong>
              Neural
              <br />
              Capacity.
            </strong>
          </div>
          <p className="plugins-hero-copy">
            Connect AVA to your entire digital ecosystem. From financial
            modeling to creative workflows, unlock specialized modules built for
            high-precision AGI orchestration.
          </p>

          <div className="plugins-hero-footer">
            <div className="plugins-stats-grid">
              <div className="plugins-stat">
                <div className="plugins-stat-label">REGISTRY_VER: 4.0.2</div>
                <div className="plugins-stat-value-row">
                  <span className="plugins-stat-value">
                    {BUILTIN_PLUGINS.length}
                  </span>
                  <span className="plugins-stat-unit">MODULES</span>
                </div>
              </div>

              <div className="plugins-stat">
                <div className="plugins-stat-label">INSTALLED</div>
                <div className="plugins-stat-value-row">
                  <span className="plugins-stat-value plugins-stat-value-green">
                    {installed}
                  </span>
                  <span className="plugins-stat-unit">ACTIVE</span>
                </div>
              </div>
            </div>

            <button
              className="plugins-hero-action"
              onClick={() => setShowModal(true)}
              type="button"
            >
              <PlusIcon /> Initialize Skill
            </button>
          </div>
        </div>

        {/* Plugin grid */}
        <div className="plugins-grid">
          {filtered.map((plugin, i) => (
            <PluginCard
              key={plugin.id}
              plugin={{
                ...plugin,
                installed: installedTools.has(plugin.tool_name),
              }}
              delay={i * 35}
              onInstall={() => handleInstall(plugin.tool_name)}
              onUninstall={() => handleUninstall(plugin.tool_name)}
              loading={loadingInstall === plugin.tool_name}
            />
          ))}

          {filtered.length === 0 && (
            <div className="page-empty-state page-empty-state-full">
              No plugins match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>

      {/* Skills Studio modal */}
      {showSkillModal && (
        <SkillsStudioModal
          onClose={() => setShowModal(false)}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
      )}
    </>
  )
}

// ─── Plugin Card ──────────────────────────────────────────────────
function PluginCard({
  plugin,
  delay,
  onInstall,
  onUninstall,
  loading,
}: {
  plugin: Plugin
  delay: number
  onInstall: () => void
  onUninstall: () => void
  loading: boolean
}) {
  return (
    <div
      className={`plugin-card fade-up ${plugin.installed ? "active-plugin" : ""}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      {plugin.installed && <div className="plugin-active-badge">● ACTIVE</div>}

      {/* Icon */}
      <div
        className="plugin-icon"
        style={{ background: plugin.iconBg, color: "var(--color-teal)" }}
      >
        {plugin.icon}
      </div>

      {/* Stars */}
      <div className="plugin-stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < plugin.stars ? "star" : "star-empty"}>
            ★
          </span>
        ))}
      </div>

      {/* Name + by */}
      <div className="plugin-name">{plugin.name}</div>
      <div className="plugin-by">by {plugin.by}</div>

      {/* Tags */}
      <div className="plugin-tags">
        {plugin.tags.map((tag) => (
          <span key={tag} className="plugin-tag">
            {tag}
          </span>
        ))}
      </div>

      {/* Install / Uninstall button */}
      <button
        className={`install-btn ${plugin.installed ? "installed" : ""}`}
        onClick={plugin.installed ? onUninstall : onInstall}
        disabled={loading}
        type="button"
      >
        {loading ? "..." : plugin.installed ? "Uninstall" : "Install Plugin"}
      </button>
    </div>
  )
}

// ─── Skills Studio Modal ──────────────────────────────────────────
function SkillsStudioModal({
  onClose,
  dragOver,
  setDragOver,
}: {
  onClose: () => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
}) {
  const [terminalCmd, setTerminalCmd] = useState("")

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith(".md")) {
      alert(`Skill file "${file.name}" received. Integration pending.`)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} type="button">
          X
        </button>

        <div className="modal-title">Initialize New Skill</div>
        <div className="modal-sub">
          Select ingestion method for neural integration.
        </div>

        <div className="modal-options">
          {/* Option 1: Upload SKILL.MD */}
          <div
            className="modal-option"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              borderColor: dragOver ? "var(--color-teal-dim)" : undefined,
            }}
          >
            <div
              className="modal-option-icon"
              style={{
                background: "rgba(0,200,255,0.06)",
                border: "1px solid rgba(0,200,255,0.15)",
              }}
            >
              <UploadIcon />
            </div>
            <div className="modal-option-title">Upload Skill.md</div>
            <div className="modal-option-desc">
              Directly inject markdown definitions and logical parameters into
              the core library.
            </div>
            <div
              className="dropzone"
              style={{
                borderColor: dragOver ? "var(--color-teal)" : undefined,
                color: dragOver ? "var(--color-teal)" : undefined,
              }}
            >
              Drag & Drop File Here
            </div>
          </div>

          {/* Option 2: Skills.sh terminal */}
          <div className="modal-option">
            <div
              className="modal-option-icon"
              style={{
                background: "rgba(255,107,53,0.06)",
                border: "1px solid rgba(255,107,53,0.2)",
              }}
            >
              <TerminalIcon />
            </div>
            <div className="modal-option-title">Load via Skills.sh</div>
            <div className="modal-option-desc">
              Initialize automated routines and system-level scripts via shell
              interface.
            </div>
            <div className="terminal-input">
              <div className="terminal-dots">
                <div className="dot dot-red" />
                <div className="dot dot-yellow" />
                <div className="dot dot-green" />
              </div>
              <input
                className="terminal-cmd terminal-cmd-input"
                placeholder="INPUT TERMINAL CMD..."
                value={terminalCmd}
                onChange={(e) => setTerminalCmd(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="abort-btn" onClick={onClose}>
            Abort Initialization
          </button>
        </div>
      </div>
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

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M6 2v8M2 6h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      style={{ color: "var(--color-teal)" }}
    >
      <rect
        x="3"
        y="3"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M11 14V8M8 11l3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 15h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      style={{ color: "var(--color-orange)" }}
    >
      <rect
        x="3"
        y="3"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7 8l4 3-4 3M12 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
