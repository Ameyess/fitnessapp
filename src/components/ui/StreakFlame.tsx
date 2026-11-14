"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface StreakFlameProps {
  count: number
  longest?: number
  size?: "sm" | "md" | "lg"
  className?: string
}

export function StreakFlame({ count, longest, size = "md", className }: StreakFlameProps) {
  const flame = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 font-extrabold ${className ?? ""}`}
      style={{
        backgroundColor: "var(--c-surface)",
        borderColor: "var(--c-flame)",
        color: "var(--c-flame)",
      }}
    >
      <span aria-hidden>🔥</span>
      <span className="tabular-nums">{count}</span>
      {longest != null && longest > count && (
        <span className="text-[0.65em] font-bold opacity-70">best {longest}</span>
      )}
    </span>
  )
  if (size === "sm") return <span className="text-sm">{flame}</span>
  return flame
}

interface ProgressRingProps {
  value: number
  max: number
  size?: number
  color?: "primary" | "flame" | "blue"
  /** Colour of the empty track behind the progress arc. */
  track?: string
  children?: React.ReactNode
}

export function ProgressRing({
  value,
  max,
  size = 120,
  color = "primary",
  track = "var(--c-border)",
  children,
}: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0))
  const r = (size - 14) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const colors: Record<string, string> = {
    primary: "var(--c-primary)",
    flame: "var(--c-flame)",
    blue: "var(--c-blue)",
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors[color]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  color?: "primary" | "flame" | "blue"
}

export function ProgressBar({
  value,
  max,
  className,
  color = "primary",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0))
  const colors: Record<string, string> = {
    primary: "var(--c-primary)",
    flame: "var(--c-flame)",
    blue: "var(--c-blue)",
  }
  return (
    <div
      className={`h-3 w-full overflow-hidden rounded-full border ${className ?? ""}`}
      style={{ backgroundColor: "var(--c-surface-2)", borderColor: "var(--c-border)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          backgroundColor: colors[color],
          transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      />
    </div>
  )
}
