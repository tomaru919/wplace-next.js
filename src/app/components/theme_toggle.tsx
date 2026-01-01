"use client"

import { useTheme } from "@/lib/theme_provider"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button onClick={toggleTheme} className="theme-toggle-btn" type="button">
      {theme === "light" ? "Dark Mode" : "Light Mode"}
    </button>
  )
}
