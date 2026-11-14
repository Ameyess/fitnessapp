"use client"

import * as React from "react"

export type ThemeChoice = "light" | "dark" | "system"

interface ThemeCtx {
  theme: ThemeChoice
  resolved: "light" | "dark"
  setTheme: (t: ThemeChoice) => void
  toggle: () => void
}

const ThemeContext = React.createContext<ThemeCtx>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
  toggle: () => {},
})

export const THEME_KEY = "fitstreak:theme"

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

function applyTheme(choice: ThemeChoice) {
  if (typeof document === "undefined") return
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark())
  document.documentElement.classList.toggle("dark", dark)
}

/** Runs before paint to avoid a flash of the wrong theme. */
export const themeInitScript = `
(function(){
  try {
    var c = localStorage.getItem("${THEME_KEY}") || "system";
    var dark = c === "dark" || (c === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeChoice>("system")
  const [resolved, setResolved] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    let stored: ThemeChoice = "system"
    try {
      stored = (localStorage.getItem(THEME_KEY) as ThemeChoice) || "system"
    } catch {}
    setThemeState(stored)
    setResolved(
      stored === "dark" || (stored === "system" && systemPrefersDark())
        ? "dark"
        : "light"
    )
    applyTheme(stored)
  }, [])

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => {
      let current: ThemeChoice = "system"
      try {
        current = (localStorage.getItem(THEME_KEY) as ThemeChoice) || "system"
      } catch {}
      if (current === "system") {
        setResolved(mq.matches ? "dark" : "light")
        applyTheme("system")
      }
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const setTheme = React.useCallback((t: ThemeChoice) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {}
    applyTheme(t)
    setResolved(t === "dark" || (t === "system" && systemPrefersDark()) ? "dark" : "light")
  }, [])

  const toggle = React.useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark")
  }, [resolved, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return React.useContext(ThemeContext)
}
