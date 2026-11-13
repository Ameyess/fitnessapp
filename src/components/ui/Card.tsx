"use client"

import * as React from "react"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  thick?: boolean
  children: React.ReactNode
  className?: string
}

export function Card({ children, className, thick = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${
        thick ? "shadow-[0_12px_0_#e2e8f0]" : ""
      } ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

export interface StatCardProps {
  label: string
  value: string | number
  trend?: string
  icon?: React.ReactNode
  accent?: "emerald" | "flame" | "blue"
}

export function StatCard({ label, value, trend, icon, accent = "emerald" }: StatCardProps) {
  const accentColors: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    flame: "border-flame-200 bg-flame-50 text-flame-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  }
  return (
    <Card thick className="p-5">
      <div className="flex items-end gap-2 mb-2">
        {icon && <span className="w-6 h-6">{icon}</span>}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {trend && (
        <span className="text-xs text-slate-400">{trend}</span>
      )}
    </Card>
  )
}
