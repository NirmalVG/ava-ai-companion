"use client"

import { useState, useEffect, useRef } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useContextPanel } from "@/components/ShellProvider"
import ThemeToggle from "@/components/ThemeToggle"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"

const ALLOWED_COMMANDS: Record<string, string> = {
  list: "List all registered skills",
  status: "Show skill status",
  test: "Test skill connectivity",
  reload: "Reload skill registry",
}

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

export default function PluginsPage() {
  const [installedTools, setInstalledTools] = useState<Set<string>>(new Set())
  const [loadingInstall, setLoadingInstall] = useState<string | null>(null)
  const [showSkillModal, setShowModal] = useState(false)
  const [searchQuery, setSearch] = useState("")
  const { contextOpen, setContextOpen } = useContextPanel()

  useEffect(() => {
    async function loadInstalled() {
      try {
        const res = await fetch(`${API_BASE}/plugins/${USER_ID}`)
        if (!res.ok) return
        const data: { tool_name: string; installed: boolean }[] =
          await res.json()
        setInstalledTools(
          new Set(data.filter((p) => p.installed).map((p) => p.tool_name)),
        )
      } catch {}
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
      if (res.ok) setInstalledTools((prev) => new Set([...prev, tool_name]))
    } catch {
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
      if (res.ok)
        setInstalledTools((prev) => {
          const n = new Set(prev)
          n.delete(tool_name)
          return n
        })
    } catch {
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
          <ThemeToggle />
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
            Connect AVA to your entire digital ecosystem. Unlock specialized
            modules built for high-precision AGI orchestration.
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
                    {installedTools.size}
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

      {showSkillModal && (
        <SkillsStudioModal onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

// ── Plugin Card ───────────────────────────────────────────────────
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
      <div
        className="plugin-icon"
        style={{ background: plugin.iconBg, color: "var(--color-teal)" }}
      >
        {plugin.icon}
      </div>
      <div className="plugin-stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < plugin.stars ? "star" : "star-empty"}>
            ★
          </span>
        ))}
      </div>
      <div className="plugin-name">{plugin.name}</div>
      <div className="plugin-by">by {plugin.by}</div>
      <div className="plugin-tags">
        {plugin.tags.map((tag) => (
          <span key={tag} className="plugin-tag">
            {tag}
          </span>
        ))}
      </div>
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

// ── Skills Studio Modal ───────────────────────────────────────────
function SkillsStudioModal({ onClose }: { onClose: () => void }) {
  const [terminalCmd, setTerminalCmd] = useState("")
  const [terminalOutput, setTerminalOutput] = useState(
    "AVA Skill Terminal v1.0\nType 'list', 'status', 'test', or 'reload'\n─────────────────────────────────────\n$ ",
  )
  const [terminalLoading, setTerminalLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{
    type: "idle" | "loading" | "success" | "error"
    message: string
  }>({ type: "idle", message: "" })
  const [registeredSkills, setRegisteredSkills] = useState<
    {
      tool_name: string
      name: string
      description: string
      enabled: boolean
      source: string
    }[]
  >([])

  const terminalRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSkills = async () => {
    try {
      const res = await fetch(`${API_BASE}/skills/list/${USER_ID}`)
      if (res.ok) setRegisteredSkills(await res.json())
    } catch {}
  }

  useEffect(() => {
    loadSkills()
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".md")) {
      setUploadStatus({
        type: "error",
        message: "Only .md files are accepted.",
      })
      return
    }
    setUploadStatus({ type: "loading", message: `Parsing ${file.name}...` })
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("user_id", USER_ID)
      const res = await fetch(`${API_BASE}/skills/upload`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadStatus({
          type: "error",
          message: data.detail || "Upload failed.",
        })
        return
      }
      setUploadStatus({
        type: "success",
        message: `Skill "${data.name}" registered as tool "${data.tool_name}".`,
      })
      loadSkills()
    } catch {
      setUploadStatus({
        type: "error",
        message: "Network error. Check backend connection.",
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const handleTerminalSubmit = async () => {
    const cmd = terminalCmd.trim()
    if (!cmd) return
    setTerminalOutput((prev) => prev + cmd + "\n")
    setTerminalCmd("")
    setTerminalLoading(true)
    try {
      const res = await fetch(`${API_BASE}/skills/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      })
      const data = await res.json()
      setTerminalOutput((prev) => prev + data.output + "\n$ ")
    } catch {
      setTerminalOutput(
        (prev) => prev + "Error: Could not connect to backend.\n$ ",
      )
    } finally {
      setTerminalLoading(false)
    }
  }

  const handleTerminalKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleTerminalSubmit()
  }

  const removeSkill = async (tool_name: string) => {
    try {
      await fetch(`${API_BASE}/skills/remove/${USER_ID}/${tool_name}`, {
        method: "DELETE",
      })
      setRegisteredSkills((prev) =>
        prev.filter((s) => s.tool_name !== tool_name),
      )
    } catch {}
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        style={{ width: 900, maxWidth: "95vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} type="button">
          X
        </button>
        <div className="modal-title">Initialize New Skill</div>
        <div className="modal-sub">
          Register a custom skill from a SKILL.md file or via the terminal.
          Registered skills become callable tools in every conversation.
        </div>

        <div className="modal-options">
          {/* ── Upload SKILL.MD ───────────────────────────── */}
          <div
            className="modal-option"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ borderColor: dragOver ? "var(--color-teal)" : undefined }}
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
              Create a markdown file with frontmatter defining your tool. Ava
              will parse and register it automatically.
            </div>

            <div
              className="dropzone"
              style={{
                borderColor: dragOver ? "var(--color-teal)" : undefined,
                color: dragOver ? "var(--color-teal)" : undefined,
                cursor: "pointer",
                marginBottom: 10,
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadStatus.type === "loading"
                ? uploadStatus.message
                : "Drag & Drop or Click to Upload"}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".md"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f)
              }}
            />

            {uploadStatus.type === "success" && (
              <div
                style={{
                  fontSize: 10,
                  padding: "8px 10px",
                  background: "rgba(0,255,148,0.08)",
                  border: "1px solid var(--color-green-dim)",
                  borderRadius: 4,
                  color: "var(--color-green)",
                  letterSpacing: "0.03em",
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                ✓ {uploadStatus.message}
              </div>
            )}
            {uploadStatus.type === "error" && (
              <div
                style={{
                  fontSize: 10,
                  padding: "8px 10px",
                  background: "rgba(255,68,68,0.08)",
                  border: "1px solid rgba(255,68,68,0.3)",
                  borderRadius: 4,
                  color: "var(--color-red)",
                  letterSpacing: "0.03em",
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                ✕ {uploadStatus.message}
              </div>
            )}

            {/* Template */}
            <div>
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--color-text-secondary)",
                  marginBottom: 6,
                }}
              >
                Template
              </div>
              <pre
                style={{
                  background: "var(--color-bg-void)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: 4,
                  padding: "10px 12px",
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.6,
                  overflow: "auto",
                  maxHeight: 130,
                }}
              >
                {`---
name: My Custom Tool
tool_name: my_custom_tool
description: What this tool does
---

## Parameters
- query (string, required): The input

## Example
Ask Ava: "Use my custom tool to..."`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  const t = `---\nname: My Custom Tool\ntool_name: my_custom_tool\ndescription: What this tool does\n---\n\n## Parameters\n- query (string, required): The input\n\n## Example\nAsk Ava: "Use my custom tool to..."`
                  navigator.clipboard.writeText(t).catch(() => {})
                }}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "5px 10px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 3,
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >
                Copy Template
              </button>
            </div>
          </div>

          {/* ── Terminal ──────────────────────────────────── */}
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
              Manage skills via the terminal. List, test, reload, or check
              status.
            </div>

            {/* Output */}
            <div
              ref={terminalRef}
              style={{
                background: "var(--color-bg-void)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 6,
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-text-secondary)",
                lineHeight: 1.7,
                marginBottom: 6,
                height: 140,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {terminalOutput}
              {terminalLoading && (
                <span style={{ color: "var(--color-teal)" }}>█</span>
              )}
            </div>

            {/* Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "var(--color-bg-void)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 4,
                padding: "6px 10px",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: "var(--color-teal)",
                  flexShrink: 0,
                }}
              >
                $
              </span>
              <input
                value={terminalCmd}
                onChange={(e) => setTerminalCmd(e.target.value)}
                onKeyDown={handleTerminalKey}
                placeholder="Type a command..."
                disabled={terminalLoading}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                }}
              />
              <button
                type="button"
                onClick={handleTerminalSubmit}
                disabled={terminalLoading || !terminalCmd.trim()}
                style={{
                  padding: "2px 10px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  border: "1px solid var(--color-teal-dim)",
                  borderRadius: 3,
                  background: "var(--color-teal-trace)",
                  color: "var(--color-teal)",
                  cursor: terminalLoading ? "default" : "pointer",
                  opacity: terminalLoading || !terminalCmd.trim() ? 0.5 : 1,
                }}
              >
                Run
              </button>
            </div>

            {/* Quick command buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {Object.keys(ALLOWED_COMMANDS).map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => setTerminalCmd(cmd)}
                  style={{
                    padding: "2px 8px",
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.08em",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Registered Skills ─────────────────────────── */}
        {registeredSkills.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--color-text-secondary)",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Registered Skills</span>
              <span style={{ color: "var(--color-teal)" }}>
                {registeredSkills.length} active
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {registeredSkills.map((skill) => (
                <div
                  key={skill.tool_name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 5,
                    padding: "8px 12px",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: skill.enabled
                        ? "var(--color-green)"
                        : "var(--color-text-secondary)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-primary)",
                        letterSpacing: "0.03em",
                      }}
                    >
                      {skill.name}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "var(--color-text-secondary)",
                        marginTop: 1,
                      }}
                    >
                      {skill.tool_name} · {skill.source} ·{" "}
                      {skill.description.slice(0, 60)}
                      {skill.description.length > 60 ? "..." : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 8,
                      padding: "1px 6px",
                      background:
                        skill.source === "uploaded"
                          ? "rgba(0,200,255,0.08)"
                          : "rgba(0,255,148,0.08)",
                      border: `1px solid ${skill.source === "uploaded" ? "rgba(0,200,255,0.3)" : "rgba(0,255,148,0.3)"}`,
                      borderRadius: 3,
                      color:
                        skill.source === "uploaded"
                          ? "var(--color-teal)"
                          : "var(--color-green)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {skill.source}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSkill(skill.tool_name)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 3,
                      padding: "2px 8px",
                      fontSize: 9,
                      color: "var(--color-text-secondary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="abort-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────
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
