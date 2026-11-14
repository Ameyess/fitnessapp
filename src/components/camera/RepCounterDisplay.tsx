"use client"

import * as React from "react"
import { motion } from "framer-motion"
import type { ExerciseConfig } from "@/types"

interface RepCounterDisplayProps {
  config: ExerciseConfig
  reps: number
  phase: string
  angle: number | null
  inFrame: boolean
  seconds: number
  goal?: number
  /** Force light text - used over the dark camera overlay. */
  onDark?: boolean
  /** "column" for a centred stack, "row" for a compact top pill. */
  layout?: "column" | "row"
}

export function RepCounterDisplay({
  config,
  reps,
  phase,
  angle,
  inFrame,
  seconds,
  goal,
  onDark = false,
  layout = "column",
}: RepCounterDisplayProps) {
  const isTimed = config.type === "timed"
  const remaining = isTimed
    ? Math.max(0, (goal ?? config.targetSeconds ?? 30) - seconds)
    : 0

  const phaseLabel: Record<string, string> = {
    up: "Up",
    down: "Down",
    holding: "Holding",
    resting: "Ready",
  }

  const textColor = onDark ? "#ffffff" : "var(--c-text)"
  const subColor = onDark ? "rgba(255,255,255,0.72)" : "var(--c-muted)"
  const faintColor = onDark ? "rgba(255,255,255,0.55)" : "var(--c-faint)"

  const number = isTimed ? remaining : reps
  const unit = isTimed ? "sec" : "reps"

  const badge = (
    <span
      className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
      style={
        inFrame
          ? {
              // Dark green background keeps white text at ~6.5:1 contrast
              backgroundColor: onDark ? "rgba(47,107,0,0.95)" : "var(--c-primary-soft)",
              color: onDark ? "#ffffff" : "var(--c-primary-text)",
            }
          : {
              // Dark orange background keeps white text at ~6.2:1 contrast
              backgroundColor: onDark ? "rgba(138,74,0,0.95)" : "var(--c-flame-soft)",
              color: onDark ? "#ffffff" : "var(--c-flame-text)",
            }
      }
    >
      {inFrame ? phaseLabel[phase] ?? phase : "Get in frame"}
    </span>
  )

  const count = (
    <motion.div
      key={number}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 16 }}
      className="flex items-baseline gap-1.5"
    >
      <span
        data-testid="rep-count"
        className="font-black leading-none tabular-nums"
        style={{
          color: textColor,
          fontSize: layout === "row" ? "3.25rem" : "4.5rem",
          textShadow: onDark ? "0 2px 10px rgba(0,0,0,0.55)" : undefined,
        }}
      >
        {number}
      </span>
      <span
        className="font-extrabold"
        style={{ color: faintColor, fontSize: layout === "row" ? "0.875rem" : "1.125rem" }}
      >
        {unit}
      </span>
    </motion.div>
  )

  if (layout === "row") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[10px] font-extrabold uppercase tracking-[0.18em]"
          style={{ color: subColor }}
        >
          {config.name}
        </span>
        <div className="flex items-center gap-3">
          {count}
          {badge}
        </div>
        {angle != null && inFrame && (
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: faintColor }}
          >
            {Math.round(angle)}°
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
        style={{ color: subColor }}
      >
        {config.name}
      </span>
      {count}
      {badge}
      {angle != null && inFrame && (
        <span className="text-xs font-bold tabular-nums" style={{ color: faintColor }}>
          {Math.round(angle)}°
        </span>
      )}
    </div>
  )
}
