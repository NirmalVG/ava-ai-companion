"use client"

import { useTheme } from "@/hooks/useTheme"

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 52,
        height: 28,
        borderRadius: 14,
        border: `1px solid ${isDark ? "#1a2845" : "#b8c4e0"}`,
        background: isDark
          ? "linear-gradient(135deg, #0a0f1e 0%, #111b2e 100%)"
          : "linear-gradient(135deg, #ddeeff 0%, #e8f4ff 100%)",
        cursor: "pointer",
        position: "relative",
        transition: "all 0.3s ease",
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
      }}
    >
      {/* Track icons */}
      <span
        style={{
          position: "absolute",
          left: 6,
          fontSize: 10,
          opacity: isDark ? 1 : 0,
          transition: "opacity 0.2s",
          lineHeight: 1,
        }}
      >
        ✦
      </span>
      <span
        style={{
          position: "absolute",
          right: 6,
          fontSize: 10,
          opacity: isDark ? 0 : 1,
          transition: "opacity 0.2s",
          lineHeight: 1,
        }}
      >
        ☀
      </span>

      {/* Knob */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle at 35% 35%, #c8d6f0, #7899cc)"
            : "radial-gradient(circle at 35% 35%, #ffe066, #ffaa00)",
          transform: isDark ? "translateX(0px)" : "translateX(24px)",
          transition: "transform 0.3s ease, background 0.3s ease",
          flexShrink: 0,
          boxShadow: isDark
            ? "0 0 6px rgba(120,153,204,0.4)"
            : "0 0 8px rgba(255,170,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
        }}
      >
        {/* Moon craters / sun center */}
        {isDark ? (
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 6 }}>●</span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 7 }}>★</span>
        )}
      </div>
    </button>
  )
}
