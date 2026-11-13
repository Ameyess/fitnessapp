"use client"

import * as React from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="mb-4">
      {label && <label className="label">{label}</label>}
      <input
        className={`input ${error ? "border-rose-500 focus:ring-rose-200" : ""} ${className ?? ""}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-600 mt-1 block">{error}</span>}
    </div>
  )
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "emerald" | "flame"
  children: React.ReactNode
}

export function Badge({ variant = "default", children, className }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "border-slate-200 bg-slate-100 text-slate-600",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    flame: "border-flame-200 bg-flame-50 text-flame-700",
  }
  return (
    <span className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600 ${variants[variant]} ${className ?? ""}`}>
      {children}
    </span>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {icon && <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400">{icon}</div>}
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  )
}

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizes: Record<string, string> = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" }
  return (
    <div className={`flex items-center justify-center ${sizes[size]} ${className ?? ""}`}>
      <svg
        className="animate-spin h-full w-full text-slate-300"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.96 7.96 0 004 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  )
}
