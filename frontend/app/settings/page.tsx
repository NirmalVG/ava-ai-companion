"use client"

import { useState, useEffect } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useContextPanel } from "@/components/ShellProvider"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"
const SETTINGS_URL = `${API_BASE}/settings/${USER_ID}`

interface Settings {
  tone: string
  language: string
  memory_enabled: string
  retention_days: number
}

const TONE_OPTIONS = [
  {
    value: "casual",
    label: "Casual",
    desc: "Expert knowledge in plain, friendly language",
  },
  {
    value: "balanced",
    label: "Balanced",
    desc: "Thorough and clear — the default",
  },
  {
    value: "professional",
    label: "Professional",
    desc: "Formal, precise, exhaustive coverage",
  },
  {
    value: "concise",
    label: "Concise",
    desc: "Direct answers, no padding, still detailed",
  },
  {
    value: "research",
    label: "Research",
    desc: "Deep technical briefs with full coverage",
  },
]

const RETENTION_OPTIONS = [7, 14, 30, 60, 90]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    tone: "balanced",
    language: "en",
    memory_enabled: "true",
    retention_days: 30,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingData, setDeletingData] = useState(false)
  const { contextOpen, setContextOpen } = useContextPanel()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(SETTINGS_URL)
        if (res.ok) setSettings(await res.json())
      } catch {
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const saveSettings = async (updated: Settings) => {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value }
    setSettings(updated)
    saveSettings(updated)
  }

  const handleDeleteAll = async () => {
    setDeletingData(true)
    try {
      await fetch(`${SETTINGS_URL}/data`, { method: "DELETE" })
      setShowDeleteConfirm(false)
      window.location.href = "/chat"
    } catch {
    } finally {
      setDeletingData(false)
    }
  }

  const S = {
    section: {
      padding: "24px 0",
      borderBottom: "1px solid #151f35",
    } as React.CSSProperties,
    title: {
      fontFamily: "var(--font-display)",
      fontSize: 14,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#c8d6f0",
      marginBottom: 6,
    } as React.CSSProperties,
    desc: {
      fontSize: 11,
      color: "#4a6080",
      lineHeight: 1.6,
      marginBottom: 16,
      maxWidth: 560,
    } as React.CSSProperties,
  }

  if (loading)
    return (
      <>
        <header className="page-header">
          <SidebarTrigger />
          <span className="page-header-brand">AVA COMMAND</span>
        </header>
        <div className="page-body">
          <div className="page-empty-state">Loading settings...</div>
        </div>
      </>
    )

  return (
    <>
      <header className="page-header">
        <SidebarTrigger />
        <span className="page-header-brand">AVA COMMAND</span>
        <div className="page-header-spacer" />
        <div className="header-actions">
          {saved && (
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#00ff94",
                padding: "4px 10px",
                background: "rgba(0,255,148,0.08)",
                border: "1px solid #00cc70",
                borderRadius: 3,
              }}
            >
              ✓ Saved
            </span>
          )}
          {saving && (
            <span
              style={{ fontSize: 10, letterSpacing: "0.1em", color: "#4a6080" }}
            >
              Saving...
            </span>
          )}
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
          <div className="page-hero-title">Settings</div>
          <div className="page-hero-sub">
            Configure Ava&apos;s behavior, tone, and data preferences.
          </div>
        </div>

        <div style={{ padding: "0 28px", maxWidth: 720 }}>
          {/* Tone */}
          <div style={S.section}>
            <div style={S.title}>Response Tone</div>
            <div style={S.desc}>
              Controls how Ava communicates. Takes effect on the next message.
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {TONE_OPTIONS.map((opt) => {
                const isActive = settings.tone === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => update("tone", opt.value)}
                    style={{
                      background: isActive ? "rgba(0,200,255,0.08)" : "#0d1422",
                      border: `1px solid ${isActive ? "#0099cc" : "#1a2845"}`,
                      borderRadius: 6,
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isActive ? "#00c8ff" : "#c8d6f0",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                      }}
                    >
                      {opt.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#4a6080",
                        lineHeight: 1.4,
                      }}
                    >
                      {opt.desc}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Memory */}
          <div style={S.section}>
            <div style={S.title}>Memory Extraction</div>
            <div style={S.desc}>
              When enabled, Ava automatically extracts facts and preferences
              from your conversations.
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 12, color: "#4a6080" }}>
                {settings.memory_enabled === "true"
                  ? "Memory extraction is ON"
                  : "Memory extraction is OFF"}
              </span>
              <button
                type="button"
                onClick={() =>
                  update(
                    "memory_enabled",
                    settings.memory_enabled === "true" ? "false" : "true",
                  )
                }
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  border: `1px solid ${settings.memory_enabled === "true" ? "#00c8ff" : "#1a2845"}`,
                  background:
                    settings.memory_enabled === "true" ? "#0099cc" : "#111b2e",
                  cursor: "pointer",
                  position: "relative",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 3,
                    left: settings.memory_enabled === "true" ? 21 : 3,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background:
                      settings.memory_enabled === "true" ? "white" : "#4a6080",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
          </div>

          {/* Retention */}
          <div style={S.section}>
            <div style={S.title}>Conversation Retention</div>
            <div style={S.desc}>
              How many days of conversation history to keep.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {RETENTION_OPTIONS.map((days) => {
                const isActive = settings.retention_days === days
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => update("retention_days", days)}
                    style={{
                      padding: "6px 16px",
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      border: `1px solid ${isActive ? "#0099cc" : "#1a2845"}`,
                      borderRadius: 4,
                      background: isActive
                        ? "rgba(0,200,255,0.08)"
                        : "transparent",
                      color: isActive ? "#00c8ff" : "#4a6080",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {days}d
                  </button>
                )
              })}
            </div>
          </div>

          {/* Data */}
          <div style={S.section}>
            <div style={S.title}>Data & Privacy</div>
            <div style={S.desc}>
              Export or permanently delete all data associated with your
              account.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => window.open(`${SETTINGS_URL}/export`, "_blank")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  border: "1px solid #1a2845",
                  borderRadius: 4,
                  background: "transparent",
                  color: "#4a6080",
                  cursor: "pointer",
                }}
              >
                <ExportIcon /> Export Conversation
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  border: "1px solid rgba(255,68,68,0.3)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "#ff4444",
                  cursor: "pointer",
                }}
              >
                <DeleteIcon /> Delete All Data
              </button>
            </div>
          </div>

          {/* Account */}
          <div style={{ ...S.section, borderBottom: "none" }}>
            <div style={S.title}>Account</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "#0d1422",
                border: "1px solid #1a2845",
                borderRadius: 6,
                padding: "14px 16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "#1a0d35",
                  border: "1px solid #7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: "#00c8ff",
                  flexShrink: 0,
                }}
              >
                N
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#c8d6f0",
                    letterSpacing: "0.05em",
                  }}
                >
                  OPERATOR 01
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#00ff94",
                    letterSpacing: "0.1em",
                    marginTop: 2,
                  }}
                >
                  ● SYSTEM LINKED
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "USER ID", value: USER_ID },
                  { label: "VERSION", value: "AVA 0.1.0" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{ display: "flex", flexDirection: "column", gap: 3 }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "#253048",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#4a6080",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-box"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title" style={{ color: "#ff4444" }}>
              Delete All Data
            </div>
            <div className="modal-sub">
              This will permanently delete your conversation history, memory
              vault, installed plugins, and settings. This cannot be undone.
            </div>
            <div className="modal-footer" style={{ gap: 10 }}>
              <button
                className="abort-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingData}
                onClick={handleDeleteAll}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  border: "1px solid #ff4444",
                  borderRadius: 4,
                  background: "rgba(255,68,68,0.1)",
                  color: "#ff4444",
                  cursor: deletingData ? "default" : "pointer",
                  opacity: deletingData ? 0.5 : 1,
                }}
              >
                {deletingData ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ExportIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5M2 10h9"
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
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M1.5 3.5h10M4.5 3.5V2.5h4v1M10.5 3.5l-.5 7.5a1 1 0 01-1 .9H4a1 1 0 01-1-.9l-.5-7.5"
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
