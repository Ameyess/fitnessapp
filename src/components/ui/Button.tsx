"use client"

import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "flame" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
}

export function Button({ className, variant = "primary", size = "md", children, disabled, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-2xl border px-6 text-sm font-semibold shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
  const variants: Record<string, string> = {
    primary:
      "bg-emerald-500 border-emerald-500 text-white shadow-[0_8px_0_#15803d] active:shadow-[0_2px_0_#15803d] active:translate-y-[6px]",
    flame:
      "bg-flame-500 border-flame-500 text-white shadow-[0_8px_0_#c2410c] active:shadow-[0_2px_0_#c2410c] active:translate-y-[6px]",
    ghost:
      "bg-transparent border-slate-300 text-slate-600 hover:bg-slate-100 shadow-none",
    danger:
      "bg-rose-500 border-rose-500 text-white shadow-[0_8px_0_#be123c] active:shadow-[0_2px_0_#be123c] active:translate-y-[6px]",
  }
  const sizes: Record<string, string> = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
