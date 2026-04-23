"use client"

/*
  SearchOverlay.tsx — CMD_SEARCH overlay

  Triggered when the user types in any header search box.
  Shows live results across messages, memories, plugins and skills.
  Keyboard navigable: Arrow keys to move, Enter to select, Esc to close.
*/

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const USER_ID = "operator_01"

interface SearchResult {
  type: "message" | "memory" | "plugin" | "skill"
  title: string
  snippet: string
  metadata: Record<string, unknown>
  score: number
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
  breakdown: {
    messages: number
    memories: number
    plugins: number
    skills: number
  }
}

const TYPE_CONFIG = {
  message: { icon: "◎", color: "#a78bfa", label: "Message" },
  memory: { icon: "◈", color: "#00c8ff", label: "Memory" },
  plugin: { icon: "⚡", color: "#00ff94", label: "Plugin" },
  skill: { icon: "≡", color: "#ff6b35", label: "Skill" },
}

interface SearchOverlayProps {
  query: string
  onClose: () => void
}

export default function SearchOverlay({ query, onClose }: SearchOverlayProps) {
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch results with debounce
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `${API_BASE}/search/${USER_ID}?q=${encodeURIComponent(query.trim())}`,
        )
        if (!res.ok) return
        const data: SearchResponse = await res.json()
        setResults(data)
        setSelectedIdx(0)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!results?.results.length) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, results.results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        handleSelect(results.results[selectedIdx])
      } else if (e.key === "Escape") {
        onClose()
      }
    },
    [results, selectedIdx, onClose],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const handleSelect = (result: SearchResult) => {
    switch (result.type) {
      case "message":
        router.push("/chat")
        break
      case "memory":
        router.push("/memory")
        break
      case "plugin":
      case "skill":
        router.push("/plugins")
        break
    }
    onClose()
  }

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    )
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          style={{
            background: "rgba(0,200,255,0.25)",
            color: "var(--color-teal)",
            borderRadius: 2,
            padding: "0 1px",
          }}
        >
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  if (!query || query.trim().length < 2) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Overlay panel */}
      <div
        ref={overlayRef}
        style={{
          position: "fixed",
          top: 64,
          left: "50%",
          transform: "translateX(-50%)",
          width: 640,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "70vh",
          zIndex: 101,
          background: "var(--color-bg-overlay)",
          border: "1px solid var(--color-border-bright)",
          borderRadius: 8,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--color-teal)",
              }}
            >
              Search
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {query}
            </span>
            {loading && (
              <span
                style={{
                  fontSize: 9,
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.1em",
                }}
              >
                Scanning...
              </span>
            )}
          </div>

          {results && (
            <div style={{ display: "flex", gap: 10 }}>
              {Object.entries(results.breakdown).map(
                ([key, count]) =>
                  count > 0 && (
                    <span
                      key={key}
                      style={{
                        fontSize: 8,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color:
                          TYPE_CONFIG[key as keyof typeof TYPE_CONFIG]?.color ??
                          "var(--color-text-secondary)",
                      }}
                    >
                      {count} {key}
                    </span>
                  ),
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* No results */}
          {!loading && results?.total === 0 && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                fontSize: 11,
                color: "var(--color-text-secondary)",
                letterSpacing: "0.05em",
              }}
            >
              No results for &quot;{query}&quot;
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !results && (
            <div style={{ padding: "8px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px",
                    marginBottom: 4,
                    background: "var(--color-bg-elevated)",
                    borderRadius: 5,
                    opacity: 0.5,
                  }}
                >
                  <div
                    style={{
                      height: 10,
                      width: "40%",
                      background: "var(--color-border-default)",
                      borderRadius: 3,
                      marginBottom: 6,
                    }}
                  />
                  <div
                    style={{
                      height: 8,
                      width: "80%",
                      background: "var(--color-border-subtle)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Result items */}
          {results?.results.map((result, idx) => {
            const config = TYPE_CONFIG[result.type] ?? TYPE_CONFIG.plugin
            const isSelected = idx === selectedIdx

            return (
              <div
                key={idx}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                  background: isSelected
                    ? "var(--color-bg-elevated)"
                    : "transparent",
                  borderLeft: isSelected
                    ? `2px solid ${config.color}`
                    : "2px solid transparent",
                  transition: "all 0.1s",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `${config.color}15`,
                    border: `1px solid ${config.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: config.color,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {config.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--color-text-primary)",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {highlightMatch(result.title, query)}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 5px",
                        background: `${config.color}12`,
                        border: `1px solid ${config.color}25`,
                        borderRadius: 3,
                        color: config.color,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        flexShrink: 0,
                      }}
                    >
                      {config.label}
                    </span>

                    {/* Extra metadata badges */}
                    {result.type === "memory" && (
                      <span
                        style={{
                          fontSize: 8,
                          color: "var(--color-text-secondary)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {result.metadata.memory_type as string}
                        {" · "}
                        {result.metadata.confidence as number}%
                      </span>
                    )}
                    {(result.type === "plugin" || result.type === "skill") && (
                      <span
                        style={{
                          fontSize: 8,
                          color: result.metadata.enabled
                            ? "var(--color-green)"
                            : "var(--color-text-secondary)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {result.metadata.enabled ? "active" : "inactive"}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-secondary)",
                      lineHeight: 1.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {highlightMatch(result.snippet, query)}
                  </div>

                  {/* Message metadata */}
                  {result.type === "message" && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "var(--color-text-muted)",
                        marginTop: 3,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {(result.metadata.role as string).toUpperCase()}
                      {" · message #"}
                      {result.metadata.position as number}
                    </div>
                  )}
                </div>

                {/* Arrow indicator */}
                {isSelected && (
                  <div
                    style={{
                      color: "var(--color-text-secondary)",
                      fontSize: 10,
                      flexShrink: 0,
                      alignSelf: "center",
                    }}
                  >
                    ↵
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--color-border-subtle)",
            display: "flex",
            gap: 16,
            flexShrink: 0,
          }}
        >
          {[
            { key: "↑↓", label: "navigate" },
            { key: "↵", label: "open" },
            { key: "Esc", label: "close" },
          ].map(({ key, label }) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <kbd
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  background: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 3,
                  color: "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {key}
              </kbd>
              <span
                style={{
                  fontSize: 9,
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.05em",
                }}
              >
                {label}
              </span>
            </div>
          ))}
          {results && results.total > 0 && (
            <span
              style={{
                fontSize: 9,
                color: "var(--color-text-secondary)",
                marginLeft: "auto",
                letterSpacing: "0.05em",
              }}
            >
              {results.total} result{results.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
