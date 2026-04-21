"use client"

import { useState, useEffect } from "react"

export type Theme = "dark" | "light"

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const stored = localStorage.getItem("ava-theme") as Theme | null
    if (stored) {
      setTheme(stored)
      document.documentElement.setAttribute("data-theme", stored)
    }
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    localStorage.setItem("ava-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  return { theme, toggleTheme }
}
