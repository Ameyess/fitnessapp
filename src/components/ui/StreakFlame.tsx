"use client"

import { motion } from "framer-motion"
import * as React from "react"

interface StreakFlameProps {
  count: number
  longest?: number
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizes: Record<string, string> = {
  sm: "w-8 h-8 text-[1rem] leading-none",
  md: "w-12 h-12 text-[1.5rem] leading-none",
  lg: "w-16 h-16 text-[2.25rem] leading-none",
}

export function StreakFlame({ count, longest, className, size = "md" }: StreakFlameProps) {
  return (
    <motion.span
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`inline-flex items-center justify-center rounded-full border border-flame-200 bg-flame-50 px-3 py-1 font-bold text-flame-700 shadow-sm ${sizes[size]} ${className ?? ""}`}
    >
      🔥 {count}
      {longest != null && longest > count && (
        <span className="ml-1 text-[0.6em] opacity-70">best {longest}</span>
      )}
    </motion.span>
  )
}

interface ProgressRingProps {
  value: number
  max: number
  className?: string
  size?: number
  color?: "emerald" | "flame" | "blue"
}

export function ProgressRing({ value, max, className, size = 110, color = "emerald" }: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const strokeDasharray = 283
  const offset = strokeDasharray - (pct / 100) * strokeDasharray
  const colors: Record<string, string> = {
    emerald: "stroke-emerald-500",
    flame: "stroke-flame-500",
    blue: "stroke-blue-500",
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="block w-full h-full transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 16) / 2}
          fill="none"
          stroke="slate-100"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 16) / 2}
          fill="none"
          stroke={colors[color]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {Math.round(pct)}%
        </span>
        <span className="text-sm font-bold text-slate-900">
          {value} / {max}
        </span>
      </div>
    </div>
  )
}

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  color?: "emerald" | "flame" | "blue"
}

export function ProgressBar({ value, max, className, color = "emerald" }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500",
    flame: "bg-flame-500",
    blue: "bg-blue-500",
  }
  return (
    <div className={`w-full h-3 rounded-full border border-slate-200 bg-slate-100 overflow-hidden ${className ?? ""}`}>
      <div
        className={`h-full ${colors[color]} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
