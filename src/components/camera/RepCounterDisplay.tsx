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
}: RepCounterDisplayProps) {
  const isTimed = config.type === "timed"
  const remaining = isTimed ? Math.max(0, (goal ?? config.targetSeconds ?? 30) - seconds) : 0

  const phaseLabel: Record<string, string> = {
    up: "Up",
    down: "Down",
    holding: "Holding",
    resting: "Ready",
  }

  const textColor = onDark ? "#ffffff" : "var(--c-text)"
  const subColor = onDark ? "rgba(255,255,255,0.72)" : "var(--c-muted)"
  const faintColor = onDark ? "rgba(255,255,255,0.55)" : "var(--c-faint)"

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
        style={{ color: subColor }}
      >
        {config.name}
      </span>

      <motion.div
        key={isTimed ? seconds : reps}
        initial={{ scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 16 }}
        className="flex items-baseline gap-1.5"
      >
        <span
          className="text-7xl font-black leading-none tabular-nums"
          style={{
            color: textColor,
            textShadow: "0 2px 10px rgba(0,0,0,0.55)",
          }}
        >
          {isTimed ? remaining : reps}
        </span>
        {!isTimed && (
          <span className="text-lg font-extrabold" style={{ color: faintColor }}>
            reps
          </span>
        )}
      </motion.div>

      <span
        className="rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide"
        style={
          inFrame
            ? {
                backgroundColor: onDark ? "rgba(88,204,2,0.92)" : "var(--c-primary-soft)",
                borderColor: "transparent",
                color: onDark ? "#ffffff" : "var(--c-primary-dark)",
              }
            : {
                backgroundColor: onDark ? "rgba(255,150,0,0.92)" : "var(--c-flame-soft)",
                borderColor: "transparent",
                color: "#ffffff",
              }
        }
      >
        {inFrame ? phaseLabel[phase] ?? phase : "Get in frame"}
      </span>

      {angle != null && inFrame && (
        <span className="text-xs font-bold tabular-nums" style={{ color: faintColor }}>
          {Math.round(angle)}°
        </span>
      )}
    </div>
  )
}
