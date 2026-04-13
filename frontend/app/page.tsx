"use client"

/*
  app/page.tsx  (Step 2 — Tool Calling)

  New in this version:
  ─────────────────────────────────────────────────
  1. SSE now handles 4 event types:
       {"type": "token",       "content": "..."}  → append to response text
       {"type": "tool_start",  "name": "...", "args": {...}} → show tool step
       {"type": "tool_result", "name": "...", "result": "..."} → update tool step
       {"type": "error",       "content": "..."}  → show error

  2. Messages now have a `toolSteps` array — the "thinking" panel
     showing which tools Ava used and what they returned.

  3. ToolStepRow renders a step with two states:
       pending → pulsing amber dot (tool is running)
       done    → green check + result snippet
*/

import { useState, useRef, useEffect, useCallback } from "react"

// ─── Types ──────────────────────────────────────────────────────
type Role = "user" | "assistant"

interface ToolStep {
  name: string
  args: Record<string, unknown>
  result?: string // undefined = running, string = complete
}

interface Message {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
  toolSteps?: ToolStep[]
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ─── Tool display metadata ───────────────────────────────────────
const TOOL_META: Record<string, { label: string; icon: string }> = {
  get_current_time: { label: "Checking time", icon: "◷" },
  get_weather: { label: "Fetching weather", icon: "◈" },
  calculate: { label: "Calculating", icon: "∑" },
}

// ─── Main Component ──────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const userMsg: Message = { id: uid(), role: "user", content: trimmed }
    const asstId = uid()
    const asstMsg: Message = {
      id: asstId,
      role: "assistant",
      content: "",
      isStreaming: true,
      toolSteps: [],
    }

    setMessages((prev) => [...prev, userMsg, asstMsg])
    setInput("")
    setIsStreaming(true)

    const history = [...messages, userMsg].map(({ role, content }) => ({
      role,
      content,
    }))

    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      if (!response.ok || !response.body) throw new Error("Connection failed")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split("\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6)
          if (raw === "[DONE]") break

          let event: Record<string, unknown>
          try {
            event = JSON.parse(raw)
          } catch {
            continue
          }

          const type = event.type as string

          if (type === "token") {
            // Append each token to build up the response
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? { ...m, content: m.content + (event.content ?? "") }
                  : m,
              ),
            )
          } else if (type === "tool_start") {
            // Add a pending tool step
            const step: ToolStep = {
              name: event.name as string,
              args: (event.args ?? {}) as Record<string, unknown>,
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? { ...m, toolSteps: [...(m.toolSteps ?? []), step] }
                  : m,
              ),
            )
          } else if (type === "tool_result") {
            // Resolve the last pending step with this tool name
            const name = event.name as string
            const result = event.result as string
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== asstId) return m
                const steps = [...(m.toolSteps ?? [])]
                const idx = steps.map((s) => s.name).lastIndexOf(name)
                if (idx !== -1) steps[idx] = { ...steps[idx], result }
                return { ...m, toolSteps: steps }
              }),
            )
          } else if (type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstId
                  ? {
                      ...m,
                      content: `⚠ ${event.content ?? "Something went wrong."}`,
                      isStreaming: false,
                    }
                  : m,
              ),
            )
            return
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                content:
                  "I'm having trouble connecting. Would you like to try again?",
                isStreaming: false,
              }
            : m,
        ),
      )
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === asstId ? { ...m, isStreaming: false } : m)),
      )
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }, [input, isStreaming, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      <div className="ambient-bg" />

      {/* ── Header ──────────────────────────────────────────── */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-5"
        style={{ borderBottom: "1px solid var(--bg-border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--amber-glow)" }}
            />
            <div
              className="absolute inset-0 w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: "var(--amber-glow)", opacity: 0.4 }}
            />
          </div>
          <h1
            className="text-2xl tracking-wide"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--amber-glow)",
            }}
          >
            Ava
          </h1>
        </div>
        <span
          className="text-xs tracking-widest uppercase"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          {isStreaming ? "thinking…" : "ready"}
        </span>
      </header>

      {/* ── Messages ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && <EmptyState />}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input ───────────────────────────────────────────── */}
      <footer
        className="relative z-10 px-4 pb-6 pt-4"
        style={{ borderTop: "1px solid var(--bg-border)" }}
      >
        <div className="max-w-3xl mx-auto">
          <div className="glass-input rounded-2xl flex items-end gap-3 p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Ava anything — time, weather, math, or just talk…"
              disabled={isStreaming}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:opacity-30 max-h-40 py-1 px-2"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
              style={{
                background:
                  input.trim() && !isStreaming
                    ? "var(--amber-glow)"
                    : "var(--bg-border)",
                color:
                  input.trim() && !isStreaming
                    ? "#06060a"
                    : "var(--text-muted)",
              }}
            >
              <SendIcon />
            </button>
          </div>
          <p
            className="text-center text-xs mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Try: &ldquo;What time is it in Tokyo?&rdquo; · &ldquo;Weather in
            Thrissur?&rdquo; · &ldquo;What is 2 to the power of 32?&rdquo;
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── MessageBubble ───────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isAva = message.role === "assistant"
  const hasTools = isAva && (message.toolSteps?.length ?? 0) > 0

  return (
    <div
      className={`message-enter flex gap-4 ${isAva ? "" : "flex-row-reverse"}`}
    >
      {/* Avatar dot */}
      <div className="flex-shrink-0 mt-1">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: isAva ? "var(--amber-trace)" : "var(--user-surface)",
            border: `1px solid ${isAva ? "var(--amber-dim)" : "var(--user-blue)"}`,
            color: isAva ? "var(--amber-glow)" : "var(--user-blue)",
            fontSize: "9px",
          }}
        >
          {isAva ? "A" : "N"}
        </div>
      </div>

      {/* Content column */}
      <div className="flex flex-col gap-2" style={{ maxWidth: "85%", flex: 1 }}>
        {/* Tool steps panel — shown above the text */}
        {hasTools && (
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-2"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--bg-border)",
            }}
          >
            <span
              className="text-xs tracking-widest uppercase"
              style={{ color: "var(--text-muted)", marginBottom: "2px" }}
            >
              Ava used tools
            </span>
            {message.toolSteps!.map((step, i) => (
              <ToolStepRow key={i} step={step} />
            ))}
          </div>
        )}

        {/* Text response */}
        {(message.content || message.isStreaming) && (
          <div
            className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
              message.isStreaming ? "streaming-cursor" : ""
            }`}
            style={{
              background: isAva ? "var(--bg-surface)" : "var(--user-surface)",
              border: `1px solid ${isAva ? "var(--bg-border)" : "#1a2040"}`,
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message.isStreaming && !message.content ? (
              <span style={{ color: "var(--text-muted)" }}>
                {hasTools ? "Composing answer" : ""}
              </span>
            ) : (
              message.content
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ToolStepRow ─────────────────────────────────────────────────
function ToolStepRow({ step }: { step: ToolStep }) {
  const isDone = step.result !== undefined
  const meta = TOOL_META[step.name] ?? { label: step.name, icon: "⬡" }

  // Parse result for a readable one-liner
  let resultDisplay = step.result ?? ""
  try {
    const parsed = JSON.parse(resultDisplay)
    resultDisplay =
      parsed.datetime ??
      (parsed.description
        ? `${parsed.temperature_c}°C · ${parsed.description} · ${parsed.location}`
        : String(parsed.result ?? JSON.stringify(parsed)))
  } catch {
    /* plain string */
  }

  // For single-arg tools, show the arg inline
  const argValues = Object.values(step.args)
  const argLabel = argValues.length === 1 ? String(argValues[0]) : ""

  return (
    <div className="flex items-start gap-3">
      {/* Status dot */}
      <div className="flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center">
        {isDone ? (
          <div
            className="w-3 h-3 rounded-full flex items-center justify-center"
            style={{ background: "#1a3320", border: "1px solid #2d6640" }}
          >
            <span style={{ color: "#4ade80", fontSize: "7px", lineHeight: 1 }}>
              ✓
            </span>
          </div>
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full animate-ping"
            style={{ background: "var(--amber-glow)", opacity: 0.7 }}
          />
        )}
      </div>

      {/* Label + result */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "var(--amber-dim)", fontSize: "12px" }}>
            {meta.icon}
          </span>
          <span
            className="text-xs"
            style={{
              color: isDone ? "var(--text-secondary)" : "var(--amber-glow)",
            }}
          >
            {meta.label}
            {!isDone && <span className="streaming-cursor" />}
          </span>
          {argLabel && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {argLabel}
            </span>
          )}
        </div>
        {isDone && resultDisplay && (
          <span
            className="text-xs"
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "340px",
              display: "block",
            }}
          >
            → {resultDisplay}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────────────────
function EmptyState() {
  const suggestions = [
    "What time is it in Tokyo right now?",
    "What's the weather in Thrissur?",
    "Calculate 2 to the power of 32",
    "What's sqrt(17161)?",
  ]

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div
        className="text-5xl tracking-wider"
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--amber-glow)",
          opacity: 0.12,
        }}
      >
        Ava
      </div>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Your AGI-level companion is ready.
      </p>
      <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            className="text-left text-xs px-3 py-2.5 rounded-xl transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--bg-border)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor =
                "var(--amber-dim)"
              ;(e.currentTarget as HTMLElement).style.color =
                "var(--text-primary)"
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderColor =
                "var(--bg-border)"
              ;(e.currentTarget as HTMLElement).style.color =
                "var(--text-secondary)"
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1L15 8L8 15M15 8H1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
