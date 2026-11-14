"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BarChart3, Users, Settings } from "lucide-react"
import { useTheme } from "@/components/ui/ThemeProvider"
import { useProfileStore } from "@/store/profile"

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "Stats", icon: BarChart3 },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function TopNav() {
  const pathname = usePathname()
  const { resolved, toggle } = useTheme()
  const streak = useProfileStore((s) => s.profile?.streak ?? 0)

  // The live workout is a fullscreen experience - no app chrome.
  const isImmersive =
    !!pathname && pathname.startsWith("/exercises/") && pathname.endsWith("/live")

  if (isImmersive) return null

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: "var(--c-surface)",
        borderColor: "var(--c-border)",
      }}
    >
      <div
        className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 safe-area-pad-top"
        style={{ height: 56 }}
      >
        {/* Brand */}
        <Link
          href="/"
          aria-label="FitStreak home"
          className="flex shrink-0 items-center gap-1.5 text-xl font-black tracking-tight"
          style={{ color: "var(--c-primary)" }}
        >
          <span aria-hidden>💪</span>
          <span className="hidden sm:inline">FitStreak</span>
        </Link>

        {/* Streak - always visible, like Duolingo's header streak */}
        <Link
          href="/"
          aria-label={`Current streak: ${streak} day${streak === 1 ? "" : "s"}`}
          className="flex shrink-0 items-center gap-1 rounded-full border-2 px-3 py-1.5 font-extrabold transition-transform active:scale-95"
          style={{
            borderColor: "var(--c-flame)",
            backgroundColor: "var(--c-flame-soft)",
            color: "var(--c-flame)",
          }}
        >
          <span aria-hidden className="text-base leading-none">
            🔥
          </span>
          <span className="text-sm tabular-nums leading-none">{streak}</span>
        </Link>

        {/* Nav icons */}
        <nav className="flex items-center gap-0.5" aria-label="Main">
          {TABS.map((tab) => {
            const active =
              pathname === tab.href ||
              (tab.href !== "/" && pathname?.startsWith(tab.href))
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                title={tab.label}
                className="flex h-11 w-11 items-center justify-center rounded-2xl transition-colors active:scale-90"
                style={{
                  color: active ? "var(--c-primary)" : "var(--c-faint)",
                  backgroundColor: active ? "var(--c-primary-soft)" : "transparent",
                }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.75 : 2.25} />
              </Link>
            )
          })}
          <button
            onClick={toggle}
            aria-label={`Switch to ${resolved === "dark" ? "light" : "dark"} mode`}
            title="Toggle theme"
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-colors active:scale-90"
            style={{ color: "var(--c-faint)" }}
          >
            {resolved === "dark" ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  )
}
