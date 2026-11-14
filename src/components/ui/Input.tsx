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
        className={`input ${error ? "border-[var(--c-danger)]" : ""} ${className ?? ""}`}
        {...props}
      />
      {error && (
        <span className="mt-1 block text-xs font-bold" style={{ color: "var(--c-danger)" }}>
          {error}
        </span>
      )}
    </div>
  )
}

export function Badge({
  variant = "default",
  children,
  className,
}: {
  variant?: "default" | "primary" | "flame"
  children: React.ReactNode
  className?: string
}) {
  const variants: Record<string, string> = {
    default: "badge",
    primary: "badge-primary",
    flame: "badge-flame",
  }
  return <span className={`${variants[variant]} ${className ?? ""}`}>{children}</span>
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--c-surface-2)", color: "var(--c-faint)" }}
        >
          {icon}
        </div>
      )}
      <h3 className="mb-2 text-xl font-black" style={{ color: "var(--c-text)" }}>
        {title}
      </h3>
      <p className="mb-6 max-w-xs text-sm" style={{ color: "var(--c-muted)" }}>
        {description}
      </p>
      {action}
    </div>
  )
}

export function LoadingSpinner({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const sizes: Record<string, string> = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-12 w-12" }
  return (
    <div className={`flex items-center justify-center ${sizes[size]} ${className ?? ""}`}>
      <svg
        className="h-full w-full animate-spin"
        style={{ color: "var(--c-primary)" }}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.96 7.96 0 004 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  )
}
