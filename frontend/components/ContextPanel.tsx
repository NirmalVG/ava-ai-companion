"use client"

/*
  ContextPanel.tsx — route-aware right panel

  Each page shows contextually relevant data:
  - /chat    → Calendar API tool + entity + rule + MAIL-RELAY log
  - /memory  → Neural_Indexer_v4 tool + memory snippets
  - /plugins → Neural Engine v2 + Context Mesh tools + plugin activity log
*/

import { usePathname } from "next/navigation"

export default function ContextPanel() {
  const pathname = usePathname()
  const route = pathname.startsWith("/memory")
    ? "memory"
    : pathname.startsWith("/plugins")
      ? "plugins"
      : "chat"

  return (
    <aside className="context-panel">
      <div className="context-panel-header">
        <div className="context-panel-title">Context Panel</div>
        <div className="context-panel-sub">Live Intelligence Stream</div>
      </div>

      <div className="context-panel-body">
        {route === "chat" && <ChatContext />}
        {route === "memory" && <MemoryContext />}
        {route === "plugins" && <PluginsContext />}
      </div>
    </aside>
  )
}

/* ── Chat context ─────────────────────────────────────────────── */
function ChatContext() {
  return (
    <>
      <div>
        <div className="context-section-label">
          Active Tools
          <span className="context-badge">01/08</span>
        </div>
        <div className="tool-card">
          <div className="tool-icon">◈</div>
          <div>
            <div className="tool-name">Calendar API</div>
            <div className="tool-status">Awaiting Acknowledgement</div>
          </div>
        </div>
      </div>

      <div>
        <div className="context-section-label">Memory Snippets</div>
        <Snippet label="◉ Entity Resolved">
          Priya = Priya Sharma,
          <br />
          priya@example.com
        </Snippet>
        <Snippet label="◎ Context Rule">
          Always book 15m buffer for external calls.
        </Snippet>
      </div>

      <div>
        <div className="context-section-label">Plugin Activity</div>
        <div className="plugin-log">
          <div className="plugin-log-name">
            <span className="plugin-log-accent">⚡</span>
            MAIL-RELAY_V2
          </div>
          <LogLine time="14:02:14" ok="SMTP_SEND: 250 OK" />
          <LogLine time="14:02:14" text="CAL_INV_ID: 982-AC-11" />
        </div>
      </div>
    </>
  )
}

/* ── Memory context ───────────────────────────────────────────── */
function MemoryContext() {
  return (
    <>
      <div>
        <div className="context-section-label">
          Active Tools
          <span className="context-inline-status">⚡</span>
        </div>
        <div className="tool-card">
          <div className="tool-icon tool-icon-small">⬡</div>
          <div>
            <div className="tool-name">Neural_Indexer_v4</div>
            <div className="tool-status tool-status-teal">
              Refining database associations...
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="context-section-label">Memory Snippets</div>
        <Snippet>
          User prefers high-contrast dark themes for evening focus sessions.
        </Snippet>
        <Snippet>
          Key contact: CEO Sarah Miller. Last interaction: 4h ago.
        </Snippet>
      </div>
    </>
  )
}

/* ── Plugins context ──────────────────────────────────────────── */
function PluginsContext() {
  return (
    <>
      <div>
        <div className="context-section-label">
          Active Tools
          <span className="context-badge">03</span>
        </div>
        <div className="tool-card">
          <div className="tool-icon">⚡</div>
          <div>
            <div className="tool-name">Neural Engine v2</div>
            <div className="tool-status tool-status-green">Online</div>
          </div>
        </div>
        <div className="tool-card">
          <div className="tool-icon tool-icon-small">☰</div>
          <div>
            <div className="tool-name">Context Mesh</div>
            <div className="tool-status tool-status-green">Indexing</div>
          </div>
        </div>
      </div>

      <div>
        <div className="context-section-label">Plugin Activity</div>
        <div className="plugin-log">
          <LogLine time="14:22:01" text="NOTION_SYNC_INIT" teal />
          <div className="plugin-log-note">
            Scanning workspace: &quot;Engineering&quot;
          </div>
          <LogLine time="SYS" text="Awaiting user trigger..." />
        </div>
      </div>
    </>
  )
}

/* ── Helpers ──────────────────────────────────────────────────── */
function Snippet({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="snippet-card">
      {label && <div className="snippet-label">{label}</div>}
      <div className="snippet-body">{children}</div>
    </div>
  )
}

function LogLine({
  time,
  ok,
  text,
  teal,
}: {
  time: string
  ok?: string
  text?: string
  teal?: boolean
}) {
  return (
    <div className="log-line log-line-wrap">
      <span className="log-time">[{time}]</span>
      {ok && <span className="log-ok">{ok}</span>}
      {text && <span className={teal ? "log-text-teal" : "log-text-muted"}>{text}</span>}
    </div>
  )
}
