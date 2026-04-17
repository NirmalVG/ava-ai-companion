"use client"

/*
  app/chat/page.tsx — The AVA COMMAND chat interface

  Matches Image 1:
  - Header: "AVA COMMAND" brand + LIVE SESSION / ARCHIVE tabs + search + icons
  - Messages: user (purple bg) + ava (dark card with optional tool call block)
  - Tool call block: function name + SUCCESS/PENDING badge + JSON payload
  - Input: "SEND COMMAND..." textarea + mic icon + TRANSMIT button
  - Empty state: centered prompt suggestions

  SSE event types from backend:
    {"type": "token",       "content": "..."}  → append text
    {"type": "tool_start",  "name": "...", "args": {...}} → show tool step
    {"type": "tool_result", "name": "...", "result": "..."} → resolve step
    {"type": "error",       "content": "..."} → inline error
*/

import { useState, useRef, useEffect, useCallback } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import ReactMarkdown from "react-markdown"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

// ─── Types ───────────────────────────────────────────────────────
type Role = "user" | "ava"

interface ToolStep {
  name: string
  args: Record<string, unknown>
  result?: string
}

interface Message {
  id: string
  role: Role
  content: string
  isStreaming?: boolean
  toolSteps?: ToolStep[]
  thinkingText?: string
  timestamp: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}
function now() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

// ─── Suggestion prompts shown in empty state ──────────────────────
const SUGGESTIONS = [
  "Schedule a 30-min call with Priya next Tuesday at 3pm",
  "What time is it in Tokyo right now?",
  "What's the weather in Thrissur?",
  "Calculate 2 to the power of 32",
]

// ─── Main Component ───────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTab, setActiveTab] = useState<"live" | "archive">("live")

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`
  }, [input])

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || isStreaming) return

      const userMsg: Message = {
        id: uid(),
        role: "user",
        content,
        timestamp: now(),
      }
      const avaId = uid()
      const avaMsg: Message = {
        id: avaId,
        role: "ava",
        content: "",
        isStreaming: true,
        toolSteps: [],
        thinkingText: undefined,
        timestamp: now(),
      }

      setMessages((p) => [...p, userMsg, avaMsg])
      setInput("")
      setIsStreaming(true)

      const history = [...messages, userMsg].map(({ role, content: c }) => ({
        role: role === "ava" ? "assistant" : role,
        content: c,
      }))

      try {
        const res = await fetch(`${API_BASE}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        })
        if (!res.ok || !res.body) throw new Error("Connection failed")

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = decoder.decode(value, { stream: true }).split("\n")

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const raw = line.slice(6)
            if (raw === "[DONE]") break
            let ev: Record<string, unknown>
            try {
              ev = JSON.parse(raw)
            } catch {
              continue
            }

            const type = ev.type as string

            if (type === "token") {
              setMessages((p) =>
                p.map((m) =>
                  m.id === avaId
                    ? { ...m, content: m.content + (ev.content ?? "") }
                    : m,
                ),
              )
            } else if (type === "tool_start") {
              const step: ToolStep = {
                name: ev.name as string,
                args: (ev.args ?? {}) as Record<string, unknown>,
              }
              setMessages((p) =>
                p.map((m) =>
                  m.id === avaId
                    ? {
                        ...m,
                        thinkingText: `Executing ${ev.name as string}...`,
                        toolSteps: [...(m.toolSteps ?? []), step],
                      }
                    : m,
                ),
              )
            } else if (type === "tool_result") {
              const name = ev.name as string
              const result = ev.result as string
              setMessages((p) =>
                p.map((m) => {
                  if (m.id !== avaId) return m
                  const steps = [...(m.toolSteps ?? [])]
                  const idx = steps.map((s) => s.name).lastIndexOf(name)
                  if (idx !== -1) steps[idx] = { ...steps[idx], result }
                  return { ...m, toolSteps: steps }
                }),
              )
            } else if (type === "error") {
              setMessages((p) =>
                p.map((m) =>
                  m.id === avaId
                    ? {
                        ...m,
                        content: `⚠ ${ev.content ?? "Something went wrong."}`,
                        isStreaming: false,
                      }
                    : m,
                ),
              )
              return
            }
          }
        }
      } catch {
        setMessages((p) =>
          p.map((m) =>
            m.id === avaId
              ? {
                  ...m,
                  content: "Connection error. Retry?",
                  isStreaming: false,
                }
              : m,
          ),
        )
      } finally {
        setMessages((p) =>
          p.map((m) => (m.id === avaId ? { ...m, isStreaming: false } : m)),
        )
        setIsStreaming(false)
        inputRef.current?.focus()
      }
    },
    [input, isStreaming, messages],
  )

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Page header */}
      <header className="page-header">
        <SidebarTrigger />

        <span className="page-header-brand">AVA COMMAND</span>

        <div className="header-tabs">
          <button
            className={`header-tab ${activeTab === "live" ? "active" : ""}`}
            onClick={() => setActiveTab("live")}
          >
            Live Session
          </button>
          <button
            className={`header-tab ${activeTab === "archive" ? "active" : ""}`}
            onClick={() => setActiveTab("archive")}
          >
            Archive
          </button>
        </div>

        <div className="header-actions">
          <div className="header-search">
            <SearchIcon />
            <input placeholder="CMD_SEARCH..." />
          </div>
          <button className="icon-btn" title="Notifications">
            <BellIcon />
          </button>
          <button className="icon-btn" title="Menu">
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Chat area — direct flex child of main-content so flex:1 + overflow-y:auto work */}
      <div className="chat-area">
        {messages.length === 0 && (
          <EmptyState
            onSuggest={(s) => sendMessage(s)}
            suggestions={SUGGESTIONS}
          />
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} message={msg} />
          ) : (
            <AvaMessage key={msg.id} message={msg} />
          ),
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-box">
          <button className="chat-input-icon" title="Attach" type="button">
            <AttachIcon />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="SEND COMMAND..."
            disabled={isStreaming}
            rows={1}
          />
          <button className="chat-input-icon" title="Voice" type="button">
            <MicIcon />
          </button>
          <button
            className={`transmit-btn ${isStreaming ? "streaming" : ""}`}
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            type="button"
          >
            {isStreaming ? "Processing..." : "Transmit"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────

function UserMessage({ message }: { message: Message }) {
  return (
    <div className="fade-up">
      <div className="message-user">{message.content}</div>
      <div className="message-meta">OPERATOR • {message.timestamp}</div>
    </div>
  )
}

function AvaMessage({ message }: { message: Message }) {
  const hasTools = (message.toolSteps?.length ?? 0) > 0

  return (
    <div className="fade-up">
      <div className="message-ava">
        {/* Thinking line — shown while tools are running */}
        {message.isStreaming && message.thinkingText && (
          <div className="message-ava-thinking">{message.thinkingText}</div>
        )}

        {/* Tool call blocks */}
        {hasTools &&
          message.toolSteps!.map((step, i) => (
            <ToolCallBlock key={i} step={step} />
          ))}

        {/* Final text */}
        {(message.content || message.isStreaming) && (
          <div
            className={`message-ava-text ${message.isStreaming && !message.content && hasTools ? "" : message.isStreaming ? "streaming-cursor" : ""}`}
          >
            {message.isStreaming && !message.content ? (
              <span className="message-ava-placeholder">
                Composing response
                <span className="streaming-cursor" />
              </span>
            ) : (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            )}
          </div>
        )}
      </div>
      <div className="message-meta">AVA SYSTEM • {message.timestamp}</div>
    </div>
  )
}

function ToolCallBlock({ step }: { step: ToolStep }) {
  const isDone = step.result !== undefined

  // Pretty-print args as JSON with syntax highlighting
  const formattedArgs = escapeHtml(JSON.stringify(step.args, null, 2))
  const highlighted = formattedArgs
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="json-str">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="json-num">$1</span>')

  return (
    <div className="tool-call-block">
      <div className="tool-call-header">
        <div className="tool-call-name">
          <span className="tool-call-glyph">⌬</span>
          {step.name}
        </div>
        {isDone ? (
          <span className="badge-success">Success</span>
        ) : (
          <span className="badge-pending">Running</span>
        )}
      </div>
      <div
        className="tool-call-json"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  )
}

function EmptyState({
  onSuggest,
  suggestions,
}: {
  onSuggest: (s: string) => void
  suggestions: string[]
}) {
  return (
    <div className="chat-empty-state">
      <div className="chat-empty-state-mark">AVA</div>
      <div className="chat-empty-state-copy">
        Awaiting command transmission.
      </div>
      <div className="chat-empty-state-grid">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="chat-suggestion-btn"
            type="button"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
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

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 4h10M2 7h10M2 10h10"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M12 6L6.5 11.5a3.5 3.5 0 01-4.95-4.95l5-5a2 2 0 012.83 2.83L4.5 9.5a.5.5 0 01-.71-.71L9 3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect
        x="5"
        y="1"
        width="4"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2.5 7a4.5 4.5 0 009 0M7 11.5V13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
