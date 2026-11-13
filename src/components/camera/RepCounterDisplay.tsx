"use client"

import * as React from "react"
import { createRepCounter } from "@/lib/exercises/repCounter"
import type { ExerciseConfig } from "@/types"
import { getExercise } from "@/lib/exercises"

interface RepCounterDisplayProps {
  config: ExerciseConfig
  reps: number
  phase: string
  angle: number | null
  inFrame: boolean
  seconds: number
}

export function RepCounterDisplay({
  config,
  reps,
  phase,
  angle,
  inFrame,
  seconds,
}: RepCounterDisplayProps) {
  const phaseLabel: Record<string, string> = {
    up: "Up",
    down: "Down",
    holding: "Hold",
    resting: "Ready",
  }
  const showReps = config.type === "rep"

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {config.name}
      </span>
      <div className="flex items-baseline gap-1">
        {showReps ? (
          <span className="text-6xl font-black text-slate-900 tracking-tighter">{reps}</span>
        ) : (
          <span className="text-5xl font-black text-slate-900 tracking-tighter">
            {Math.max(0, config.targetSeconds! - seconds)}
          </span>
        )}
      </div>
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
          inFrame
            ? phase === "holding" || phase === "up" || phase === "down"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
            : "bg-amber-100 text-amber-700 border border-amber-200"
        }`}
      >
        {inFrame ? phaseLabel[phase] ?? phase : "Get in frame"}
      </span>
      {angle != null && inFrame && (
        <span className="text-xs text-slate-400">{Math.round(angle)}°</span>
      )}
    </div>
  )
}
