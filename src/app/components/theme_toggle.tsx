"use client"

import { useTheme } from "@/lib/theme_provider"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      style={{
        backgroundColor: "var(--secondary-button-background)",
        color: "var(--secondary-button-text)",
        border: "2px solid var(--border-main)",
        padding: "8px 16px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.1s ease",
        boxShadow: "4px 4px 0 var(--shadow-main)",
        fontFamily: '"DotGothic16", sans-serif',
        fontSize: "0.9rem",
      }}
      type="button"
    >
      {theme === "light" ? "Dark Mode" : "Light Mode"}
    </button>
  )
}
